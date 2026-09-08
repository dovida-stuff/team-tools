# Browser smoke test

Drives `index.html` in headless Chromium (Playwright) with a fake `google.maps`
so the map, sidebar, search and the zone editor can be exercised offline. The
real file on disk is never touched: a throwaway http server serves it with three
in-memory rewrites (Maps script -> `google-maps-stub.js`, `EDIT_PASS_HASH` ->
sha256 of `test-pass`, `SAVE_ENDPOINT` -> the server's own `POST /save`).

Requires Node 22 and Playwright at `/opt/node22/lib/node_modules/playwright`
(override with `PLAYWRIGHT_DIR=...`) with Chromium already installed under
`PLAYWRIGHT_BROWSERS_PATH`. Nothing is installed by the test.

## Verify the viewer

```
node test/browser/run.mjs verify --html index.html
node test/browser/run.mjs verify --html index.html --expect-name 'Zone <img src=x onerror=alert(1)> tail'
```

Loads `/index.html`, then checks data shape, sidebar count vs `STATE_GROUPS`,
polygon count vs drawable zones, postcode search (`4000`), polygon hover/click
via `google.maps.event.trigger`, and an XSS canary (no `img[src="x"]`, title
unchanged). With `--expect-name` it also asserts a zone with exactly that name
exists and that the rendered HTML never contains a raw `<img`.

## Exercise the editor and capture the save payload

```
node test/browser/run.mjs edit --html index.html --out /tmp/payload.json
node test/browser/run.mjs edit --html index.html --out /tmp/payload.json --name 'New zone name'
```

Loads `/index.html#edit`, answers the passphrase prompt with `test-pass`,
selects the first polygon, renames it (default name is a hostile
`Zone </script><img src=x onerror=alert(1)> tail`), enters the save password
`worker-pass` (without remembering it), saves, and writes the JSON the page
POSTed to `--out`. Asserts the payload shape (`password`, `zones`, `offices`,
`states`, `basedOn.zones`), that the renamed zone is present, and that
`#edit-note` reports "Saved".

Both modes print a JSON summary (`passed`, `failed`, per-check detail) and exit
0 on success, 1 on any failure. Any `pageerror`, console error, failed request
or unexpected dialog is a failure.
