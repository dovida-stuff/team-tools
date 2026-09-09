// Tests for worker/save-worker.js, run with `node --test test/`.
//
// Every GitHub call goes through the fake in helpers/github-mock.mjs, which is
// installed before each test so nothing here can reach the network.
//
// Tests titled "[NEW BEHAVIOUR]" cover the hardening added in the security
// review (escaping, schema validation, limits); the rest is original behaviour.

import { describe, it, beforeEach, afterEach, mock as nodeMock } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../worker/save-worker.js';
import { installGitHubMock, COMMIT_SHA } from './helpers/github-mock.mjs';
import { publishedFixture, fixtureData, basedOnFor, lineValue, withLines } from './helpers/fixture.mjs';

const ENDPOINT = 'https://dovida-map-save.example.workers.dev/';
const DEFAULT_ORIGIN = 'https://dovida-stuff.github.io';
const PASSWORD = 'correct horse battery staple';
const TOKEN = 'github_pat_TESTTOKEN_0123456789';
const WRITE_STEPS = ['blobs', 'trees', 'commits', 'refs'];

/* ---------- harness ---------- */

function env(overrides = {}) {
  return { GITHUB_TOKEN: TOKEN, EDIT_PASSWORD: PASSWORD, ...overrides };
}

/** A complete, valid save request body built from the fixture data. */
function validBody(overrides = {}) {
  return { password: PASSWORD, ...fixtureData(), ...overrides };
}

function request(method, { body, headers } = {}) {
  const init = { method, headers };
  if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body);
  return new Request(ENDPOINT, init);
}

async function send(method, { body, headers, env: e = env() } = {}) {
  const res = await worker.fetch(request(method, { body, headers }), e);
  let json = null;
  const text = await res.text();
  try { json = JSON.parse(text); } catch (err) {}
  return { status: res.status, json, text, headers: res.headers };
}

function post(body, opts = {}) {
  return send('POST', { ...opts, body, headers: { 'Content-Type': 'application/json', ...opts.headers } });
}

let gh = null;

/** (Re)install the GitHub fake, serving the fixture unless `published` is given. */
function github(opts = {}) {
  if (gh) gh.restore();
  gh = installGitHubMock({ published: publishedFixture(), ...opts });
  return gh;
}

function steps() { return gh.calls.map(c => c.step); }
function writeSteps() { return steps().filter(s => WRITE_STEPS.includes(s)); }

/** `obj` with an extra own property `key`, even for names like __proto__. */
function withKey(obj, key, value) {
  const json = JSON.stringify(obj);
  return JSON.parse(json.slice(0, -1) + ',' + JSON.stringify(key) + ':' + JSON.stringify(value) + '}');
}

beforeEach(() => { github(); });
afterEach(() => { if (gh) gh.restore(); gh = null; });

/* ---------- CORS and HTTP methods ---------- */

describe('CORS and HTTP methods', () => {
  it('answers OPTIONS with 204 and the default allowed origin', async () => {
    const r = await send('OPTIONS', { headers: { Origin: DEFAULT_ORIGIN } });
    assert.equal(r.status, 204);
    assert.equal(r.headers.get('Access-Control-Allow-Origin'), DEFAULT_ORIGIN);
    assert.equal(r.text, '');
  });

  it('answers OPTIONS with the ALLOWED_ORIGIN variable when one is set', async () => {
    const r = await send('OPTIONS', { env: env({ ALLOWED_ORIGIN: 'https://maps.example' }) });
    assert.equal(r.status, 204);
    assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://maps.example');
  });

  it('answers GET with a 200 status report saying whether each secret is configured', async () => {
    const r = await send('GET');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('Content-Type'), /application\/json/);
    assert.equal(r.json.ok, true);
    assert.deepEqual(r.json.configured, { token: true, password: true });
  });

  it('reports missing secrets on GET as false flags', async () => {
    const r = await send('GET', { env: {} });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.configured, { token: false, password: false });
  });

  it('never includes the secret values in the GET report', async () => {
    const r = await send('GET');
    assert.ok(!r.text.includes(TOKEN), 'token leaked');
    assert.ok(!r.text.includes(PASSWORD), 'password leaked');
  });

  it('rejects PUT with 405', async () => {
    const r = await send('PUT', { body: validBody() });
    assert.equal(r.status, 405);
    assert.equal(gh.calls.length, 0);
  });

  it('rejects a POST from a foreign origin with 403 before touching GitHub', async () => {
    const r = await post(validBody(), { headers: { Origin: 'https://evil.example' } });
    assert.equal(r.status, 403);
    assert.equal(gh.calls.length, 0);
  });

  it('accepts a POST from the allowed origin', async () => {
    const r = await post(validBody(), { headers: { Origin: DEFAULT_ORIGIN } });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('Access-Control-Allow-Origin'), DEFAULT_ORIGIN);
  });

  it('accepts a POST from a configured ALLOWED_ORIGIN and rejects the default one', async () => {
    const custom = env({ ALLOWED_ORIGIN: 'https://maps.example' });
    const ok = await post(validBody(), { headers: { Origin: 'https://maps.example' }, env: custom });
    assert.equal(ok.status, 200);
    const no = await post(validBody(), { headers: { Origin: DEFAULT_ORIGIN }, env: custom });
    assert.equal(no.status, 403);
  });

  it('accepts a POST with no Origin header', async () => {
    const r = await post(validBody());
    assert.equal(r.status, 200);
  });
});

/* ---------- request validation ---------- */

describe('request validation', () => {
  it('returns 500 when GITHUB_TOKEN is missing', async () => {
    const r = await post(validBody(), { env: env({ GITHUB_TOKEN: undefined }) });
    assert.equal(r.status, 500);
    assert.equal(gh.calls.length, 0);
  });

  it('returns 500 when EDIT_PASSWORD is missing', async () => {
    const r = await post(validBody(), { env: env({ EDIT_PASSWORD: '' }) });
    assert.equal(r.status, 500);
    assert.equal(gh.calls.length, 0);
  });

  it('returns 400 for a body that is not valid JSON', async () => {
    const r = await post('{"password": "' + PASSWORD + '", "zones": [');
    assert.equal(r.status, 400);
    assert.equal(gh.calls.length, 0);
  });

  it('returns 401 for a wrong password', async () => {
    const r = await post(validBody({ password: 'not it' }));
    assert.equal(r.status, 401);
    assert.equal(gh.calls.length, 0);
  });

  it('returns 401 for an empty password', async () => {
    const r = await post(validBody({ password: '' }));
    assert.equal(r.status, 401);
  });

  it('returns 401 for a very long wrong password', async () => {
    const r = await post(validBody({ password: 'x'.repeat(20000) }));
    assert.equal(r.status, 401);
  });

  it('returns 401 for a password that is not a string', async () => {
    const r = await post(validBody({ password: [PASSWORD] }));
    assert.equal(r.status, 401);
  });

  it('proceeds with the correct password', async () => {
    const r = await post(validBody());
    assert.equal(r.status, 200);
  });

  const malformed = [
    ['zones missing', { zones: undefined }],
    ['zones empty', { zones: [] }],
    ['zones not an array', { zones: 'ADE 1' }],
    ['zones an object', { zones: { name: 'ADE 1' } }],
    ['offices missing', { offices: undefined }],
    ['offices empty', { offices: {} }],
    ['offices an array', { offices: [{ name: 'Adelaide' }] }],
    ['offices a string', { offices: 'ADE' }],
    ['states missing', { states: undefined }],
    ['states empty', { states: {} }],
    ['states an array', { states: [['ADE']] }],
    ['states null', { states: null }],
  ];
  for (const [title, overrides] of malformed) {
    it('returns 400 and makes no GitHub calls when ' + title, async () => {
      const r = await post(validBody(overrides));
      assert.equal(r.status, 400);
      assert.equal(gh.calls.length, 0);
    });
  }
});

/* ---------- conflict detection ---------- */

describe('conflict detection', () => {
  it('returns 409 naming zones when basedOn.zones differs from the published line', async () => {
    const other = fixtureData().zones.slice(0, 1);
    const basedOn = { ...basedOnFor(gh.published), zones: JSON.stringify(other) };
    const r = await post(validBody({ basedOn }));
    assert.equal(r.status, 409);
    assert.deepEqual(r.json.stale, ['zones']);
    assert.equal(r.json.error, 'conflict');
    assert.deepEqual(writeSteps(), []);
    assert.deepEqual(steps(), ['ref', 'contents']);
  });

  it('returns 409 naming every stale field', async () => {
    const basedOn = { ...basedOnFor(gh.published), offices: '{"ADE":{}}', states: '{"SA":[]}' };
    const r = await post(validBody({ basedOn }));
    assert.equal(r.status, 409);
    assert.deepEqual(r.json.stale, ['offices', 'states']);
    assert.deepEqual(writeSteps(), []);
  });

  it('proceeds when basedOn matches the published data', async () => {
    const r = await post(validBody({ basedOn: basedOnFor(gh.published) }));
    assert.equal(r.status, 200);
  });

  it('proceeds when basedOn is absent', async () => {
    const r = await post(validBody());
    assert.equal(r.status, 200);
  });
});

/* ---------- committing ---------- */

describe('committing', () => {
  it('commits through the Git Data API in order and reports the commit', async () => {
    const body = validBody({ summary: 'Moved ADE 1 north' });
    const r = await post(body);
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
    assert.equal(r.json.sha, COMMIT_SHA);
    assert.equal(r.json.url, 'https://github.com/dovida-stuff/team-tools/commit/' + COMMIT_SHA);

    assert.deepEqual(steps(), ['ref', 'contents', 'parent', 'blobs', 'trees', 'commits', 'refs']);

    const refPatch = gh.calls.find(c => c.step === 'refs');
    assert.equal(refPatch.method, 'PATCH');
    assert.deepEqual(refPatch.body, { sha: COMMIT_SHA, force: false });

    const tree = gh.calls.find(c => c.step === 'trees').body;
    assert.deepEqual(tree.tree.map(t => t.path), ['index.html']);
  });

  it('writes the published file with only the three data lines replaced', async () => {
    const body = validBody();
    body.zones[0].name = 'ADE 1 (renamed)';
    body.offices.GC.color = '#123456';
    body.states.NSW = [];
    const r = await post(body);
    assert.equal(r.status, 200);
    assert.equal(gh.blobs.length, 1);

    const expected = withLines(gh.published, { zones: body.zones, offices: body.offices, states: body.states });
    assert.equal(gh.blobs[0], expected);
    assert.equal(lineValue(gh.blobs[0], 'ZONES'), JSON.stringify(body.zones));
    assert.equal(lineValue(gh.blobs[0], 'OFFICES'), JSON.stringify(body.offices));
    assert.equal(lineValue(gh.blobs[0], 'STATE_GROUPS'), JSON.stringify(body.states));
  });

  it('builds the commit message from the summary, stripping newlines and truncating to 120 characters', async () => {
    const summary = 'Moved ADE 1\r\nnorth\nand ' + 'x'.repeat(200);
    const r = await post(validBody({ summary }));
    assert.equal(r.status, 200);
    const clean = summary.replace(/[\r\n]+/g, ' ').trim().slice(0, 120);
    const commit = gh.calls.find(c => c.step === 'commits').body;
    assert.equal(commit.message, 'Update ' + clean + ' from the map editor');
    assert.equal(commit.message.length, 'Update  from the map editor'.length + 120);
    assert.doesNotMatch(commit.message, /[\r\n]/);
  });

  it('uses a default commit message when no summary is given', async () => {
    const r = await post(validBody());
    assert.equal(r.status, 200);
    const commit = gh.calls.find(c => c.step === 'commits').body;
    assert.equal(commit.message, 'Update territory map from the map editor');
  });

  it('returns 502 carrying the GitHub message when the final ref update is rejected', async () => {
    github({ failAt: 'refs', failure: { status: 422, body: { message: 'Update is not a fast forward' } } });
    const r = await post(validBody());
    assert.equal(r.status, 502);
    assert.match(r.json.error, /Update is not a fast forward/);
    assert.equal(steps().at(-1), 'refs');
  });

  it('returns 502 and never commits when the rebuilt file would be under half the published size', async () => {
    const big = fixtureData();
    big.zones = [{ ...big.zones[0], coords: Array(2000).fill([-34.8, 138.5]) }];
    github({ published: withLines(publishedFixture(), { zones: big.zones }) });

    const r = await post(validBody());
    assert.equal(r.status, 502);
    assert.match(r.json.error, /half/);
    assert.deepEqual(steps(), ['ref', 'contents']);
    assert.ok(!steps().includes('commits') && !steps().includes('refs'));
  });
});

/* ---------- hardening the Worker does not do yet ---------- */

describe('[NEW BEHAVIOUR] script-safe serialisation', () => {
  const XSS_NAME = 'Zone </script><img src=x onerror=alert(1)>';
  const SEPARATOR_NAME = 'Surf & Turf\u2028North\u2029';

  function riskyZones() {
    const { zones } = fixtureData();
    zones[0].name = XSS_NAME;
    zones[1].name = SEPARATOR_NAME;
    return zones;
  }

  it('[NEW BEHAVIOUR] accepts a zone name containing </script> but escapes it in the committed file', async () => {
    const body = validBody({ zones: riskyZones() });
    const r = await post(body);
    assert.equal(r.status, 200);
    assert.equal(gh.blobs.length, 1);

    const file = gh.blobs[0];
    const line = lineValue(file, 'ZONES');
    assert.ok(line, 'ZONES line present');
    assert.ok(!line.includes('</script>'), 'literal </script> must not appear in the ZONES line');
    assert.doesNotMatch(line, /[<>&\u2028\u2029]/, 'no raw <, >, &, U+2028 or U+2029 in the ZONES line');
    assert.match(line, /\\u003c\/script\\u003e/i);
    assert.match(line, /\\u0026/i);
    assert.match(line, /\\u2028/i);
    assert.match(line, /\\u2029/i);

    // The escaping is only a serialisation choice: the data survives intact.
    const parsed = JSON.parse(line);
    assert.deepEqual(parsed.map(z => z.name), [XSS_NAME, SEPARATOR_NAME]);
    assert.deepEqual(parsed, body.zones);

    // Everything outside the ZONES line is untouched.
    const expected = withLines(gh.published, { zones: line, offices: body.offices, states: body.states });
    assert.equal(file, expected);
  });

  it('[NEW BEHAVIOUR] does not report a save stale when basedOn matches the escaped published line', async () => {
    const zones = riskyZones();
    const first = await post(validBody({ zones }));
    assert.equal(first.status, 200);
    const committed = gh.blobs[0];

    github({ published: committed });
    const { offices, states } = fixtureData();
    const basedOn = {
      zones: JSON.stringify(zones),
      offices: JSON.stringify(offices),
      states: JSON.stringify(states),
    };
    const second = await post(validBody({ zones, basedOn }));
    assert.notEqual(second.status, 409, 'canonical comparison must survive the escaping');
    assert.equal(second.status, 200);
  });
});

describe('[NEW BEHAVIOUR] schema validation', () => {
  const office = { name: 'Perth', color: '#abc', lat: -31.9, lng: 115.9, address: '1 St Georges Tce, Perth WA' };

  const cases = [
    ['a zone with no name', d => { delete d.zones[0].name; }],
    ['a zone whose name is not a string', d => { d.zones[0].name = 42; }],
    ['a zone whose office is not a string', d => { d.zones[0].office = ['ADE']; }],
    ['a zone with fewer than 4 coordinate pairs', d => { d.zones[0].coords = d.zones[0].coords.slice(0, 3); }],
    ['a coordinate that is not [number, number]', d => { d.zones[0].coords[1] = ['-34.7', 138.6]; }],
    ['a coordinate with only one number', d => { d.zones[0].coords[1] = [-34.7]; }],
    ['a coordinate that is an object', d => { d.zones[0].coords[1] = { lat: -34.7, lng: 138.6 }; }],
    ['a latitude below -90', d => { d.zones[0].coords[1] = [-134.7, 138.6]; }],
    ['a latitude above 90', d => { d.zones[0].coords[1] = [91, 138.6]; }],
    ['a zone fill that is not #rrggbb', d => { d.zones[0].fill = 'red'; }],
    ['a zone fill using the short #rgb form', d => { d.zones[0].fill = '#f00'; }],
    ['a zone referencing an office code that is not in offices', d => { d.zones[0].office = 'PER'; }],
    ['an office with no name', d => { delete d.offices.ADE.name; }],
    ['an office whose name is not a string', d => { d.offices.ADE.name = ['Adelaide']; }],
    ['an office colour that is neither #rrggbb nor #rgb', d => { d.offices.ADE.color = 'blue'; }],
    ['an office colour with the wrong number of digits', d => { d.offices.ADE.color = '#00a2f'; }],
    ['an office lat that is not a number', d => { d.offices.ADE.lat = '-34.9'; }],
    ['an office lat that is null', d => { d.offices.ADE.lat = null; }],
    ['an office lng that is not a number', d => { d.offices.ADE.lng = true; }],
    ['an office address that is not a string', d => { d.offices.ADE.address = { line1: '1 King William St' }; }],
    ['a state group that is not an array', d => { d.states.SA = 'ADE'; }],
    ['a state group containing a non-string', d => { d.states.SA = [{ code: 'ADE' }]; }],
    ['a state group listing a code that is not in offices', d => { d.states.SA = ['ADE', 'PER']; }],
    ['an office keyed __proto__', d => { d.offices = withKey(d.offices, '__proto__', office); }],
    ['an office keyed constructor', d => { d.offices = withKey(d.offices, 'constructor', office); }],
    ['an office keyed prototype', d => { d.offices = withKey(d.offices, 'prototype', office); }],
    ['a state keyed __proto__', d => { d.states = withKey(d.states, '__proto__', ['ADE']); }],
    ['a state keyed constructor', d => { d.states = withKey(d.states, 'constructor', ['ADE']); }],
    ['an office keyed toString (inherited from Object.prototype)', d => { d.offices = withKey(d.offices, 'toString', office); }],
    ['an office keyed hasOwnProperty (inherited from Object.prototype)', d => { d.offices = withKey(d.offices, 'hasOwnProperty', office); }],
    ['an office keyed __defineGetter__ (inherited from Object.prototype)', d => { d.offices = withKey(d.offices, '__defineGetter__', office); }],
    ['an office code ending in _secondary (the satellite-pin slot suffix)', d => { d.offices = withKey(d.offices, 'ADE_secondary', office); }],
    ['a state keyed valueOf (inherited from Object.prototype)', d => { d.states = withKey(d.states, 'valueOf', ['ADE']); }],
    ['an office field named toString', d => { d.offices.ADE.toString = 'x'; }],
    ['an unknown office field large enough to bloat the file', d => { d.offices.ADE.blob = 'x'.repeat(1000001); }],
    ['an unknown satellite field large enough to bloat the file', d => { d.offices.ADE.secondaryLocations = [{ lat: -34.9, lng: 138.6, blob: 'x'.repeat(1000001) }]; }],
    ['a states object large enough to bloat the file', d => { d.states.QLD = ['GC', ...Array.from({ length: 30000 }, () => 'ADE')]; }],
    ['a state keyed prototype', d => { d.states = withKey(d.states, 'prototype', ['ADE']); }],
  ];

  for (const [title, mutate] of cases) {
    it('[NEW BEHAVIOUR] returns 400 and makes no GitHub calls for ' + title, async () => {
      const data = fixtureData();
      mutate(data);
      const r = await post({ password: PASSWORD, ...data });
      assert.equal(r.status, 400);
      assert.equal(gh.calls.length, 0);
    });
  }

  it('[NEW BEHAVIOUR] returns 400 for a zone label of 1e999, which JSON.parse reads as Infinity', async () => {
    const data = fixtureData();
    data.zones[0].label = '__INF__';
    const raw = JSON.stringify({ password: PASSWORD, ...data }).replace('"__INF__"', '1e999');
    const r = await post(raw);
    assert.equal(r.status, 400);
    assert.equal(gh.calls.length, 0);
  });

  it('still accepts well-formed data, including a #rgb office colour and a #rrggbb zone fill', async () => {
    const data = fixtureData();
    data.offices.PER = office;
    data.states.WA = ['PER'];
    data.zones[0].fill = '#2dc653';
    const r = await post({ password: PASSWORD, ...data });
    assert.equal(r.status, 200);
  });
});

describe('[NEW BEHAVIOUR] request limits', () => {
  it('[NEW BEHAVIOUR] rejects a password longer than 256 characters with 401 without hashing it', async () => {
    const long = 'p'.repeat(257);
    const digest = nodeMock.method(globalThis.crypto.subtle, 'digest');
    try {
      // Even the "right" password is refused once it is over the limit.
      const r = await post(validBody({ password: long }), { env: env({ EDIT_PASSWORD: long }) });
      assert.equal(r.status, 401);
      assert.equal(digest.mock.callCount(), 0, 'the password must not be hashed');
      assert.equal(gh.calls.length, 0);
    } finally {
      digest.mock.restore();
    }
  });

  it('[NEW BEHAVIOUR] rejects a zones payload over 6,000,000 characters with 400 before touching GitHub', async () => {
    const pair = '[-34.8,138.5]';
    const pairs = Math.ceil(6_000_000 / (pair.length + 1)) + 100;
    const coords = new Array(pairs).fill(pair).join(',');
    const zonesText = '[{"name":"Huge","folder":"SA","office":"ADE","coords":[' + coords + ']}]';
    assert.ok(zonesText.length > 6_000_000);

    const { offices, states } = fixtureData();
    const bodyText = '{"password":' + JSON.stringify(PASSWORD)
      + ',"zones":' + zonesText
      + ',"offices":' + JSON.stringify(offices)
      + ',"states":' + JSON.stringify(states) + '}';

    const r = await post(bodyText);
    assert.equal(r.status, 400);
    assert.equal(gh.calls.length, 0);
  });
});
