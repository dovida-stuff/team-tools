# Map save endpoint

`save-worker.js` is a Cloudflare Worker that commits territory map changes to
this repo. It exists so the map page never carries a GitHub credential: editors
only need the shared password.

The Worker can only rewrite the `ZONES`, `OFFICES` and `STATE_GROUPS` lines of
`index.html`. It cannot commit anything else, so a leaked password means
someone can alter map data — not push arbitrary files to the repo.

Before anything is written the Worker checks that every zone, office and state
group has the shape the map expects (names, `#rrggbb` colours, latitude and
longitude in range, office codes that exist, no reserved object keys, sensible
sizes) and writes the JSON with `<`, `>`, `&` and the Unicode line separators
escaped. A zone or office name therefore cannot close the page's `<script>`
tag, inject HTML into visitors' browsers, or break the next save.

Each save is pinned to the commit it read: the file is fetched at that exact
commit and the new commit names it as parent without forcing, so two editors
saving at the same moment get an error rather than one silently overwriting
the other.

## One-time setup

1. Sign in at <https://dash.cloudflare.com> (a free account is enough).
2. **Compute** (or **Workers & Pages**) → **Create** → **Start with Hello World** → **Deploy**.
   Name it something like `dovida-map-save`.
3. Open the new Worker → **Edit code**. Delete what's there, paste the whole of
   `save-worker.js`, then **Deploy**.
4. Go to the Worker's **Settings → Variables and Secrets** and add two
   **secrets** (not plain text variables):

   | Name | Value |
   | --- | --- |
   | `GITHUB_TOKEN` | A fine-grained personal access token, **this repository only**, with **Contents: Read and write** |
   | `EDIT_PASSWORD` | The password editors will type on the map |

5. Copy the Worker URL — it looks like
   `https://dovida-map-save.<your-subdomain>.workers.dev`.

## Checking it works

Open the Worker URL in a browser. It should return:

```json
{"ok":true,"service":"dovida-map-save","repo":"dovida-stuff/team-tools",
 "configured":{"token":true,"password":true}}
```

Both `configured` values must be `true`. If either is `false`, the secret with
that name is missing or misspelled.

This endpoint is deliberately harmless: it reports only whether the secrets
exist, never their values.

## Day-to-day

- **Change the password** — update `EDIT_PASSWORD` in the dashboard. Everyone is
  locked out immediately; no change to the map file is needed.
- **Rotate the GitHub token** — update `GITHUB_TOKEN`. Nobody else notices.
- **Turn saving off** — delete the Worker, or clear its secrets. The map itself
  keeps working; only saving stops.

## Recommended extra protection

The shared password is the only thing standing between the internet and the
map data, and the Worker itself does not throttle guesses. Two cheap
safeguards in the Cloudflare dashboard:

- **Rate limiting** — Security → WAF → Rate limiting rules: limit `POST` to the
  Worker's hostname to a handful of requests per minute per IP. A real editor
  saves a few times an hour; a password-guessing script needs thousands.
- **A long password** — a random 20+ character string. Editors can tick
  "Remember on this device" so they only type it once per browser.

The Google Maps key in `index.html` is public by nature. In Google Cloud
Console restrict it to the HTTP referrer `https://dovida-stuff.github.io/*`
and to the Maps JavaScript API only, so it is useless anywhere else.

## Testing

`node --test test/*.test.mjs` runs the Worker against a fake GitHub API
(no network, no token). `node test/e2e-roundtrip.mjs` drives the real
`index.html` in headless Chromium, saves through the Worker with GitHub faked,
and reloads the rebuilt page to check it still works. See the repo README.

## Responses

| Status | Meaning |
| --- | --- |
| 200 | Saved. Body has the commit `sha` and `url`. |
| 401 | Wrong password. |
| 403 | A browser on a site other than the map tried to save. (Non-browser clients send no Origin header, so this is a courtesy, not a security boundary; the password is.) |
| 409 | The published map changed since the editor's page loaded. Nothing was written. |
| 400 | The submitted data was missing or malformed; the message says which zone or office. Nothing was written. |
| 500 | The Worker is missing a secret. |
| 502 | GitHub rejected the request; the message says why. Also returned when another save landed a moment earlier (the commit is not a fast-forward) — reload and try again. |
