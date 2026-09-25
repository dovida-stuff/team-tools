# Progress record — Recruitment Operations (Power Platform)

## Completed
- **25 Sep 2026**: Received the handover bundle. Checked all 84 source files
  against `SOURCE_SHA256.txt`. Stored the snapshot unchanged in
  `prototype-source/`.
- Read all of `app/prototype.tsx`, the state API and the DB schema. Wrote
  `docs/01-assessment.md`: what's real, what's simulated, 11 defects with line
  references.
- Wrote `docs/02-power-platform-build-spec.md`: Dataverse tables, choices,
  security, flows F1–F6, canvas screens with Power Fx, migration and
  reporting. **Design only.**
- Wrote `docs/03-step1-dataverse-setup.md`: browser steps for the first build
  step.
- Wrote `tools/export-seed.mjs` and generated `seed-data/*.csv` from the
  prototype's own seed constants, so nothing was retyped. Checked that every
  file parses with consistent column counts.
- **25 Sep 2026 (later)**: Licensing confirmed (Power Apps Premium). Built
  `solution/RecruitmentOperations_1_0_0_0.zip`, an importable unmanaged
  Dataverse solution with 9 tables, 10 choices, 6 keys, forms, views and 3
  security roles. It was generated from a real Dataverse export's XML,
  checked with `solution/verify.py`, and packed and round-tripped with
  Microsoft's `pac` CLI. See `docs/04-importable-solution.md`.

## Not done / boundaries
- No access to a Microsoft environment from here. Nothing has been imported,
  published or run in Power Apps, Dataverse or Power Automate.
- The solution zip has **not been imported anywhere yet**. Your import is
  its first real test.
- No canvas app (`.msapp`) or flows yet. Those come next, built in the
  browser against the imported tables.
- The prototype wasn't built or run (it needs Cloudflare and Vinext).
  Findings come from reading the source.
- The prototype is kept only as a reference and hasn't been modified.

## Decisions (reversible)
- Canvas app for the day-to-day screens, to keep the prototype's layout and
  its workflow-driven grid columns. A model-driven app for admin is optional.
- Stage changes happen **only** in flow F3, which runs as a service account,
  plus column security on Stage. This fixes the grid bypass without desktop
  tools.
- Candidate is separate from Application, to support rehire and transfer.
- Workflow steps get explicit *Required*, *Required before stage*, *Counts
  toward readiness* and *Completing values*, instead of rules implied by
  category.
- In site requirements, a blank office value inherits the standard text.

## Open questions (these change the design)
1. ~~Licensing~~: resolved. Power Apps Premium, more licences as needed.
   Still to confirm: a non-Default dev/test environment to import into.
2. Publisher prefix: the solution uses `dov`. If IT needs another prefix,
   tell me before importing; changing it afterwards means rebuilding.
3. Stage gates: which steps must be cleared before which stage? (The
   prototype only gates leaving Background checks, but its Key Player data
   contradicts that.)
4. For dropdown and text steps, which values count as "complete"? Should Pay
   level, Rehire/transfer, Contract start and BGC started count toward
   readiness?
5. Should office site requirements add items to a candidate's checklist, or
   stay reference information as in the prototype?
6. Risk rules: is "Blocked = a required item is overdue, Due soon = due
   within 3 days" right?
7. Can every recruiter see and edit every office's candidates?
8. Who may waive a required item? Must that be enforced on the server?
9. Where does the hiring manager's email come from, for the Key Player
   notification?
10. Is Power BI Pro available for reporting?
11. Reminder emails: send from a shared mailbox? Which time zone?

## Choice values
Fixed by the `dov` prefix: option *n* = 725590000 + *n*. Full table in
`docs/04-importable-solution.md`.

## Next step
Import `solution/RecruitmentOperations_1_0_0_0.zip` into a dev/test
environment and do the after-import steps in `docs/04-importable-solution.md`.
If the import fails, send the log file's error text. After that: build flows
F1–F3, then the canvas app screens.
