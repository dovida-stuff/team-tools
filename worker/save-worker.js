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
 * Editors sign in with the shared password. The map can then remember them
 * with a 30-day token signed with that password, so changing the password
 * also cancels every remembered sign-in.
 *
 * Requests (all POST, JSON):
 *   { action: 'check', password | token, basedOn? }
 *       -> { ok, token, stale }  stale lists data that changed since basedOn
 *   { password | token, zones, offices, states, basedOn, summary, note }
 *       -> { ok, sha, url, token }  commits the new data
 *
 * Secrets to set in the Cloudflare dashboard (Settings -> Variables):
 *   GITHUB_TOKEN    fine-grained PAT, this repo only, Contents: Read and write
 *   EDIT_PASSWORD   the password editors type on the map
 * Optional plain variable:
 *   ALLOWED_ORIGIN  defaults to https://dovida-stuff.github.io
 */

const REPO = { owner: 'dovida-stuff', repo: 'team-tools', path: 'index.html', branch: 'main' };
const DEFAULT_ORIGIN = 'https://dovida-stuff.github.io';
const TOKEN_DAYS = 30;

// Each data structure and the shape it has to have to be accepted.
const FIELDS = [
  { key: 'zones', name: 'ZONES', isValid: v => Array.isArray(v) && v.length > 0 && v.length < 5000 },
  { key: 'offices', name: 'OFFICES', isValid: v => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0 },
  { key: 'states', name: 'STATE_GROUPS', isValid: v => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0 },
];

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

    if (!(await signedIn(body, env))) {
      return reply({ error: 'That password is not right.' }, 401, cors);
    }
    const token = await makeToken(env);

    // Sign-in check, and a heads-up when someone else has saved since.
    if (body.action === 'check') {
      let stale = [];
      if (body.basedOn) {
        try { stale = staleFields(await readPublishedFile(env), body.basedOn); } catch (err) { stale = []; }
      }
      return reply({ ok: true, token, stale }, 200, cors);
    }

    for (const f of FIELDS) {
      if (!f.isValid(body[f.key])) return reply({ error: 'The ' + f.key + ' data was missing or malformed, so nothing was saved.' }, 400, cors);
    }

    try {
      const source = await readPublishedFile(env);

      // Reject a save built on a version of the map that has since moved on.
      if (body.basedOn) {
        const stale = staleFields(source, body.basedOn);
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
        const line = new RegExp('^const ' + f.name + '=.*$', 'm');
        if (!line.test(out)) throw new Error('Could not find the ' + f.name + ' line in the published file.');
        out = out.replace(line, () => 'const ' + f.name + '=' + JSON.stringify(body[f.key]) + ';');
      }

      // A rebuild that loses most of the file means something went wrong.
      if (out.length < source.length * 0.5) {
        throw new Error('The rebuilt file was less than half the size of the published one, so it was not committed.');
      }

      const commit = await commitFile(env, out, describe(body.summary, body.note));
      return reply({
        ok: true,
        sha: commit.sha,
        url: 'https://github.com/' + REPO.owner + '/' + REPO.repo + '/commit/' + commit.sha,
        token,
      }, 200, cors);
    } catch (err) {
      return reply({ error: String(err.message || err) }, 502, cors);
    }
  },
};

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

async function signedIn(body, env) {
  if (typeof body.password === 'string') return sameSecret(body.password, env.EDIT_PASSWORD);
  if (typeof body.token === 'string') return validToken(body.token, env);
  return false;
}

async function hmac(key, text) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// "<expiry seconds>.<signature>", signed with the password itself.
async function makeToken(env) {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_DAYS * 86400;
  return exp + '.' + (await hmac(env.EDIT_PASSWORD, 'dovida-map-edit:' + exp));
}

async function validToken(token, env) {
  const [exp, sig] = token.split('.');
  if (!/^\d+$/.test(exp || '') || !sig || +exp < Date.now() / 1000) return false;
  return sameSecret(sig, await hmac(env.EDIT_PASSWORD, 'dovida-map-edit:' + exp));
}

function staleFields(source, basedOn) {
  return FIELDS.filter(f => {
    const was = basedOn[f.key];
    return typeof was === 'string' && was !== canonical(source, f.name);
  }).map(f => f.key);
}

// Re-serialised so formatting differences never read as a change.
function canonical(source, name) {
  const m = source.match(new RegExp('^const ' + name + '=(.*);$', 'm'));
  if (!m) return null;
  try { return JSON.stringify(JSON.parse(m[1])); } catch (err) { return null; }
}

// The editor's own note leads the commit message when there is one.
function describe(summary, note) {
  const tidy = (s, n) => (typeof s === 'string' ? s.replace(/[\r\n]+/g, ' ').trim().slice(0, n) : '');
  const what = 'Update ' + (tidy(summary, 120) || 'territory map') + ' from the map editor';
  const said = tidy(note, 200);
  return said ? said + '\n\n' + what : what;
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

async function readPublishedFile(env) {
  const base = '/repos/' + REPO.owner + '/' + REPO.repo;
  const res = await github(env, base + '/contents/' + REPO.path + '?ref=' + REPO.branch, {
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
async function commitFile(env, content, message) {
  const base = '/repos/' + REPO.owner + '/' + REPO.repo;
  const head = await ghJson(env, base + '/git/ref/heads/' + REPO.branch);
  const headSha = head.object.sha;
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
