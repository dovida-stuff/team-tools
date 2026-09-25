# 03 — Step 1: create the Dataverse foundation (browser only)

This is the next step to build. Once done, the tables and configuration exist
in your environment and the app and flows have something to be built on.
Plan on 2–3 hours. Everything is done at **make.powerapps.com** and
**admin.powerplatform.microsoft.com**. Nothing needs installing.

Menu names in these portals change from time to time. If a label below
doesn't match exactly, look for the nearest equivalent.

## 1a. Check the blockers first (10 minutes)

1. **Licence**: go to **myaccount.microsoft.com → Subscriptions**. Look for
   *Power Apps Premium*, *Power Apps per app* or similar. If you only see
   Microsoft 365 / Office 365 plans, stop here and tell me. The design
   depends on it (spec §0).
2. **Environment**: at make.powerapps.com, open the environment picker (top
   right). Pick a non-Default environment you can build in. Then check that
   **Tables** appears in the left menu and that **+ New table** is enabled.
   If there's no suitable environment, ask IT for a *developer* or *sandbox*
   environment with Dataverse, naming this solution as the purpose.
3. **Publisher prefix**: ask IT whether there's a standard one. If not, use
   `dov`.

## 1b. Create the solution and publisher

1. **Solutions → + New solution**.
2. Display name `Recruitment Operations`, Name `RecruitmentOperations`.
3. Publisher → **+ New publisher**: Display name `Dovida`, Name `dovida`,
   Prefix `dov`. Leave the choice value prefix as suggested. Save.
4. Version `1.0.0.0` → **Create**.

From now on, create **everything inside this solution** (open it, then use
**+ New**). If you build outside it, the work can't be moved to
production later.

## 1c. Create the global choices

In the solution: **+ New → More → Choice**. Create each choice in spec §2.1,
typing the options in the order shown. After saving each one, open it and
note the **Value** number beside every option in `PROGRESS.md` (at least for
*Recruitment stage*, which flow F3 needs).

## 1d. Create the tables

In the solution: **+ New → Table → Table (advanced properties)**. For each
table in spec §2.2:
1. Enter the display name. Under **Primary column**, set the display name
   from the spec's first row, e.g. *Office name*.
2. Under **Advanced options**, tick **Audit changes to its data** for the
   tables §2.2 lists for auditing.
3. Save, then **+ New → Column** for each remaining column:
   - *Choice* columns → **Sync with global choice** → pick the choice from 1c.
   - *Lookup* columns → Related table = the target. For the **Parental**
     ones, open **Advanced options → Relationship behaviour → Parental**.
   - *Autonumber* (Application number) → Data type **Autonumber**, type
     *String prefixed number*, prefix `APP-`, minimum digits 5.
   - *Formula* columns (Readiness, Risk, Days in stage) → Data type
     **Formula**, then paste the formula from the spec. Create the five count
     columns before Readiness and Risk, because the formulas refer to them.
   - Stage: set **Default value** = Background checks.

Create them in this order, so each lookup target already exists: Office,
Candidate, Intake, Workflow Step, Site Requirement, Application, Application
Requirement, Office Site Requirement, Stage History.

## 1e. Alternate keys

For each table: **Keys → + New key**:
- Office: *Code*
- Intake: *Intake name*
- Site Requirement: *Site requirement*
- Application: *Application number*
- Application Requirement: *Application* + *Workflow step*
- Office Site Requirement: *Office* + *Site requirement*

Keys take a few minutes to activate. Their status shows on the Keys page.

## 1f. Load the configuration seed data

The files are in `seed-data/`. They are **synthetic, from the prototype**.
Edit them to real values before production. Load in this order: open the
table → **Import → Import data** → *Text/CSV* → upload → **Transform data**
if needed → map the columns → Publish.

| File | Target table | Notes |
|---|---|---|
| `offices.csv` | Office | Only 6 sample offices. Replace them with the real list. |
| `intakes.csv` | Intake | Sample dates |
| `workflow-steps.csv` | Workflow Step | Import every row. The *Prototype key* column is for reference only and doesn't need importing. Review *Required* and *Required before stage* with the team. |
| `site-requirements.csv` | Site Requirement | |
| `office-site-requirement-variations.csv` | Office Site Requirement | **Review first.** It marks Banning register and Reference check as "Not required" at every office, which is a quirk of the demo data (assessment item 11). |

Don't load `applications-synthetic.csv` or
`application-requirements-synthetic.csv` into production. They are test data
for a dev environment, useful for testing flows F1–F3 once they exist.

## 1g. Security roles and column security

1. admin.powerplatform.microsoft.com → **Environments** → your environment →
   **Settings → Users + permissions → Security roles**. Copy *Basic User*
   three times (Recruiter, Compliance reviewer, Recruitment manager) and set
   the privileges from spec §3. Add the roles to the solution
   (solution → **Add existing → Security → Security role**).
2. Turn on **column security** for the five Application columns listed in
   spec §3: open each column → **Advanced options → Enable column security**.
3. **Settings → Users + permissions → Column security profiles**: create
   *Recruitment – stage read* and *Recruitment – stage write* as described,
   and add the members.
4. Turn on environment auditing: **Settings → Audit and logs → Audit
   settings → Start Auditing**.

## 1h. Check it worked

- In the Application table's **Data** view, add one test row as yourself.
  Stage should default to *Background checks*, and you shouldn't be able to
  edit Stage unless you're in the write profile.
- Try adding a duplicate Intake name. The key should reject it.
- Tell me the choice values and anything that didn't match. The next step is
  building flows F1–F3 against these tables.
