# Claude handover — Recruitment Operations / Power Apps

You are taking over development of my recruitment operations app. Read this handover and the attached source before proposing changes. Continue the existing work rather than starting a generic recruitment app from scratch.

## Goal and constraints

I work in talent acquisition at Dovida. My team uses a large live Excel tracker to manage candidates through background checks, onboarding and hire, store office-specific requirements, and produce monthly and intake reporting. It is becoming slow and cumbersome, with increasing formula complexity. The app should replace that operational tracker.

The intended production platform is Microsoft Power Apps, with Dataverse and Power Automate as the planned architecture. Production candidate data must remain inside our work Microsoft environment. My work computer supports browser tools only; do not make desktop installations a prerequisite for me. Use synthetic or anonymised data for development outside that environment. Explain technical decisions plainly and give concrete browser-based steps when my action is needed.

## What this attachment actually contains

This is a source and handover bundle, NOT an importable Power Apps solution or canvas app export. The retrieved project is a React/TypeScript web prototype using Vinext, Tailwind, Shadcn components and Cloudflare D1 through Drizzle. No .msapp, native solution ZIP, Dataverse solution definitions, Power Fx implementation, or exported Power Automate flows were found in its current source.

Do not tell me this ZIP can be imported into Power Apps. Do not treat the web prototype's “Power Automate” screen as proof that Microsoft flows exist. If I attach a separate native Power Apps package, inspect it and reconcile it with this prototype before making changes. Otherwise use the prototype as the existing behavioural and UI reference for the Microsoft implementation.

Source snapshot: 25 September 2026, retrieved from Recruitment Operations Prototype, source commit eaebd3bbc348f28c14760688d7edbb32407d28ed, latest reported Site version 7. This bundle contains tracked source, not a live database export or a snapshot of changes saved through the running app.

## Read these first

1. `prototype-source/app/prototype.tsx`: principal application UI, types, synthetic records, workflow definitions and interactions.
2. `prototype-source/app/api/state/route.ts`: GET/POST persistence endpoint.
3. `prototype-source/db/schema.ts`, `db/index.ts` and `drizzle/`: current prototype storage.
4. `prototype-source/app/globals.css`, `app/layout.tsx`, `app/page.tsx`: presentation and entry points.
5. `prototype-source/package.json` and lockfile: exact dependencies and commands. The project includes platform-specific dependencies; do not assume it runs unchanged in your environment.

## Existing scope to preserve

- Overview, pipeline, candidate detail, intakes, office/site requirements, reports, workflows/trackable columns, and automation preview.
- Separate Caregiver and Key Player workflows and configurable columns.
- Candidate/application fields including office, recruiter, role, source, intake, stage, requirement checklist, readiness, risk, notes and outcome reason.
- Stages: Background checks, Offer stage, Contract issued, Contract signed, Onboarded, On hold, Withdrawn. Preserve the distinction between active progression, hold and terminal outcomes.
- Requirement states: Complete, In progress, Not started, Waived; required flags; configurable text/dropdown inputs and options.
- Office rule definitions, defaults and office-specific values; editable workflow field visibility and order.
- Intake planning and rollover interactions; reporting derived in part from current synthetic application records.
- Candidate creation, inline pipeline editing, requirement updates, stage progression and outcomes are represented in the source. Inspect every route through these operations before copying the logic.

## Implementation boundaries and issues to assess

These observations come from source inspection, not a fresh end-to-end runtime test:

- Persistence stores a single shared JSON payload at row ID 1. It is not a relational Dataverse schema, and the API has no revision/concurrency check.
- The API checks that state is an object and caps payload length; it does not implement comprehensive field validation or application-level role checks in that route. Hosting access controls are separate. Do not equate the preview persona selector with enforced production permissions.
- The automation screen defines sample run counts/times and local UI state. Actual Microsoft flow deployment and delivery were not evidenced.
- The advance-stage action checks required requirements when leaving Background checks. Review inline editing and all other entry points for bypasses; production enforcement must not depend solely on a button's client-side logic.
- A nonempty custom requirement value is currently treated as Complete. That is not necessarily a valid business rule for every dropdown or text field.
- Some UI messages claim stage history or notifications were updated. Verify the underlying implementation; a notification message is not evidence that an audit record or email was created.
- Demo data, dates, thresholds, totals and counters need to be distinguished from confirmed business requirements. Do not treat the sample six offices as the organisation's full footprint.
- Browser state may contain configuration changes absent from this source snapshot. Reconcile an authorised export if supplied; do not fetch or copy live candidate data into external tools.

## Your first task

Inspect the supplied files and produce a concise assessment of what exists, what is simulated, what can be reused as requirements, and what remains to implement in Power Platform. Cite file paths for material findings. Preserve the existing design and behaviour unless a concrete defect or Microsoft constraint requires a change.

Then continue with the smallest useful next implementation step. Where no native Power Apps package is supplied, prepare a practical Microsoft build specification from the actual prototype: Dataverse entities/relationships and field mappings, screens, Power Fx behaviour, server-enforced stage rules, permission model, Power Automate flows, and migration/reporting logic. Clearly label proposed design versus already implemented components. Confirm unresolved licensing/environment assumptions before making the design dependent on them.

Deliver copyable configuration/code and actionable setup steps, not just general advice. If you can produce a genuine importable Microsoft artifact, explain how it was generated and validated. If you cannot access the Microsoft environment, state that boundary and distinguish prepared files from successful import, publication or runtime testing. Never fabricate a native solution ZIP by renaming this source archive.

Maintain a short progress record of completed work, decisions, open questions and the next step. Ask only questions that materially block progress; infer routine choices from the files and continue. My priority is a usable internal recruitment tool, not a redesign exercise.
