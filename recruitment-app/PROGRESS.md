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

## Not done / boundaries
- No access to a Microsoft environment from here. Nothing has been imported,
  published or run in Power Apps, Dataverse or Power Automate.
- No native solution zip or `.msapp` was produced. A hand-written one couldn't
  be validated without importing it, so the spec gives manual build steps
  instead.
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
1. **Licensing and environment**: does every user have Power Apps Premium (or
   per-app / pay-as-you-go), and is there a non-Default Dataverse environment
   you can build in? *Blocks step 1.*
2. Publisher prefix: is `dov` OK, or does IT have a standard?
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

## Choice values (fill in during step 1)
| Recruitment stage option | Value |
|---|---|
| Background checks | |
| Offer stage | |
| Contract issued | |
| Contract signed | |
| Onboarded | |
| On hold | |
| Withdrawn | |

## Next step
Answer question 1 (and 2 if you know it). Then follow
`docs/03-step1-dataverse-setup.md`. After that: build flows F1–F3 and test
them against the synthetic applications in a dev environment.
