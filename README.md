# Dovida Recruitment Territory Map

A single-page map of each Dovida office's recruitment territory across
Australia, published with GitHub Pages at
<https://dovida-stuff.github.io/team-tools/>.

- `index.html` — the whole app: Google Maps, the zone polygons, the office
  pins, suburb/postcode search, and a hidden editor. The map data lives on
  three lines near the top of the script (`OFFICES`, `ZONES`, `STATE_GROUPS`)
  and is the only part of the file that changes day to day.
- `worker/save-worker.js` — the Cloudflare Worker that commits editor changes
  back to this repo. It holds the GitHub token so the page never does. Setup
  and behaviour are in `worker/README.md`.
- `indexOLD*.html` — earlier, viewer-only versions kept for reference. They
  are served by GitHub Pages too, so delete them once nobody needs them.

## Editing the map

Open the map with `#edit` on the end of the URL, enter the editor passphrase,
and the Zone Editor panel appears. Reshape, rename, recolour or add zones and
offices, then **Save to GitHub** with the shared save password. Unsaved work is
kept as a draft in that browser and offered back next time.

The passphrase only reveals the editor and encrypts the remembered save
password on that device; anyone can read it out of the page source. The save
password on the Worker is what actually protects the repo.

## Tests

Nothing needs installing beyond Node 22. Chromium is used for the browser
checks (Playwright is expected at `/opt/node22/lib/node_modules/playwright`;
override with `PLAYWRIGHT_DIR`).

```
node --test test/*.test.mjs        # Worker unit tests against a fake GitHub API
node test/browser/run.mjs verify --html index.html   # page loads and behaves in Chromium
node test/e2e-roundtrip.mjs        # edit in Chromium -> Worker -> reload rebuilt page
```

`npm test` runs the first and the last of these.
