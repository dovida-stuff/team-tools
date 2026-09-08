// End-to-end simulation of a save, with no network and no real GitHub:
//   1. Chromium loads index.html, unlocks the editor, renames a zone to a
//      hostile string, and presses Save. The POST body is captured.
//   2. That body is fed to the Worker, with the GitHub API faked and the
//      real index.html served as the published file. The committed blob is
//      written out as a new HTML file.
//   3. Chromium loads the rebuilt file and checks it still works, the zone
//      carries the new name, and nothing was injected into the page.
// Usage: node test/e2e-roundtrip.mjs [--html index.html] [--worker worker/save-worker.js] [--keep]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installGitHubMock } from './helpers/github-mock.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i > -1 ? args[i + 1] : dflt; };
const html = path.resolve(opt('--html', path.join(here, '..', 'index.html')));
const keep = args.includes('--keep');
const worker = (await import(path.resolve(opt('--worker', path.join(here, '..', 'worker', 'save-worker.js'))))).default;
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'map-e2e-'));
const payloadPath = path.join(work, 'payload.json');
const rebuiltPath = path.join(work, 'rebuilt.html');
const HOSTILE = 'Zone </script><img src=x onerror=alert(1)> \u2028tail & more';

function run(label, cmdArgs) {
  console.log('\n== ' + label + ' ==');
  const r = spawnSync(process.execPath, cmdArgs, { stdio: 'inherit' });
  if (r.status !== 0) { console.error(label + ' failed'); process.exit(1); }
}

run('1. browser edit', [path.join(here, 'browser', 'run.mjs'), 'edit', '--html', html, '--out', payloadPath, '--name', HOSTILE]);

console.log('\n== 2. worker save (GitHub faked) ==');
const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
const published = fs.readFileSync(html, 'utf8');
const gh = installGitHubMock({ published });
const res = await worker.fetch(new Request('https://save.example/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'https://dovida-stuff.github.io' },
  body: JSON.stringify(payload),
}), { GITHUB_TOKEN: 'fake', EDIT_PASSWORD: payload.password });
const body = await res.json();
gh.restore();
console.log('worker status', res.status, JSON.stringify(body));
if (res.status !== 200 || gh.blobs.length !== 1) { console.error('worker did not commit'); process.exit(1); }
const rebuilt = gh.blobs[0];
fs.writeFileSync(rebuiltPath, rebuilt);
// The same regex the Worker uses to find the line on the next save. If it no
// longer matches, that next save would fail and the map could not be updated.
const lineMatch = rebuilt.match(/^const ZONES=(.*);$/m);
const zonesLine = lineMatch ? lineMatch[1] : '';
const parsedZones = (() => { try { return JSON.parse(zonesLine); } catch (err) { return null; } })();
const checks = {
  'ZONES line is still findable for the next save': !!lineMatch,
  'no literal </script> in ZONES line': !/<\/script/i.test(zonesLine),
  'no raw < > & in ZONES line': !/[<>&]/.test(zonesLine),
  'no raw U+2028/9 in ZONES line': !/[\u2028\u2029]/.test(zonesLine),
  'ZONES line parses and holds the hostile name': Array.isArray(parsedZones) && parsedZones.some(z => z.name === HOSTILE),
  'rest of file byte-identical': (() => {
    const strip = t => t.replace(/^const (ZONES|OFFICES|STATE_GROUPS)=.*;$/mg, 'const $1=X;');
    return strip(rebuilt) === strip(published);
  })(),
  'commit message': gh.calls.find(c => c.step === 'commits').body.message === 'Update 1 zone from the map editor',
};
let ok = true;
for (const [k, v] of Object.entries(checks)) { console.log((v ? 'PASS ' : 'FAIL ') + k); ok = ok && v; }
if (!ok) {
  // Show what an old Worker would have published so the failure is concrete.
  const at = rebuilt.indexOf('</script><img');
  if (at > -1) console.log('published file contains: ' + JSON.stringify(rebuilt.slice(at - 30, at + 60)));
  process.exit(1);
}

run('3. browser verify of rebuilt file', [path.join(here, 'browser', 'run.mjs'), 'verify', '--html', rebuiltPath, '--expect-name', HOSTILE]);

if (!keep) fs.rmSync(work, { recursive: true, force: true });
else console.log('\nkept', work);
console.log('\nROUND TRIP OK');
