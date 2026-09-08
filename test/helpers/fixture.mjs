// Access to the stand-in index.html used by the Worker tests.

import { readFileSync } from 'node:fs';

const FIXTURE_URL = new URL('../fixtures/published.html', import.meta.url);

// Data line name for each request field, as the Worker and the page use them.
export const LINE_NAMES = { zones: 'ZONES', offices: 'OFFICES', states: 'STATE_GROUPS' };

/** The fixture file's text, freshly read each call so tests cannot leak mutations. */
export function publishedFixture() {
  return readFileSync(FIXTURE_URL, 'utf8');
}

/** The raw JSON text of `const NAME=<...>;` in `published`, or null when absent. */
export function lineValue(published, name) {
  const m = published.match(new RegExp('^const ' + name + '=(.*);$', 'm'));
  return m ? m[1] : null;
}

/** Fresh `{ zones, offices, states }` objects parsed out of the fixture (or `published`). */
export function fixtureData(published = publishedFixture()) {
  const out = {};
  for (const [key, name] of Object.entries(LINE_NAMES)) {
    const raw = lineValue(published, name);
    if (raw === null) throw new Error('Fixture has no ' + name + ' line');
    out[key] = JSON.parse(raw);
  }
  return out;
}

/**
 * The `basedOn` strings the page sends: each data line re-serialised through
 * JSON.stringify(JSON.parse(...)) so formatting never reads as a change.
 */
export function basedOnFor(published) {
  const out = {};
  for (const [key, name] of Object.entries(LINE_NAMES)) {
    const raw = lineValue(published, name);
    out[key] = raw === null ? null : JSON.stringify(JSON.parse(raw));
  }
  return out;
}

/** `published` with the given data lines replaced by `const NAME=<serialised>;`. */
export function withLines(published, lines) {
  let out = published;
  for (const [key, value] of Object.entries(lines)) {
    const name = LINE_NAMES[key];
    if (!name) throw new Error('Unknown data field ' + key);
    const serialised = typeof value === 'string' ? value : JSON.stringify(value);
    out = out.replace(new RegExp('^const ' + name + '=.*$', 'm'), () => 'const ' + name + '=' + serialised + ';');
  }
  return out;
}
