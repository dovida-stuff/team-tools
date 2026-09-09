/**
 * Dovida Recruitment Territory Map — save endpoint.
 *
 * Runs on Cloudflare Workers. Holds the GitHub token as a server-side secret
 * so the map page never carries a credential: editors only ever need the
 * shared password.
 *
 * It can only rewrite the three data lines of index.html. It cannot commit
 * arbitrary files, so a leaked password means "someone can alter map data",
 * not "someone can push anything to the repo".
 *
 * Every submitted value is checked against the shape the map expects, and the
 * JSON is written with <, >, & and the Unicode line separators escaped, so a
 * zone name can never close the <script> tag or break the published page.
 *
 * Secrets to set in the Cloudflare dashboard (Settings -> Variables):
 *   GITHUB_TOKEN    fine-grained PAT, this repo only, Contents: Read and write
 *   EDIT_PASSWORD   the password editors type on the map
 * Optional plain variable:
 *   ALLOWED_ORIGIN  defaults to https://dovida-stuff.github.io
 */

const REPO = { owner: 'dovida-stuff', repo: 'team-tools', path: 'index.html', branch: 'main' };
const DEFAULT_ORIGIN = 'https://dovida-stuff.github.io';

// Hard limits. Generous for real use, tight enough that a bad payload cannot
// bloat the published file or keep the Worker busy hashing a huge "password".
const LIMITS = {
  password: 256,
  zones: 5000,
  cornersPerZone: 20000,
  zonesChars: 6000000,
  offices: 500,
  officesChars: 1000000,
  secondaries: 50,
  states: 100,
  statesChars: 100000,
  text: 500,
};

const HEX_COLOUR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;   // office colours, as published
const HEX_FILL = /^#[0-9a-fA-F]{6}$/;                        // zone fills, always from the colour picker
const CODE = /^[A-Za-z0-9 _&-]{1,40}$/;
// Anything Object.prototype already answers to ("toString", "hasOwnProperty",
// "__proto__" ...) would be read back as that inherited value by the page's
// `if (!officeZones[code])` lookups, and "_secondary" is the suffix the page
// uses for an office's satellite-pin slot.
function isReservedKey(key) {
  return key in Object.prototype || key === 'prototype' || /_secondary$/i.test(key);
}

export default {
  async fetch(request, env) {
    const allowedOrigin = env.ALLOWED_ORIGIN || DEFAULT_ORIGIN;
    const cors = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    // Visiting the URL in a browser confirms the Worker is up. No secrets here.
    if (request.method === 'GET') {
      return reply({
        ok: true,
        service: 'dovida-map-save',
        repo: REPO.owner + '/' + REPO.repo,
        configured: { token: !!env.GITHUB_TOKEN, password: !!env.EDIT_PASSWORD },
      }, 200, cors);
    }

    if (request.method !== 'POST') return reply({ error: 'Use POST to save.' }, 405, cors);

    const origin = request.headers.get('Origin');
    if (origin && origin !== allowedOrigin) return reply({ error: 'Requests are not accepted from ' + origin }, 403, cors);

    if (!env.GITHUB_TOKEN || !env.EDIT_PASSWORD) {
      return reply({ error: 'The Worker is missing its GITHUB_TOKEN or EDIT_PASSWORD secret.' }, 500, cors);
    }

    let body;
    try { body = await request.json(); } catch (err) { return reply({ error: 'Body was not valid JSON.' }, 400, cors); }
    if (!isPlainObject(body)) return reply({ error: 'Body was not a JSON object.' }, 400, cors);

    if (typeof body.password !== 'string' || body.password.length > LIMITS.password
        || !(await sameSecret(body.password, env.EDIT_PASSWORD))) {
      return reply({ error: 'That password is not right.' }, 401, cors);
    }

    const problem = validatePayload(body);
    if (problem) return reply({ error: problem + ' Nothing was saved.' }, 400, cors);

    try {
      // Everything below is pinned to this one commit: the file is read at it
      // and the new commit names it as parent, so a save that lands in between
      // is refused by GitHub instead of being overwritten.
      const headSha = await readHeadSha(env);
      const source = await readPublishedFile(env, headSha);

      // Reject a save built on a version of the map that has since moved on.
      if (isPlainObject(body.basedOn)) {
        const stale = FIELDS.filter(f => {
          const was = body.basedOn[f.key];
          return typeof was === 'string' && was !== canonical(source, f.name);
        }).map(f => f.key);
        if (stale.length) {
          return reply({
            error: 'conflict',
            message: 'The published map changed since your page loaded (' + stale.join(' and ') + '). Nothing was saved.',
            stale,
          }, 409, cors);
        }
      }

      let out = source;
      for (const f of FIELDS) {
        const line = new RegExp('^const ' + f.name + '=.*;$', 'm');
        if (!line.test(out)) throw new Error('Could not find the ' + f.name + ' line in the published file.');
        out = out.replace(line, () => 'const ' + f.name + '=' + scriptSafeJson(body[f.key]) + ';');
      }

      // A rebuild that loses most of the file means something went wrong.
      if (out.length < source.length * 0.5) {
        throw new Error('The rebuilt file was less than half the size of the published one, so it was not committed.');
      }

      const commit = await commitFile(env, headSha, out, describe(body.summary));
      return reply({
        ok: true,
        sha: commit.sha,
        url: 'https://github.com/' + REPO.owner + '/' + REPO.repo + '/commit/' + commit.sha,
      }, 200, cors);
    } catch (err) {
      return reply({ error: String(err.message || err) }, 502, cors);
    }
  },
};

/* ---------- validation ---------- */

// The three data structures and the variable each one is written to.
const FIELDS = [
  { key: 'zones', name: 'ZONES' },
  { key: 'offices', name: 'OFFICES' },
  { key: 'states', name: 'STATE_GROUPS' },
];

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function isText(v, max = LIMITS.text) {
  return typeof v === 'string' && v.length <= max;
}

function isLat(v) { return typeof v === 'number' && Number.isFinite(v) && v >= -90 && v <= 90; }
function isLng(v) { return typeof v === 'number' && Number.isFinite(v) && v >= -180 && v <= 180; }
function isPoint(p) { return Array.isArray(p) && p.length === 2 && isLat(p[0]) && isLng(p[1]); }
function has(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }

// Keys are checked before anything is read through them: a key like
// "__proto__" would otherwise become the object's prototype once the page
// evaluates the rewritten object literal.
function badKey(key, what) {
  if (isReservedKey(key)) return 'The ' + what + ' code "' + key.slice(0, 40) + '" is not allowed.';
  if (!CODE.test(key)) return 'The ' + what + ' code "' + key.slice(0, 40) + '" can only use letters, numbers, spaces, hyphen, underscore or &, up to 40 characters.';
  return null;
}

// Returns a message describing the first problem, or null when everything is
// the shape the map expects. Wording is shown to the editor as-is.
function validatePayload(body) {
  const { zones, offices, states } = body;

  if (!isPlainObject(offices) || Object.keys(offices).length === 0) return 'The offices data was missing or malformed.';
  if (Object.keys(offices).length > LIMITS.offices) return 'Too many offices.';
  for (const [code, off] of Object.entries(offices)) {
    const k = badKey(code, 'office');
    if (k) return k;
    const where = 'Office "' + code + '"';
    if (!isPlainObject(off)) return where + ' is malformed.';
    if (!isText(off.name) || !off.name.trim()) return where + ' needs a name.';
    if (typeof off.color !== 'string' || !HEX_COLOUR.test(off.color)) return where + ' needs a colour like #rrggbb.';
    if (!isLat(off.lat) || !isLng(off.lng)) return where + ' needs a latitude between -90 and 90 and a longitude between -180 and 180.';
    if (!isText(off.address)) return where + ' has a malformed address.';
    if (off.secondaryLocations !== undefined) {
      if (!Array.isArray(off.secondaryLocations) || off.secondaryLocations.length > LIMITS.secondaries) return where + ' has malformed satellite locations.';
      for (const sec of off.secondaryLocations) {
        if (!isPlainObject(sec) || !isLat(sec.lat) || !isLng(sec.lng)) return where + ' has a satellite location without a valid position.';
        if (sec.address !== undefined && !isText(sec.address)) return where + ' has a satellite location with a malformed address.';
        if (sec.label !== undefined && !isText(sec.label)) return where + ' has a satellite location with a malformed label.';
      }
    }
    for (const key of Object.keys(off)) {
      if (key in Object.prototype || key === 'prototype') return where + ' has a field that is not allowed.';
    }
  }

  if (JSON.stringify(offices).length > LIMITS.officesChars) return 'The offices data is too large to publish.';

  if (!isPlainObject(states) || Object.keys(states).length === 0) return 'The states data was missing or malformed.';
  if (Object.keys(states).length > LIMITS.states) return 'Too many state groups.';
  for (const [state, codes] of Object.entries(states)) {
    const k = badKey(state, 'state');
    if (k) return k;
    if (!Array.isArray(codes)) return 'State "' + state + '" must list office codes.';
    for (const code of codes) {
      if (typeof code !== 'string' || !has(offices, code)) return 'State "' + state + '" lists an office that does not exist.';
    }
  }

  if (JSON.stringify(states).length > LIMITS.statesChars) return 'The states data is too large to publish.';

  if (!Array.isArray(zones) || zones.length === 0) return 'The zones data was missing or malformed.';
  if (zones.length > LIMITS.zones) return 'Too many zones.';
  let chars = 0;
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    const where = 'Zone ' + (i + 1) + (isPlainObject(z) && typeof z.name === 'string' ? ' ("' + z.name.slice(0, 40) + '")' : '');
    if (!isPlainObject(z)) return where + ' is malformed.';
    if (!isText(z.name) || !z.name.trim()) return where + ' needs a name.';
    if (typeof z.office !== 'string' || !has(offices, z.office)) return where + ' belongs to an office that does not exist.';
    if (!Array.isArray(z.coords) || z.coords.length < 4 || z.coords.length > LIMITS.cornersPerZone) return where + ' needs at least three corners.';
    for (const p of z.coords) if (!isPoint(p)) return where + ' has a corner that is not a valid latitude/longitude pair.';
    if (z.label !== undefined && z.label !== null && !isText(z.label, 40) && !(typeof z.label === 'number' && Number.isFinite(z.label))) return where + ' has a malformed number label.';
    if (z.folder !== undefined && !isText(z.folder)) return where + ' has a malformed folder.';
    if (z.fill !== undefined && z.fill !== null && (typeof z.fill !== 'string' || !HEX_FILL.test(z.fill))) return where + ' needs a fill colour like #rrggbb.';
    if (z.labelPos !== undefined && z.labelPos !== null && !isPoint(z.labelPos)) return where + ' has a malformed label position.';
    if (z.labelSize !== undefined && z.labelSize !== null && !(typeof z.labelSize === 'number' && Number.isFinite(z.labelSize))) return where + ' has a malformed label size.';
    for (const key of Object.keys(z)) {
      if (key in Object.prototype || key === 'prototype') return where + ' has a field that is not allowed.';
    }
    // Rough running size, so an oversized payload is refused before the
    // whole thing is serialised: about 24 characters per corner plus the rest.
    chars += z.coords.length * 24 + 200;
    if (chars > LIMITS.zonesChars) return 'The zones data is too large to publish.';
  }
  if (JSON.stringify(zones).length > LIMITS.zonesChars) return 'The zones data is too large to publish.';

  return null;
}

/* ---------- helpers ---------- */

function reply(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors },
  });
}

async function digest(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Compares digests rather than the strings, so the reply time says nothing
// about how much of the password was right.
async function sameSecret(given, expected) {
  const [a, b] = await Promise.all([digest(given), digest(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// JSON that is safe to sit inside a <script> element: "</script>" and
// "<!--" cannot appear, and U+2028/U+2029 (which would end the line for the
// regex that finds these lines on the next save) are written as escapes.
// Parsing it gives back exactly the original values.
function scriptSafeJson(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

// Re-serialised so formatting differences never read as a change.
function canonical(source, name) {
  const m = source.match(new RegExp('^const ' + name + '=(.*);$', 'm'));
  if (!m) return null;
  try { return JSON.stringify(JSON.parse(m[1])); } catch (err) { return null; }
}

function describe(summary) {
  const clean = typeof summary === 'string'
    ? summary.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').trim().slice(0, 120)
    : '';
  return 'Update ' + (clean || 'territory map') + ' from the map editor';
}

function github(env, path, init = {}) {
  return fetch('https://api.github.com' + path, {
    method: init.method || 'GET',
    body: init.body,
    headers: {
      Authorization: 'Bearer ' + env.GITHUB_TOKEN,
      Accept: init.accept || 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'dovida-map-save-worker',
      'Content-Type': 'application/json',
    },
  });
}

async function ghJson(env, path, init) {
  const res = await github(env, path, init);
  if (!res.ok) {
    let detail = res.status + ' ' + res.statusText;
    try { const j = await res.json(); if (j.message) detail = j.message; } catch (err) {}
    throw new Error('GitHub: ' + detail);
  }
  return res.json();
}

async function readHeadSha(env) {
  const head = await ghJson(env, '/repos/' + REPO.owner + '/' + REPO.repo + '/git/ref/heads/' + REPO.branch);
  return head.object.sha;
}

async function readPublishedFile(env, sha) {
  const base = '/repos/' + REPO.owner + '/' + REPO.repo;
  const res = await github(env, base + '/contents/' + REPO.path + '?ref=' + sha, {
    accept: 'application/vnd.github.raw',
  });
  if (!res.ok) {
    let detail = res.status + ' ' + res.statusText;
    try { const j = await res.json(); if (j.message) detail = j.message; } catch (err) {}
    throw new Error('GitHub: ' + detail);
  }
  return res.text();
}

// Git Data API rather than the contents endpoint, which balks at ~2MB files.
async function commitFile(env, headSha, content, message) {
  const base = '/repos/' + REPO.owner + '/' + REPO.repo;
  const parent = await ghJson(env, base + '/git/commits/' + headSha);

  const blob = await ghJson(env, base + '/git/blobs', {
    method: 'POST',
    body: JSON.stringify({ content: toBase64(content), encoding: 'base64' }),
  });

  const tree = await ghJson(env, base + '/git/trees', {
    method: 'POST',
    body: JSON.stringify({
      base_tree: parent.tree.sha,
      tree: [{ path: REPO.path, mode: '100644', type: 'blob', sha: blob.sha }],
    }),
  });

  const commit = await ghJson(env, base + '/git/commits', {
    method: 'POST',
    body: JSON.stringify({ message, tree: tree.sha, parents: [headSha] }),
  });

  // force:false makes GitHub refuse the update if another save landed between
  // reading the file and writing it, so two editors never overwrite each
  // other silently.
  await ghJson(env, base + '/git/refs/heads/' + REPO.branch, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });

  return commit;
}

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
