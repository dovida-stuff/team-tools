# 04 — Importable solution: Recruitment Operations 1.0.0.0

File: `solution/RecruitmentOperations_1_0_0_0.zip` (unmanaged). It replaces
steps 1b–1e of `03-step1-dataverse-setup.md`: you import it instead of
creating the tables by hand.

## What it contains

| Component | Count | Details |
|---|---|---|
| Publisher | 1 | Dovida, prefix `dov`, choice value prefix 72559 |
| Tables | 9 | Office, Candidate, Intake, Workflow Step, Site Requirement, Application, Application Requirement, Office Site Requirement, Stage History. Columns as in spec §2.2, with the changes listed below. |
| Global choices | 10 | Values are fixed (table below), so flows can use them directly |
| Relationships | 10 custom | Deleting an Application deletes its requirements and stage history; deleting an Office deletes its site-requirement variations. An Office, Candidate, Workflow Step or Site Requirement can't be deleted while records use it (deactivate instead). Deleting an Intake or user just clears the link. |
| Alternate keys | 6 | Office code; Intake name; Site requirement name; Application number; Application + step; Office + site requirement |
| Forms and views | 1 main form + 6 views per table | Basic layouts for admin use. The canvas app doesn't depend on them. |
| Security roles | 3 | *Recruitment - Recruiter*, *Recruitment - Compliance reviewer*, *Recruitment - Manager* (privileges as in spec §3, all Organisation level) |
| Auditing | on | For every table except Stage History, which is itself the audit record |
| Column security | flagged | Stage, Stage before hold, Stage changed on, Outcome reason, Did not start are marked *secured*. The profiles are created after import (below). |

### Differences from the spec, made so the file only uses proven XML

- **No formula columns.** Readiness is a whole number (0–100) and Risk is a
  choice (Clear / Due soon / Blocked). Flow F2 writes both whenever it
  recalculates the counts. Days in stage is worked out in the app:
  `DateDiff(ThisItem.'Stage changed on', Now(), TimeUnit.Days)`.
- **No "Parental" relationships.** Child rows use *delete cascades* instead,
  so records are removed with their parent. Sharing and reassignment don't
  cascade. Access is Organisation-level, so nothing depends on that.
- Phone is a plain text column.

## Import it (about 5 minutes)

1. Download `RecruitmentOperations_1_0_0_0.zip`. Don't unzip it.
2. make.powerapps.com → select your **dev/test** environment (top right) →
   **Solutions** → **Import solution** → **Browse** → select the zip →
   **Next** → **Import**.
3. Wait for the "successfully imported" banner (a few minutes). If it fails,
   choose **Download log file** and send me the error text. That's what I
   need to fix it.
4. Open the **Recruitment Operations** solution and check the 9 tables are
   listed. Select **Publish all customizations**.

## After import (browser, about 20 minutes)

1. **Column security profiles.** Go to admin.powerplatform.microsoft.com →
   Environments → your environment → Settings → Users + permissions →
   Column security profiles. Create:
   - *Recruitment – stage read*: open **Column permissions**. For each of the
     five secured Application columns set Read = Allowed, Update = Not
     allowed, Create = Not allowed. Add every recruitment user, or better,
     their Entra group team.
   - *Recruitment – stage write*: all three Allowed. Add the service account
     only (and yourself while testing).

   Anyone with neither profile sees those columns as empty.
2. **Environment auditing.** Settings → Audit and logs → Audit settings →
   **Start auditing**. The tables already have auditing switched on, but
   nothing is recorded until the environment switch is on too.
3. **Assign roles.** Settings → Users + permissions → Users → select a user →
   **Manage security roles**. Give each person **Basic User** plus one
   *Recruitment* role. The service account gets *Recruitment - Manager*.
4. **Load configuration data** from `seed-data/` (see 03, step 1f). Choice
   columns accept the labels as written in the CSVs.
5. **Quick test.** Open the Application table → **Edit** (data grid) → add
   a row. Stage should default to *Background checks*, and Application
   number should fill in as `APP-0000n` when saved.

## Choice values (fixed by the prefix)

| Choice | Values |
|---|---|
| Candidate type (`dov_candidatetype`) | Caregiver = 725590000; Key Player = 725590001 |
| Recruitment stage (`dov_stage`) | Background checks = 725590000; Offer stage = 725590001; Contract issued = 725590002; Contract signed = 725590003; Onboarded = 725590004; On hold = 725590005; Withdrawn = 725590006 |
| Requirement state (`dov_requirementstate`) | Not started = 725590000; In progress = 725590001; Complete = 725590002; Waived = 725590003 |
| Outcome reason (`dov_outcomereason`) | Candidate requested more time = 725590000; Awaiting document = 725590001; Role paused = 725590002; Intake deferred = 725590003; Candidate withdrew = 725590004; No response = 725590005; Requirements not met = 725590006; Did not start = 725590007; Role no longer available = 725590008 |
| Candidate source (`dov_source`) | Job board = 725590000; Referral = 725590001; Community event = 725590002; Direct sourcing = 725590003; Social campaign = 725590004 |
| Step category (`dov_stepcategory`) | Identity = 725590000; Process = 725590001; Compliance = 725590002; Outcome = 725590003 |
| Step input type (`dov_stepinputtype`) | Status = 725590000; Dropdown = 725590001; Text = 725590002 |
| Step kind (`dov_stepkind`) | Application field = 725590000; Tracked step = 725590001 |
| Intake status (`dov_intakestatus`) | Open = 725590000; Closed = 725590001 |
| Risk level (`dov_risklevel`) | Clear = 725590000; Due soon = 725590001; Blocked = 725590002 |

## How it was generated and checked

- `solution/build.py` writes the unpacked solution source. It copies the XML
  shapes from a real Dataverse export: the user-owned table
  `admin_AppCatalogFeedback` in Microsoft's CoE Starter Kit (MIT licence),
  including its system columns, relationships, ribbon, view and form
  layouts.
- `solution/verify.py` checked that:
  - every generated column has exactly the element sequence Dataverse
    exports for that column type (compared with every custom column in the
    CoE Core Components solution);
  - every column referenced in a view, form, key, relationship or role
    exists;
  - relationship names stay within the lengths Dataverse uses.

  I tested the verifier by deliberately breaking the source in three ways;
  it caught each one.
- It was packed with Microsoft's Power Platform CLI (`pac solution pack`,
  2.12.2), then unpacked again. The round trip lost nothing (the only
  differences were element order).
- **Not done:** an actual import into Dataverse. I have no Microsoft
  environment access from here, so the first real test is your import. If
  it fails, the log file names the problem and I'll fix it.

Rebuild: `solution/build.sh [path to reference solution src]`.
