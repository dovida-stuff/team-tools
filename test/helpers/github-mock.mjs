// A fake of the handful of GitHub API endpoints the save Worker talks to.
//
// installGitHubMock() swaps globalThis.fetch for the fake and returns a handle
// that records every call, keeps the decoded content of every blob written,
// and can be told to fail at a particular step.

const BASE = '/repos/dovida-stuff/team-tools';

export const HEAD_SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
export const TREE_SHA = 'b2c3d4e5f60718293a4b5c6d7e8f9012345678a1';
export const COMMIT_SHA = 'c0ffee0000000000000000000000000000000001';

// Step names, in the order the Worker calls them, for use with `failAt`.
export const STEPS = ['ref', 'contents', 'parent', 'blobs', 'trees', 'commits', 'refs'];

const DEFAULT_FAILURE = { status: 422, body: { message: 'Update is not a fast forward' } };

/**
 * @param {object} opts
 * @param {string} opts.published    text served for GET /contents/index.html?ref=<head sha>
 * @param {string} [opts.failAt]     step name (see STEPS) that should fail
 * @param {{status?: number, body?: object}} [opts.failure]  what the failing step returns
 */
export function installGitHubMock({ published, failAt, failure } = {}) {
  const realFetch = globalThis.fetch;
  const fail = { ...DEFAULT_FAILURE, ...failure };
  let blobCount = 0;

  const mock = {
    calls: [],   // { step, method, path, body, headers }
    blobs: [],   // decoded UTF-8 text of each blob created
    published,
    restore() { globalThis.fetch = realFetch; },
  };

  const routes = [
    // The Worker reads the file at the head sha it just resolved; the branch
    // name is also accepted so older builds of the Worker can be exercised.
    ...['?ref=' + HEAD_SHA, '?ref=main'].map(q => ({ step: 'contents', method: 'GET', path: BASE + '/contents/index.html' + q,
      handle: (headers) => headers.get('accept') === 'application/vnd.github.raw'
        ? text(mock.published)
        : json({ type: 'file', encoding: 'base64', content: Buffer.from(mock.published, 'utf8').toString('base64') }) })),
    { step: 'ref', method: 'GET', path: BASE + '/git/ref/heads/main',
      handle: () => json({ ref: 'refs/heads/main', object: { type: 'commit', sha: HEAD_SHA } }) },
    { step: 'parent', method: 'GET', path: BASE + '/git/commits/' + HEAD_SHA,
      handle: () => json({ sha: HEAD_SHA, tree: { sha: TREE_SHA } }) },
    { step: 'blobs', method: 'POST', path: BASE + '/git/blobs',
      handle: (headers, body) => {
        if (!body || body.encoding !== 'base64' || typeof body.content !== 'string') {
          return json({ message: 'Blob body must be base64' }, 422);
        }
        mock.blobs.push(Buffer.from(body.content, 'base64').toString('utf8'));
        return json({ sha: 'blob' + String(++blobCount).padStart(36, '0') }, 201);
      } },
    { step: 'trees', method: 'POST', path: BASE + '/git/trees',
      handle: () => json({ sha: 'tree' + '0'.repeat(36) }, 201) },
    { step: 'commits', method: 'POST', path: BASE + '/git/commits',
      handle: () => json({ sha: COMMIT_SHA }, 201) },
    { step: 'refs', method: 'PATCH', path: BASE + '/git/refs/heads/main',
      handle: () => json({ ref: 'refs/heads/main', object: { sha: COMMIT_SHA } }) },
  ];

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin !== 'https://api.github.com') {
      throw new Error('GitHub mock: unexpected fetch to ' + url.href);
    }
    const method = (init.method || 'GET').toUpperCase();
    const path = url.pathname + url.search;
    const headers = new Headers(init.headers);
    let body = null;
    if (init.body != null) {
      try { body = JSON.parse(init.body); } catch (err) { body = init.body; }
    }

    const route = routes.find(r => r.method === method && r.path === path);
    const step = route ? route.step : 'unknown';
    mock.calls.push({ step, method, path, body, headers });

    if (!route) return json({ message: 'Not Found' }, 404);
    if (failAt === step) return json(fail.body, fail.status);
    return route.handle(headers, body);
  };

  return mock;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function text(str, status = 200) {
  return new Response(str, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
