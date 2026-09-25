# 01 — Assessment of the handover bundle

Scope: `prototype-source/` as received on 25 September 2026 (all 84 files match
`SOURCE_SHA256.txt`). This comes from reading the source, not from running it:
the project depends on Cloudflare and Vinext and was not built. Line references
point into `prototype-source/app/prototype.tsx` unless another file is named.

## What the bundle is

- A single-page React prototype. All behaviour is in one 4,245-line client
  component (`app/prototype.tsx`). `app/page.tsx` and `app/layout.tsx` only
  mount it. `components/ui/*` are stock shadcn components.
- Storage is one JSON document in one Cloudflare D1 row (`db/schema.ts`,
  `app/api/state/route.ts`). The browser autosaves the whole app state 600 ms
  after any change (`:1102-1134`).
- There are no Power Apps, Dataverse or Power Automate artefacts: no `.msapp`,
  no solution zip, no flow definitions. The "Power Automate" screen is a mock-up
  (see below).

## What is real behaviour, and worth keeping as requirements

These are implemented as working logic, not just screens. Treat them as the
behavioural spec.

| Area | Behaviour | Where |
|---|---|---|
| Data model | Application has candidate, contact, type (Caregiver / Key player), role, office, recruiter, source, intake, stage, requirement list, readiness, risk, outcome reason, DNS flag, notes | `:94-116` |
| Stages | Linear path: Background checks → Offer stage → Contract issued → Contract signed → Onboarded. On hold and Withdrawn sit outside it. "Active" means the first four. | `:140-146`, `:855-857` |
| Requirement states | Complete / In progress / Not started / Waived. Complete and Waived both count as cleared. | `:66`, `:911-913` |
| Readiness | cleared ÷ all requirements × 100. Optional items count toward the total. | `:911-917`, `:2139-2147` |
| Stage gate | Advance is blocked while any *required* item is not cleared, **only when leaving Background checks** | `:928-936` |
| Outcomes | On hold reasons (4) and Withdrawn reasons (5). "Did not start" sets the DNS flag. | `:1014-1033`, `:1745-1760` |
| Two workflows | Separate, ordered, show/hide-able column lists for Caregiver and Key Player. Each column has a label, category (Identity / Process / Compliance / Outcome), and field type (dropdown with options, or free text). | `:602-687`, `:3645-4020` |
| Checklist generation | A new candidate gets one requirement per visible non-core workflow column. It is required if its category is Compliance. | `:951-1013` |
| Inline grid | Pipeline table per candidate type, filtered by search / stage / office. Every cell except the name is editable. | `:2174-2468` |
| Site requirements | Rows of global requirement text × offices. Each office inherits the standard text unless it has its own variation. Rows can be added, renamed, removed and reordered. Also a per-office lookup view. Information only: it does **not** feed checklists. | `:3037-3469`, `:1694-1700`, `:2682-2683` |
| Intakes | Name, orientation date, requested places, open/closed. Assigned / ready (≥80%) / hired counts come from applications. Rollover moves anyone under 80% to the next *open* intake in list order. | `:2791-3035` |
| Reports | Hires, withdrawal rate, average readiness, intake fill rate, withdrawal-reason counts and the office comparison are all calculated from the records | `:4022-4245` |

## What is simulated or hard-coded (do not carry across as fact)

- **Automations screen** (`:3471-3643`): the five "flows", their run counts,
  "last ran" times, the day's 38-action total and the "recent exception" are all
  literals. "Run now" just increments a counter. No flow exists.
- **Overview**: the date "Tuesday, 6 September" (`:1828`), the intake readiness
  panel (`:1948-1952`, ignores the real intakes), the "Rolling 3-month
  conversion" chart (`:2004-2047`) and the "Automation pulse" (`:1981-1995`)
  are all literals.
- **Reports**: the Apr–Sep trend is hard-coded, apart from the August "hired"
  bar, which is today's onboarded count (`:4111-4118`). The office dropdown in
  the header has no state and filters nothing (`:4063`).
- **Stage history tab** (`:2749-2753`): always the same three events, dated
  from the application date. Nothing is recorded, although the advance message
  says "Stage history and notifications updated" (`:947`).
- **Other confirmation messages with nothing behind them**: "Outcome reporting
  updated" (`:1031`), "Intake capacity updated" (`:1544`), "Recruiter reminders
  are queued" (`:2970`), and the bell's "5 reminders are due today"
  (`:1470-1473`).
- **Grid values that are made up** when no one has entered anything
  (`:2080-2092`): Pay level (from whether the ID is odd or even), Training,
  Contract start (fixed at 14 Sep 2026), Rehire/transfer, Onboarding, File sent,
  Contract accepted, Email sent to HM, and a "Follow-up required" note.
  Zone reads a hard-coded office list (`:2067`), so it would ignore office edits.
- **Persona selector** (`:1415-1424`): cosmetic. Every persona can do
  everything.
- **Risk** (Clear / Due soon / Blocked) is never calculated. Seed values stay
  as they are, a requirement change can only set it to Clear (`:918`), and
  advancing always resets it to Clear (`:942`). **Days in stage** never counts
  up.
- **Seed data**: 18 applications, 6 offices, 4 recruiters, 5 sources and 4
  intakes are all synthetic. Recruiter and source lists are hard-coded in two
  places each (`:1655-1658`, `:1686-1690`, `:2190-2199`). There is no screen to
  add or rename offices. Office `active` / `readiness` / `exceptions` figures
  (`:520-575`) are never displayed.
- **Browser agent tools** (`:1136-1340`): registers `document.modelContext`
  tools for AI browser agents. This is prototype-only and has no Power Platform
  equivalent to build.

## Defects and gaps to fix rather than copy

Ordered by how much they would matter in production.

1. **The grid bypasses the stage gate.** The Status column offers every stage
   (`:2189`) and writes it straight to the record (`:2116`). You can go from
   Background checks to Onboarded with required checks open, or to Withdrawn
   with no reason. Days in stage is not reset either.
2. **The gate only applies to one transition.** Advancing from Offer stage
   onwards is never checked (`:933`). Seed Key Player *Priya Shah* is at
   Contract issued while her required "Contract acceptance" is still in
   progress. That would be impossible under an all-required-before-Offer rule,
   so gates must be set per step.
3. **A value that isn't blank counts as Complete.** In both the candidate page
   (`:904-908`) and the grid (`:2132-2136`), any value outside the four standard
   states marks the requirement Complete. For example, "No" on a Yes/No
   dropdown, or a note like "waiting on referee", both clear the requirement and
   raise readiness.
4. **Grid and candidate page don't share storage for most steps.** Only 11
   known compliance columns (`:2097-2109`) are linked to requirement rows, and
   only by substring match on the name. Every other step, including any
   custom step added in Workflows, is saved in `trackingValues` from the grid
   (`:2150-2153`) but in `requirements` from the candidate page. Neither side
   ever sees the other's edits.
5. **Outcome reason can be wrong.** The reason defaults to "Candidate requested
   more time" (`:841`) and doesn't reset when you switch the outcome to
   Withdrawn. The dropdown then *shows* "Candidate withdrew", but saving
   records the On hold reason against a withdrawal.
6. **On hold is a dead end.** "Advance stage" is enabled for On hold but does
   nothing and shows no message (`:929`, `:937`). The only way back into
   progress is the unguarded grid. Onboarded and Withdrawn records can still be
   given a new outcome.
7. **Checklist generation is inconsistent** (`:968-980`):
   - "BGC started", "Pay level", "Rehire / transfer" and "Contract start" are
     data fields, but they become checklist items.
   - "Orientation / intake" becomes a checklist item even though the grid
     treats it as the intake assignment.
   - "Stat dec" is *required* for new candidates (Compliance category) but
     optional in the seed data.
   - Steps added or un-hidden later never reach existing candidates.
   - Office site requirements are never applied.
8. **Last save wins and fails silently.** Every save overwrites the whole
   dataset (`route.ts:32-40`) with no version check. Two people editing at once
   will lose each other's work. After one failed save the app switches to
   "Session only" and stops saving (`:1103`, `:1123`). The API has no auth or
   field validation.
9. **Intakes are keyed by display name.** You can't rename one, duplicates are
   allowed (`:2841-2847`), the date is free text, and rollover picks the "next"
   intake by list position rather than date (`:2821-2824`). Rollover also moves
   On hold records.
10. Smaller: dates are display strings with no year (e.g. `due: '10 Sep'`);
    new candidates get a made-up email and phone and a fixed applied date
    (`:991-1001`); the agent tool that completes a requirement doesn't
    recalculate readiness (`:1281-1292`); if a stored payload lacks the column
    lists, the pipeline would crash on load (`:1046-1047`); "Use default" on a
    site requirement copies the standard text into the office
    (`:3368-3373`). If the standard text changes later, that office shows a
    "Variation" instead of following the new standard.
11. **Seed quirk in site requirements:** "Banning register" and "Reference
    check" are missing from every office's `rules` list, so all six offices
    show "Not required for this office" for them (`:3066-3068`,
    `:520-575`). This is almost certainly demo data, not a rule.
    `seed-data/office-site-requirement-variations.csv` reproduces it exactly
    and should be reviewed before import.

## What this means for the Power Platform build

- Reuse: the entity shapes, stage model, requirement states, outcome reasons,
  the two workflow definitions, the site-requirement inheritance model, intake
  maths, the report definitions, and the screen layout and wording.
- Replace: JSON-blob persistence (→ relational Dataverse tables), client-only
  gating (→ server-side stage change), invented history (→ a real stage
  history table), the mock automations (→ real flows), and the persona picker
  (→ security roles).
- Decide: see the open questions in `../PROGRESS.md`. The largest are
  licensing, per-step stage gates, what counts as "complete" for dropdown and
  text steps, and whether site requirements should add items to a candidate's
  checklist.

`02-power-platform-build-spec.md` turns this into a build specification.
Labels there separate **[Prototype]** behaviour from **[Proposed]** design.
