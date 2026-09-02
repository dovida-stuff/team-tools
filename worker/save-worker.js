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
 * Secrets to set in the Cloudflare dashboard (Settings -> Variables):
 *   GITHUB_TOKEN    fine-grained PAT, this repo only, Contents: Read and write
 *   EDIT_PASSWORD   the password editors type on the map
 * Optional plain variable:
 *   ALLOWED_ORIGIN  defaults to https://dovida-stuff.github.io
 */

const REPO = { owner: 'dovida-stuff', repo: 'team-tools', path: 'index.html', branch: 'main' };
const DEFAULT_ORIGIN = 'https://dovida-stuff.github.io';

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

    if (typeof body.password !== 'string' || !(await sameSecret(body.password, env.EDIT_PASSWORD))) {
      return reply({ error: 'That password is not right.' }, 401, cors);
    }

    for (const f of FIELDS) {
      if (!f.isValid(body[f.key])) return reply({ error: 'The ' + f.key + ' data was missing or malformed, so nothing was saved.' }, 400, cors);
    }

    try {
      const source = await readPublishedFile(env);

      // Reject a save built on a version of the map that has since moved on.
      if (body.basedOn) {
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
        const line = new RegExp('^const ' + f.name + '=.*$', 'm');
        if (!line.test(out)) throw new Error('Could not find the ' + f.name + ' line in the published file.');
        out = out.replace(line, () => 'const ' + f.name + '=' + JSON.stringify(body[f.key]) + ';');
      }

      // A rebuild that loses most of the file means something went wrong.
      if (out.length < source.length * 0.5) {
        throw new Error('The rebuilt file was less than half the size of the published one, so it was not committed.');
      }

      const commit = await commitFile(env, out, describe(body.summary));
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

// Re-serialised so formatting differences never read as a change.
function canonical(source, name) {
  const m = source.match(new RegExp('^const ' + name + '=(.*);$', 'm'));
  if (!m) return null;
  try { return JSON.stringify(JSON.parse(m[1])); } catch (err) { return null; }
}

function describe(summary) {
  const clean = typeof summary === 'string' ? summary.replace(/[\r\n]+/g, ' ').trim().slice(0, 120) : '';
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
