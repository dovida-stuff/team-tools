#!/usr/bin/env node
/*
 * Playwright smoke test for index.html (the territory map + zone editor).
 *
 *   node test/browser/run.mjs verify --html index.html [--expect-name <zone name>]
 *   node test/browser/run.mjs edit   --html index.html --out payload.json [--name <new zone name>]
 *
 * A throwaway http server serves the HTML with three on-the-fly rewrites:
 *   1. the Google Maps <script> is swapped for test/browser/google-maps-stub.js
 *   2. EDIT_PASS_HASH becomes sha256('test-pass')
 *   3. SAVE_ENDPOINT points at this server's POST /save, which records the body
 * Nothing on disk is modified.
 */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLAYWRIGHT_DIR = process.env.PLAYWRIGHT_DIR || '/opt/node22/lib/node_modules/playwright';
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require(PLAYWRIGHT_DIR));
} catch (err) {
  console.error('Could not load Playwright from ' + PLAYWRIGHT_DIR + ': ' + err.message);
  process.exit(2);
}

const HERE = dirname(fileURLToPath(import.meta.url));
const STUB_PATH = resolve(HERE, 'google-maps-stub.js');
const EDIT_PASS = 'test-pass';
const SAVE_PASSWORD = 'worker-pass';
const DEFAULT_XSS_NAME = 'Zone </script><img src=x onerror=alert(1)> tail';
const TIMEOUT = 20000;

/* ---------------- CLI ---------------- */

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const mode = args._[0];
if (!['verify', 'edit'].includes(mode) || !args.html) {
  console.error('Usage:\n  node test/browser/run.mjs verify --html <path> [--expect-name <string>]\n' +
                '  node test/browser/run.mjs edit --html <path> --out <payload.json> [--name <string>]');
  process.exit(2);
}
if (mode === 'edit' && !args.out) {
  console.error('edit mode needs --out <payload.json>');
  process.exit(2);
}

/* ---------------- server ---------------- */

function sha256Hex(s) { return createHash('sha256').update(s, 'utf8').digest('hex'); }

function rewriteHtml(html, port) {
  const notes = [];
  const scriptRe = /<script[^>]*src="https:\/\/maps\.googleapis\.com\/[^"]*"[^>]*><\/script>/;
  if (!scriptRe.test(html)) throw new Error('rewrite: Google Maps <script> tag not found');
  html = html.replace(scriptRe, '<script src="/google-maps-stub.js"></script>');
  notes.push('maps script -> /google-maps-stub.js');

  const hashRe = /(const\s+EDIT_PASS_HASH\s*=\s*)(['"])[0-9a-fA-F]*\2/;
  if (!hashRe.test(html)) throw new Error('rewrite: EDIT_PASS_HASH not found');
  html = html.replace(hashRe, (m, pre, q) => pre + q + sha256Hex(EDIT_PASS) + q);
  notes.push('EDIT_PASS_HASH -> sha256("' + EDIT_PASS + '")');

  const endpointRe = /(const\s+SAVE_ENDPOINT\s*=\s*)(['"])[^'"]*\2/;
  if (!endpointRe.test(html)) throw new Error('rewrite: SAVE_ENDPOINT not found');
  const saveUrl = 'http://127.0.0.1:' + port + '/save';
  html = html.replace(endpointRe, (m, pre, q) => pre + q + saveUrl + q);
  notes.push('SAVE_ENDPOINT -> ' + saveUrl);
  return { html, notes };
}

function startServer(rawHtml) {
  const state = { saves: [], waiters: [] };
  const stubJs = readFileSync(STUB_PATH, 'utf8');
  let rewritten = null;

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'GET' && (url.pathname === '/index.html' || url.pathname === '/')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(rewritten.html);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/google-maps-stub.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(stubJs);
      return;
    }
    if (url.pathname === '/save') {
      if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
      if (req.method === 'POST') {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let body = null, parseError = null;
          try { body = JSON.parse(raw); } catch (err) { parseError = err.message; }
          const rec = { at: Date.now(), headers: req.headers, raw, body, parseError };
          state.saves.push(rec);
          state.waiters.splice(0).forEach(fn => fn(rec));
          res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, cors));
          res.end(JSON.stringify({ ok: true, sha: 'abc1234def', url: 'https://github.com/x/y/commit/abc1234def' }));
        });
        return;
      }
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found: ' + req.method + ' ' + url.pathname);
  });

  return new Promise((resolvePromise, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      try { rewritten = rewriteHtml(rawHtml, port); } catch (err) { server.close(); reject(err); return; }
      state.nextSave = () => new Promise(r => state.waiters.push(r));
      resolvePromise({
        server, port, state,
        origin: 'http://127.0.0.1:' + port,
        rewriteNotes: rewritten.notes,
        close: () => new Promise(r => server.close(() => r())),
      });
    });
  });
}

/* ---------------- browser ---------------- */

async function openPage(browser, opts) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  const log = { pageErrors: [], consoleErrors: [], requestFailures: [], dialogs: [] };
  page.on('pageerror', err => log.pageErrors.push(String(err && err.stack || err)));
  page.on('console', msg => {
    if (msg.type() === 'error') log.consoleErrors.push(msg.text());
  });
  page.on('requestfailed', req => log.requestFailures.push(req.method() + ' ' + req.url() + ' ' + (req.failure() || {}).errorText));
  page.on('dialog', async dialog => {
    const rec = { type: dialog.type(), message: dialog.message() };
    log.dialogs.push(rec);
    if (dialog.type() === 'prompt' && opts.promptAnswer != null) { rec.action = 'accept:' + opts.promptAnswer; await dialog.accept(opts.promptAnswer); }
    else { rec.action = 'dismiss'; await dialog.dismiss(); }
  });
  return { context, page, log };
}

class Checks {
  constructor() { this.list = []; }
  add(name, ok, detail) {
    this.list.push({ name, ok: !!ok, detail: detail === undefined ? null : detail });
    return !!ok;
  }
  get failed() { return this.list.filter(c => !c.ok); }
  get passed() { return this.list.filter(c => c.ok); }
}

function htmlTitle(html) {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  return m ? m[1] : null;
}

/* ---------------- verify ---------------- */

async function runVerify(browser, srv, rawHtml) {
  const checks = new Checks();
  const { page, log, context } = await openPage(browser, {});
  const expectedTitle = htmlTitle(rawHtml);
  try {
    await page.goto(srv.origin + '/index.html', { waitUntil: 'load', timeout: TIMEOUT });
    await page.waitForSelector('#office-list .office-item', { timeout: TIMEOUT });

    const facts = await page.evaluate(() => {
      const stateCodes = Object.values(STATE_GROUPS).reduce((n, list) => n + list.length, 0);
      const zonesAll = ZONES.length;
      const expectedPolys = ZONES.filter(z => z.office && Array.isArray(z.coords) && z.coords.length >= 3 && isStateVisible(z.office)).length;
      const expectedPolysLoose = ZONES.filter(z => Array.isArray(z.coords) && z.coords.length >= 3 && isStateVisible(z.office)).length;
      const zonesNoOffice = ZONES.filter(z => !z.office).length;
      return {
        initMapCalled: window.__stub.initMapCalled,
        zonesIsArray: Array.isArray(ZONES),
        zonesAll,
        zonesNoOffice,
        officeCount: Object.keys(OFFICES).length,
        stateCodes,
        sidebarItems: document.querySelectorAll('#office-list .office-item').length,
        polygons: window.__stub.polygons.length,
        polygonsOnMap: window.__stub.polygons.filter(p => p.getMap()).length,
        expectedPolys,
        expectedPolysLoose,
        markers: window.__stub.markers.length,
        labelMarkers: ZONES.filter(z => z.label).length,
        officeMarkers: Object.keys(OFFICES).length + Object.values(OFFICES).reduce((n, o) => n + ((o.secondaryLocations || []).length), 0),
        infoWindows: window.__stub.infoWindows.length,
        title: document.title,
        mapCount: window.__stub.maps.length,
      };
    });

    checks.add('initMap was called by the stub', facts.initMapCalled);
    checks.add('exactly one google.maps.Map created', facts.mapCount === 1, facts.mapCount);
    checks.add('ZONES is a non-empty array', facts.zonesIsArray && facts.zonesAll > 0, facts.zonesAll);
    checks.add('OFFICES has entries', facts.officeCount > 0, facts.officeCount);
    checks.add('sidebar office count == office codes across STATE_GROUPS',
      facts.sidebarItems === facts.stateCodes, { sidebar: facts.sidebarItems, stateCodes: facts.stateCodes });
    checks.add('polygons created == zones with >=3 coords in a visible state',
      facts.polygons === facts.expectedPolys,
      { polygons: facts.polygons, expected: facts.expectedPolys, zonesWithoutOffice: facts.zonesNoOffice, expectedIgnoringOffice: facts.expectedPolysLoose });
    checks.add('all polygons attached to the map', facts.polygonsOnMap === facts.polygons, facts.polygonsOnMap);
    checks.add('markers == office pins + satellite pins + zone labels',
      facts.markers === facts.officeMarkers + facts.labelMarkers,
      { markers: facts.markers, officePins: facts.officeMarkers, labels: facts.labelMarkers });

    // Search for a postcode.
    await page.fill('#search-input', '4000');
    await page.waitForSelector('#search-results.visible .search-result', { timeout: TIMEOUT });
    const search = await page.evaluate(() => {
      const items = [...document.querySelectorAll('#search-results .search-result')];
      return {
        count: items.length,
        first: items.length ? items[0].textContent.trim().replace(/\s+/g, ' ') : null,
        noMatches: items.some(i => /No matches found/.test(i.textContent)),
      };
    });
    checks.add('typing 4000 into #search-input produces results', search.count > 0 && !search.noMatches, search);

    // Clicking the first result should drop a search marker and open the info panel.
    await page.click('#search-results .search-result');
    const after = await page.evaluate(() => ({
      infoVisible: document.getElementById('info-panel').classList.contains('visible'),
      infoOffice: document.getElementById('info-office').textContent,
      searchMarker: !!searchMarker,
      zoom: map.getZoom(),
    }));
    checks.add('selecting a search result shows the info panel and a search marker',
      after.infoVisible && after.searchMarker && after.zoom === 13, after);

    // Polygon interaction through the stub's event trigger.
    const polyEv = await page.evaluate(() => {
      const poly = window.__stub.polygons[0];
      const before = poly.options.fillOpacity;
      google.maps.event.trigger(poly, 'mouseover');
      const hover = poly.options.fillOpacity;
      google.maps.event.trigger(poly, 'click', window.__stub.mapEvent(0, 0));
      return {
        zone: poly._zone.name, office: poly._zone.office, before, hover,
        activeOffice, infoZone: document.getElementById('info-zone').textContent,
        activeItems: document.querySelectorAll('#office-list .office-item.active').length,
      };
    });
    checks.add('polygon mouseover raises fillOpacity and click activates its office',
      polyEv.hover === 0.65 && polyEv.activeOffice === polyEv.office && polyEv.infoZone === polyEv.zone && polyEv.activeItems === 1, polyEv);

    // XSS canary.
    const canary = await page.evaluate(() => ({
      imgX: document.querySelectorAll('img[src="x"]').length,
      title: document.title,
    }));
    checks.add('no img[src="x"] element exists (XSS canary)', canary.imgX === 0, canary.imgX);
    checks.add('document.title unchanged', canary.title === expectedTitle, { title: canary.title, expected: expectedTitle });

    if (args['expect-name']) {
      const want = String(args['expect-name']);
      const found = await page.evaluate((want) => {
        const z = ZONES.find(z => z.name === want);
        if (!z) return { found: false };
        const ref = zoneRefs.get(z);
        if (ref && ref.poly) google.maps.event.trigger(ref.poly, 'mouseover');
        const html = ['office-list', 'edit-panel', 'info-panel', 'search-results']
          .map(id => (document.getElementById(id) || {}).innerHTML || '').join('\n');
        return {
          found: true, office: z.office,
          rawImg: /<img/i.test(html),
          infoZone: document.getElementById('info-zone').textContent,
          imgX: document.querySelectorAll('img[src="x"]').length,
        };
      }, want);
      checks.add('a zone named exactly --expect-name exists after JS parsing', found.found, want);
      if (found.found) {
        checks.add('sidebar/edit-panel/info-panel HTML contains no raw "<img"', !found.rawImg);
        checks.add('info panel shows the hostile name as text', found.infoZone === want, found.infoZone);
        checks.add('still no img[src="x"] after hovering that zone', found.imgX === 0, found.imgX);
      }
    }
  } catch (err) {
    checks.add('verify flow completed without exceptions', false, String(err && err.stack || err));
  }

  checks.add('no page errors', log.pageErrors.length === 0, log.pageErrors);
  checks.add('no console errors', log.consoleErrors.length === 0, log.consoleErrors);
  checks.add('no failed requests', log.requestFailures.length === 0, log.requestFailures);
  checks.add('no unexpected dialogs', log.dialogs.length === 0, log.dialogs);
  await context.close();
  return checks;
}

/* ---------------- edit ---------------- */

async function runEdit(browser, srv, rawHtml) {
  const checks = new Checks();
  const newName = args.name ? String(args.name) : DEFAULT_XSS_NAME;
  const expectedTitle = htmlTitle(rawHtml);
  const { page, log, context } = await openPage(browser, { promptAnswer: EDIT_PASS });
  let payload = null;
  try {
    await page.goto(srv.origin + '/index.html#edit', { waitUntil: 'load', timeout: TIMEOUT });
    await page.waitForSelector('#office-list .office-item', { timeout: TIMEOUT });
    await page.waitForSelector('#edit-panel.visible', { timeout: TIMEOUT });
    checks.add('passphrase prompt answered and #edit-panel became visible',
      log.dialogs.some(d => d.type === 'prompt'), log.dialogs);

    const sel = await page.evaluate((newName) => {
      const poly = window.__stub.polygons[0];
      const oldName = poly._zone.name;
      selectZoneForEdit(poly);
      const selected = editState.selected === poly;
      const fieldBefore = document.getElementById('edit-f-name').value;
      const input = document.getElementById('edit-f-name');
      input.value = newName;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return {
        oldName, selected, fieldBefore,
        newZoneName: poly._zone.name,
        dirty: [...editState.dirty],
        strokeColor: poly.options.strokeColor, editable: poly.options.editable,
        saveDisabled: document.getElementById('edit-save').disabled,
        selName: document.getElementById('edit-sel-name').textContent,
        note: document.getElementById('edit-note').textContent,
        zoneHtmlHasImg: /<img/i.test(document.getElementById('edit-panel').innerHTML),
      };
    }, newName);
    checks.add('selectZoneForEdit selected the first polygon (white outline, editable)',
      sel.selected && sel.editable === true && sel.strokeColor === '#ffffff', sel);
    checks.add('name field was pre-filled with the zone name', sel.fieldBefore === sel.oldName, sel.fieldBefore);
    checks.add('change on #edit-f-name renamed the zone via applyZoneFields', sel.newZoneName === newName.trim(), sel.newZoneName);
    checks.add('zone marked dirty', sel.dirty.length === 1, sel.dirty);
    checks.add('#edit-save became enabled', sel.saveDisabled === false);
    checks.add('edit panel shows the new name as text and contains no raw "<img"',
      sel.selName === newName.trim() && !sel.zoneHtmlHasImg, { selName: sel.selName, hasImg: sel.zoneHtmlHasImg });
    await page.waitForFunction(() => !document.getElementById('edit-save').disabled, null, { timeout: TIMEOUT });

    // First save click: no password yet, so the modal opens.
    await page.click('#edit-save');
    await page.waitForSelector('#edit-modal.visible', { timeout: TIMEOUT });
    const why = await page.textContent('#edit-pw-why');
    checks.add('clicking Save opened the password modal', /save password/i.test(why || ''), why);
    await page.fill('#edit-pw-input', SAVE_PASSWORD);
    await page.uncheck('#edit-pw-remember');
    await page.click('#edit-pw-save');
    await page.waitForFunction(() => !document.getElementById('edit-modal').classList.contains('visible'), null, { timeout: TIMEOUT });
    const pwState = await page.evaluate(() => ({
      savePassword: editState.savePassword,
      stored: (() => { try { return localStorage.getItem(PASS_KEY); } catch (e) { return 'n/a'; } })(),
      note: document.getElementById('edit-note').textContent,
    }));
    checks.add('password accepted and not remembered in localStorage',
      pwState.savePassword === SAVE_PASSWORD && pwState.stored === null, pwState);

    // Second save click: POST /save.
    const nextSave = srv.state.nextSave();
    const responseP = page.waitForResponse(r => r.url().endsWith('/save') && r.request().method() === 'POST', { timeout: TIMEOUT });
    await page.click('#edit-save');
    const rec = await Promise.race([nextSave, new Promise((_, rej) => setTimeout(() => rej(new Error('timed out waiting for POST /save')), TIMEOUT))]);
    const resp = await responseP;
    checks.add('page received 200 from POST /save', resp.status() === 200, resp.status());
    checks.add('POST /save body was valid JSON', !rec.parseError, rec.parseError);
    checks.add('POST /save content-type is application/json', /application\/json/.test(rec.headers['content-type'] || ''), rec.headers['content-type']);
    payload = rec.body;

    await page.waitForFunction(() => /Saved/.test(document.getElementById('edit-note').textContent), null, { timeout: TIMEOUT });
    const post = await page.evaluate(() => ({
      note: document.getElementById('edit-note').textContent,
      noteHtml: document.getElementById('edit-note').innerHTML,
      dirty: editState.dirty.size,
      draft: (() => { try { return localStorage.getItem(DRAFT_KEY); } catch (e) { return 'n/a'; } })(),
      imgX: document.querySelectorAll('img[src="x"]').length,
      title: document.title,
      panelHasImg: /<img/i.test(document.getElementById('edit-panel').innerHTML + document.getElementById('office-list').innerHTML),
    }));
    checks.add('#edit-note contains "Saved"', /Saved/.test(post.note), post.note);
    checks.add('commit link in note points at the fake commit URL', /github\.com\/x\/y\/commit\/abc1234def/.test(post.noteHtml) && /abc1234/.test(post.note), post.noteHtml);
    checks.add('dirty set cleared and draft removed after save', post.dirty === 0 && post.draft === null, { dirty: post.dirty, draft: post.draft });
    checks.add('no img[src="x"] element exists after the edit (XSS canary)', post.imgX === 0, post.imgX);
    checks.add('document.title unchanged', post.title === expectedTitle, { title: post.title, expected: expectedTitle });
    checks.add('edit panel/sidebar HTML contains no raw "<img"', !post.panelHasImg);

    if (payload && typeof payload === 'object') {
      checks.add('payload.password === "worker-pass"', payload.password === SAVE_PASSWORD, payload.password);
      checks.add('payload.zones is an array', Array.isArray(payload.zones), Array.isArray(payload.zones) ? payload.zones.length : typeof payload.zones);
      checks.add('payload.offices is an object with entries', payload.offices && typeof payload.offices === 'object' && Object.keys(payload.offices).length > 0,
        payload.offices ? Object.keys(payload.offices).length : payload.offices);
      checks.add('payload.states is an object with entries', payload.states && typeof payload.states === 'object' && Object.keys(payload.states).length > 0,
        payload.states ? Object.keys(payload.states) : payload.states);
      checks.add('payload.basedOn.zones is a string', payload.basedOn && typeof payload.basedOn.zones === 'string',
        payload.basedOn ? typeof payload.basedOn.zones : payload.basedOn);
      checks.add('payload.basedOn.offices / .states are strings',
        payload.basedOn && typeof payload.basedOn.offices === 'string' && typeof payload.basedOn.states === 'string');
      const renamed = Array.isArray(payload.zones) ? payload.zones.find(z => z.name === newName.trim()) : null;
      checks.add('renamed zone present in payload.zones', !!renamed, renamed ? { name: renamed.name, office: renamed.office, coords: renamed.coords.length } : null);
      checks.add('payload.zones length equals ZONES length', Array.isArray(payload.zones) && payload.zones.length === (await page.evaluate(() => ZONES.length)),
        Array.isArray(payload.zones) ? payload.zones.length : null);
      checks.add('basedOn.zones still holds the original name (stale-save fingerprint)',
        payload.basedOn && typeof payload.basedOn.zones === 'string' && payload.basedOn.zones.includes(JSON.stringify(sel.oldName)) && !payload.basedOn.zones.includes(JSON.stringify(newName.trim())),
        sel.oldName);
      checks.add('payload.summary mentions 1 zone', /1 zone/.test(payload.summary || ''), payload.summary);
    } else {
      checks.add('payload captured', false, payload);
    }
  } catch (err) {
    checks.add('edit flow completed without exceptions', false, String(err && err.stack || err));
  }

  if (args.out) {
    try {
      mkdirSync(dirname(resolve(args.out)), { recursive: true });
      writeFileSync(resolve(args.out), JSON.stringify(payload, null, 2));
      checks.add('payload written to ' + resolve(args.out), payload != null);
    } catch (err) {
      checks.add('payload written to ' + resolve(args.out), false, String(err));
    }
  }

  const unexpectedDialogs = log.dialogs.filter(d => d.type !== 'prompt');
  checks.add('no page errors', log.pageErrors.length === 0, log.pageErrors);
  checks.add('no console errors', log.consoleErrors.length === 0, log.consoleErrors);
  checks.add('no failed requests', log.requestFailures.length === 0, log.requestFailures);
  checks.add('no dialogs other than the passphrase prompt (alert would mean XSS fired)', unexpectedDialogs.length === 0, unexpectedDialogs);
  await context.close();
  return checks;
}

/* ---------------- main ---------------- */

async function main() {
  const htmlPath = resolve(args.html);
  const rawHtml = readFileSync(htmlPath, 'utf8');
  const srv = await startServer(rawHtml);
  let browser = null;
  let checks;
  try {
    browser = await chromium.launch({ headless: true });
    checks = mode === 'verify' ? await runVerify(browser, srv, rawHtml) : await runEdit(browser, srv, rawHtml);
  } finally {
    if (browser) await browser.close();
    await srv.close();
  }
  const summary = {
    mode,
    html: htmlPath,
    server: srv.origin,
    rewrites: srv.rewriteNotes,
    passed: checks.passed.length,
    failed: checks.failed.length,
    checks: checks.list,
  };
  if (mode === 'edit') summary.out = resolve(args.out);
  console.log(JSON.stringify(summary, null, 2));
  process.exit(checks.failed.length ? 1 : 0);
}

main().catch(err => {
  console.error(JSON.stringify({ mode, fatal: String(err && err.stack || err) }, null, 2));
  process.exit(1);
});
