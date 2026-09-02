# Map save endpoint

`save-worker.js` is a Cloudflare Worker that commits territory map changes to
this repo. It exists so the map page never carries a GitHub credential: editors
only need the shared password.

The Worker can only rewrite the `ZONES`, `OFFICES` and `STATE_GROUPS` lines of
`index.html`. It cannot commit anything else, so a leaked password means
someone can alter map data — not push arbitrary files to the repo.

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

## Responses

| Status | Meaning |
| --- | --- |
| 200 | Saved. Body has the commit `sha` and `url`. |
| 401 | Wrong password. |
| 403 | Request came from an origin other than the map. |
| 409 | The published map changed since the editor's page loaded. Nothing was written. |
| 400 | The submitted data was missing or malformed. Nothing was written. |
| 500 | The Worker is missing a secret. |
| 502 | GitHub rejected the request; the message says why. |
