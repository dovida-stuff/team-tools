# 02 — Power Platform build specification

**Status: proposed design. Nothing in this document has been built, imported
or tested in a Microsoft environment.** Formulas and flow expressions are
written against the names defined here. They have not been compiled in Power
Apps Studio, so expect to adjust display names once the tables exist.

Labels:
- **[Prototype]**: behaviour the prototype already has; keep it.
- **[Proposed]**: a new design decision, usually fixing a defect listed in
  `01-assessment.md`.
- **[Confirm]**: depends on an answer from you (see `../PROGRESS.md`).

## 0. Assumptions this design depends on [Confirm]

1. Each user, and one service account, has a licence that includes
   **Dataverse**: Power Apps Premium (per user), a per-app licence, or
   pay-as-you-go. The Power Apps rights that come with Microsoft 365 do *not*
   include Dataverse. If Premium isn't available, the fallback is Dataverse for
   Teams, which has a weaker security model. The design below would need
   reworking for it.
2. There is a Dataverse environment other than the tenant's *Default*
   environment, and you have the **System Customizer** or **Environment
   Maker** role in it.
3. Data loss prevention (DLP) policy allows the **Microsoft Dataverse** and
   **Office 365 Outlook** connectors in the same group.
4. A non-personal **service account** can own the flows and hold the
   stage-control permission.
5. Publisher prefix `dov`. Every schema name below uses it; change it before
   creating anything if IT has a standard.

## 1. Architecture

| Layer | Component | Why |
|---|---|---|
| Data | Dataverse tables (§2) | Relational, row-level security, auditing, no Excel formula chains |
| Main app | **Canvas app** "Recruitment Operations" (§5) | Keeps the prototype's screens, including the pipeline grid whose columns come from the workflow configuration, which model-driven grids cannot do |
| Admin (optional) | Model-driven app over the config tables | Built-in forms and editable grids for bulk config maintenance, at no extra licence cost |
| Rules | Stage changes only through a flow that runs as the service account, plus column security (§3, §4-F3) | The server enforces the gate, so no screen or import can skip it |
| Automation | Power Automate cloud flows in the same solution (§4) | Replaces the mock Automations screen |
| Change history | Stage History table (written by flow) + Dataverse auditing | Replaces the hard-coded history tab |
| Reporting | In-app summaries + Power BI or model-driven dashboards [Confirm] (§7) | |

Everything goes in one solution, **Recruitment Operations**. Build it in a
dev/test environment and move it to production as a managed solution, using
only the browser (Solutions → Export / Import).

## 2. Dataverse data model

### 2.1 Global choices

| Choice (schema) | Options, in order | Source |
|---|---|---|
| Candidate type `dov_candidatetype` | Caregiver; Key Player | [Prototype] `:101` |
| Recruitment stage `dov_stage` | Background checks; Offer stage; Contract issued; Contract signed; Onboarded; On hold; Withdrawn | [Prototype] `:58-65` |
| Requirement state `dov_requirementstate` | Not started; In progress; Complete; Waived | [Prototype] `:66` |
| Outcome reason `dov_outcomereason` | Candidate requested more time; Awaiting document; Role paused; Intake deferred; Candidate withdrew; No response; Requirements not met; Did not start; Role no longer available | [Prototype] `:1745-1760`. First four are On hold, last five Withdrawn. |
| Candidate source `dov_source` | Job board; Referral; Community event; Direct sourcing; Social campaign | [Prototype] demo list [Confirm] |
| Step category `dov_stepcategory` | Identity; Process; Compliance; Outcome | [Prototype] |
| Step input type `dov_stepinputtype` | Status; Dropdown; Text | [Proposed] Status = the four requirement states |
| Step kind `dov_stepkind` | Application field; Tracked step | [Proposed] separates real columns from checklist items |
| Intake status `dov_intakestatus` | Open; Closed | [Prototype] |

After you create each choice, write down the integer value Dataverse assigns
to every option (Choice → option → *Value*). Flow F3 needs the stage values
(§4).

### 2.2 Tables

Primary column first. Req = required. "Sec" = column-secured (§3).

**Office** `dov_office` — [Prototype] `OfficeRule` minus the unused counters
| Column | Type | Notes |
|---|---|---|
| Office name `dov_name` | Text 100, Req | |
| Code `dov_code` | Text 10, Req | Alternate key *Office code* |
| Region `dov_region` | Text 100 | Shown as "Zone / location" in the grid |
| Active `dov_active` | Yes/No, default Yes | Hides closed offices without deleting |

**Candidate** `dov_candidate` — [Proposed] person split from application so
rehire/transfer keeps one person across applications
| Column | Type | Notes |
|---|---|---|
| Full name `dov_name` | Text 200, Req | |
| Email `dov_email` | Email | |
| Phone `dov_phone` | Phone | |

**Intake** `dov_intake` — [Prototype] `IntakePlan`, with a real date
| Column | Type | Notes |
|---|---|---|
| Intake name `dov_name` | Text 100, Req | Alternate key *Intake name* (stops duplicates, defect 9) |
| Orientation date `dov_orientationdate` | Date only, Req | |
| Requested places `dov_requestedplaces` | Whole number ≥ 0, Req | |
| Intake status `dov_intakestatus` | Choice, default Open | |

**Application** `dov_application` — [Prototype] `Application`
| Column | Type | Notes |
|---|---|---|
| Name `dov_name` | Text 200, Req | Set by the app to the candidate's name so views read naturally |
| Application number `dov_applicationnumber` | Autonumber `APP-{SEQNUM:5}` | Alternate key; replaces client-side `max(id)+1` |
| Candidate `dov_candidate` | Lookup → Candidate, Req | |
| Candidate type `dov_candidatetype` | Choice, Req | Decides which workflow applies |
| Role title `dov_roletitle` | Text 100, Req | |
| Office `dov_office` | Lookup → Office, Req | |
| Recruiter `dov_recruiter` | Lookup → User | [Proposed] real users instead of the hard-coded four |
| Source `dov_source` | Choice | |
| Intake `dov_intake` | Lookup → Intake | Blank = Unassigned |
| Applied on `dov_appliedon` | Date only, default today | |
| Stage `dov_stage` | Choice, default *Background checks*, **Sec** | Changed only by F3 |
| Stage before hold `dov_stagebeforehold` | Choice (stage), **Sec** | [Proposed] lets "Resume" return to the right stage |
| Stage changed on `dov_stagechangedon` | Date and time, **Sec** | Set by F3; drives days in stage |
| Outcome reason `dov_outcomereason` | Choice, **Sec** | Set by F3 |
| Did not start `dov_didnotstart` | Yes/No, **Sec** | Set by F3 when reason = Did not start |
| Notes `dov_notes` | Multiline text 4000 | |
| Requirements counted `dov_reqtotal` | Whole number | Maintained by F2 |
| Requirements cleared `dov_reqcleared` | Whole number | Maintained by F2 |
| Required open `dov_reqrequiredopen` | Whole number | Maintained by F2 |
| Required overdue `dov_reqoverdue` | Whole number | Maintained by F2/F4 |
| Required due soon `dov_reqduesoon` | Whole number | Maintained by F2/F4 (due within 3 days) |
| Readiness `dov_readiness` | **Formula**, whole number | `If('Requirements counted' = 0, 0, Round('Requirements cleared' / 'Requirements counted' * 100, 0))` [Prototype] |
| Risk `dov_risk` | **Formula**, text | `If('Required overdue' > 0, "Blocked", 'Required due soon' > 0, "Due soon", "Clear")` [Proposed] the prototype never calculates risk [Confirm thresholds] |
| Days in stage `dov_daysinstage` | **Formula**, whole number | `DateDiff('Stage changed on', UTCNow(), TimeUnit.Days)`. If your environment rejects `UTCNow()` in formula columns, calculate it in the app instead. |

**Workflow Step** `dov_workflowstep` — [Prototype] `TrackableColumn`, with
explicit rules instead of rules implied by category
| Column | Type | Notes |
|---|---|---|
| Step label `dov_name` | Text 100, Req | |
| Candidate type `dov_candidatetype` | Choice, Req | |
| Sort order `dov_sortorder` | Whole number, Req | Grid column order |
| Step kind `dov_stepkind` | Choice, Req | *Application field* = shows an Application column in the grid; *Tracked step* = a checklist item |
| Application column key `dov_appcolumnkey` | Text 50 | For application fields: `candidate`, `stage`, `recruiter`, `source`, `phone`, `email`, `zone`, `office`, `role`, `notes`, `dns`, `intake` |
| Category `dov_category` | Choice | |
| Input type `dov_inputtype` | Choice | For tracked steps |
| Options `dov_options` | Multiline text | `; `-separated, for Dropdown |
| Completing values `dov_completingvalues` | Text 500 | [Proposed] `; `-separated values that count as Complete (fixes defect 3). Status steps use `Complete; Waived`. |
| Counts toward readiness `dov_countstowardreadiness` | Yes/No | [Proposed] keeps Pay level, Contract start and similar data fields out of readiness (defect 7) |
| Required `dov_required` | Yes/No | Explicit [Confirm per step]; the prototype derives it from the Compliance category |
| Required before stage `dov_requiredbeforestage` | Choice (stage) | [Proposed] the gate this step blocks (fixes defect 2). Blank = never blocks. The prototype's rule is equivalent to *Offer stage* for every required step. |
| Show in grid `dov_showingrid` | Yes/No | [Prototype] `visible` |
| Status | Active / Inactive (built-in) | Deactivate rather than delete, so history survives |

**Application Requirement** `dov_applicationrequirement` — [Prototype]
`Requirement`, one row per application × tracked step
| Column | Type | Notes |
|---|---|---|
| Name `dov_name` | Text 100, Req | Copy of the step label |
| Application `dov_application` | Lookup → Application, Req, **Parental** (cascade delete/assign/share) | |
| Workflow step `dov_workflowstep` | Lookup → Workflow Step, Req | Alternate key *Application + step* (no duplicate rows) |
| State `dov_state` | Choice (requirement state), default Not started | |
| Value `dov_value` | Text 500 | Dropdown choice or free text/evidence note |
| Due date `dov_duedate` | Date only | |
| Required `dov_required` | Yes/No | Copied from step at creation |
| Counts toward readiness `dov_countstowardreadiness` | Yes/No | Copied from step |
| Required before stage `dov_requiredbeforestage` | Choice (stage) | Copied from step |
| Waiver note `dov_waivernote` | Text 500 | [Proposed] reason recorded when Waived |

Copying rule settings onto each row means a later workflow change doesn't
silently rewrite rules for candidates already in progress. A "re-sync"
action (§4-F1b) applies changes on purpose.

**Site Requirement** `dov_siterequirement` — [Prototype] `OfficeRuleDefinition`
| Column | Type | Notes |
|---|---|---|
| Site requirement `dov_name` | Text 200, Req | Alternate key |
| Standard text `dov_standardtext` | Multiline 4000 | |
| Sort order `dov_sortorder` | Whole number | |

**Office Site Requirement** `dov_officesiterequirement` — [Prototype]
`requirementValues`
| Column | Type | Notes |
|---|---|---|
| Name `dov_name` | Text 300 | "Office – Requirement", set by the app |
| Office `dov_office` | Lookup → Office, Req, Parental | |
| Site requirement `dov_siterequirement` | Lookup → Site Requirement, Req, Parental | Alternate key *Office + requirement* |
| Office text `dov_officetext` | Multiline 4000 | [Proposed] **blank = inherit the standard.** A row exists only for a real variation (fixes the "Use default" copy problem). |

**Stage History** `dov_stagehistory` — [Proposed] replaces the invented history tab
| Column | Type | Notes |
|---|---|---|
| Name `dov_name` | Text 200 | e.g. "Background checks → Offer stage" |
| Application `dov_application` | Lookup, Parental | |
| From stage `dov_fromstage` / To stage `dov_tostage` | Choice (stage) | |
| Outcome reason `dov_outcomereason` | Choice | |
| Changed by `dov_changedby` | Lookup → User | Caller, recorded by F3 |
| Changed on `dov_changedon` | Date and time | |

Relationships in summary: Candidate 1–N Application; Office 1–N Application;
Intake 1–N Application; Application 1–N Application Requirement, Stage
History; Workflow Step 1–N Application Requirement; Office and Site
Requirement 1–N Office Site Requirement.

Turn on **auditing** for Application, Application Requirement, Workflow Step,
Site Requirement, Office Site Requirement and Intake. The workflow screen
already promises "permission-controlled and recorded in an audit history"
(`:4010-4011`).

## 3. Security model [Proposed]

The prototype's persona selector (`:1415-1424`) becomes real security roles.
Create them by copying the *Basic User* role, then add:

| Table | Recruiter | Compliance reviewer | Recruitment manager |
|---|---|---|---|
| Application, Candidate | Create, Read, Write (Organisation) | Read, Write (Org) | Create, Read, Write, Delete (Org) |
| Application Requirement | Read, Write (Org) | Read, Write (Org) | Read, Write, Delete (Org) |
| Stage History | Read (Org) | Read (Org) | Read (Org) |
| Office, Intake, Workflow Step, Site Req., Office Site Req. | Read (Org) | Read (Org) | Create, Read, Write, Delete (Org) |

Organisation-level access matches how the shared tracker works now: everyone
sees and edits every office [Confirm]. To limit recruiters to their own
offices, use business units per region instead.

**Column security**: turn on *column security* for Stage, Stage before hold,
Stage changed on, Outcome reason and Did not start. Create two column
security profiles:
- *Recruitment – stage read*: Read = Allowed, Update/Create = Not allowed.
  Assign to a Teams or Entra group containing every app user.
- *Recruitment – stage write*: all Allowed. Assign to the **service account
  only**.

Anyone without a profile can't read secured columns at all, so every app user
must get the read profile. Stage still defaults to *Background checks* on
create, because a column default doesn't need Create permission.

Waiving a required item: the app shows *Waived* only to managers. That is
enforced in the app only, not on the server, so auditing records who did it
[Confirm if waiver must be server-enforced].

## 4. Power Automate flows [Proposed]

Every flow lives in the solution, uses **connection references** owned by the
service account, and writes to Dataverse with the *Microsoft Dataverse*
connector.

### F1 — Generate checklist
*Replaces* `addApplication` step generation (`:968-980`) and the mock
"Generate application checklist" flow.
- Trigger: Dataverse **When a row is added** · Table *Applications* · Scope
  *Organization*.
- **List rows** *Workflow Steps*. Filter:
  `dov_candidatetype eq @{triggerOutputs()?['body/dov_candidatetype']} and dov_stepkind eq <Tracked step value> and statecode eq 0`.
  Sort `dov_sortorder asc`.
- **Apply to each** step → **Add a new row** *Application Requirements*:
  Name = step label; Application = `dov_applications(@{triggerOutputs()?['body/dov_applicationid']})`;
  Workflow step = `dov_workflowsteps(@{items('Apply_to_each')?['dov_workflowstepid']})`;
  State = Not started; Required / Counts toward readiness / Required before
  stage = copied from the step.
- **Run a child flow** F2 with the application ID (one recalculation after
  all rows exist).

*F1b (manual, managers)*: "Re-sync workflow". This is an instant flow that
adds rows for steps created after an application started, and refreshes
Required, Counts and Required-before on rows that aren't cleared. It fixes
"new steps never reach existing candidates" (defect 7) without surprise
changes.

### F2 — Recalculate readiness (child flow + trigger wrapper)
*Replaces* readiness maths in `:911-917` and `:2139-2147`.
- Child flow input: `ApplicationId` (text).
- **List rows** *Application Requirements*, filter
  `_dov_application_value eq '@{triggerBody()['text']}' and statecode eq 0`.
- **Compose** `Cleared` = Filter array, advanced mode:
  `@and(equals(item()?['dov_countstowardreadiness'], true), contains(createArray('Complete','Waived'), item()?['dov_state@OData.Community.Display.V1.FormattedValue']))`
- Similar Filter arrays for: counted (`dov_countstowardreadiness` true);
  required open (required and state not Complete/Waived); overdue (required
  open and `less(item()?['dov_duedate'], formatDateTime(utcNow(),'yyyy-MM-dd'))`);
  due soon (required open and due date ≤ `addDays(utcNow(),3,'yyyy-MM-dd')`).
- **Update a row** *Applications*: the five count columns = `length(body('...'))`.
- Wrapper flow: **When a row is added, modified or deleted** on *Application
  Requirements*. For modify, select columns `dov_state,dov_duedate,dov_required,dov_countstowardreadiness`.
  Then run the child flow with `_dov_application_value`.

### F3 — Change application stage (server-enforced gate)
*Replaces* `advanceStage` (`:928-950`), `applyOutcome` (`:1014-1033`) and
the grid status edit (`:2116`). **This is the only way Stage changes.**
- Trigger: **Power Apps (V2)**. Inputs: `ApplicationId` (text), `Action` (text:
  `Advance`, `Hold`, `Resume` or `Withdraw`), `Reason` (text), `CallerEmail` (text).
- Flow properties → **Run only users** → Dataverse connection = *Use this
  connection* (service account). This is what lets it write the secured
  columns.
- **Get a row by ID** *Applications*. Keep
  `Current = body/dov_stage@OData.Community.Display.V1.FormattedValue`.
- **Compose** `Order`:
  `{"Background checks":1,"Offer stage":2,"Contract issued":3,"Contract signed":4,"Onboarded":5}`
- **Compose** `StageValue` (the integers you noted in §2.1):
  `{"Background checks":<v>,"Offer stage":<v>,"Contract issued":<v>,"Contract signed":<v>,"Onboarded":<v>,"On hold":<v>,"Withdrawn":<v>}`
- **Switch** on `Action`, and work out `Target` and whether the move is allowed:

  | Action | Allowed from | Target | Extra |
  |---|---|---|---|
  | Advance | Order 1–4 | next stage by Order | gate check |
  | Hold | Order 1–4 | On hold | Reason must be an On hold reason; save *Stage before hold* |
  | Resume | On hold | Stage before hold | gate check against that stage |
  | Withdraw | anything except Withdrawn | Withdrawn | Reason must be a withdrawal reason; *Did not start* = Reason is "Did not start" |

  Anything else → respond `ok=false`, "This application can't move from
  {Current} with {Action}." (This covers defect 6: the prototype does nothing
  and says nothing.)
- **Gate check**: list uncleared required requirements for the application,
  then Filter array:
  `@lessOrEqual(outputs('Order')?[item()?['dov_requiredbeforestage@OData.Community.Display.V1.FormattedValue']], outputs('Order')?[variables('Target')])`
  If the length is > 0 → respond `ok=false` with
  "{n} required items still need attention before this application can move to {Target}: {names}."
  This keeps the prototype's wording (`:935`).
- **Update a row** Application: Stage = `outputs('StageValue')?[variables('Target')]`,
  Stage changed on = `utcNow()`, Outcome reason, Did not start, Stage before
  hold (Hold only; clear on Resume).
- **Add a new row** *Stage History* (from, to, reason, Changed by = the User
  looked up from `CallerEmail`, Changed on = `utcNow()`).
- **Respond to a PowerApp or flow**: `ok` (text `true`/`false`), `message` (text).

For the migration only, admins with the write profile can set Stage directly
(§6). Day to day nobody else can, because the column is secured.

### F4 — Daily reminders and risk refresh
*Replaces* the mock "Requirement due reminder" and the fake bell count
(`:1470-1473`).
- **Recurrence**: daily, 07:00, time zone *(UTC+10:00) Canberra, Melbourne,
  Sydney* [Confirm].
- List active applications (Stage is one of the four active stages) → for
  each, run F2. This refreshes overdue and due-soon counts as the date moves.
- List Application Requirements where required, not cleared, due date between
  today and today + 3, and the application is active. Group them by the
  application's recruiter (a Select, then a union of recruiter emails, then
  filter per recruiter) and send one **Send an email (V2)** digest per
  recruiter from a shared mailbox [Confirm].

### F5 — Intake readiness review
*Replaces* the mock "Intake rollover review" (`:3500-3506`).
- Recurrence: daily. List *Open* intakes whose orientation date = today + 5.
- For each, list assigned active applications with Readiness < 80. If there
  are any, email the recruitment managers' group with the list and a deep link
  to the Intakes screen. The rollover itself stays a manual button in the app
  (§5), as in the prototype.

### F6 — Hiring manager notification (phase 2, off by default)
Matches the prototype, where this flow is *disabled* (`:3508-3515`).
Trigger: requirement "Contract accepted" set to Complete on a Key Player
application. Send the summary to the hiring manager. **Blocked**: there is
no hiring manager field anywhere in the prototype [Confirm where the address
comes from].

## 5. Canvas app screens and Power Fx

Keep the prototype's navigation and layout: dark sidebar, teal accents, the
same screen names and wording. Named formulas go in **App → Formulas**:

```powerfx
ActiveStages = [
    'Recruitment stage'.'Background checks',
    'Recruitment stage'.'Offer stage',
    'Recruitment stage'.'Contract issued',
    'Recruitment stage'.'Contract signed'
];
ClearedStates = ['Requirement state'.Complete, 'Requirement state'.Waived];
Me = LookUp(Users, 'Primary Email' = User().Email);
IsManager = !IsBlank(
    LookUp(Me.'Security Roles (systemuserroles_association)', Name = "Recruitment manager")
);
```

| Screen | From prototype | Key behaviour |
|---|---|---|
| Overview | `Overview` `:1781` | Four metric cards from the Applications view (Active = Stage in ActiveStages; Hires = Onboarded; Ready = Readiness ≥ 80 and not Onboarded; Exceptions = Risk ≠ "Clear"). The attention list sorts by Risk, then Days in stage. **Drop** the hard-coded intake panel, trend and automation pulse, or replace them with real queries. |
| Pipeline | `Pipeline` `:2241` | Caregiver / Key Player toggle, search, stage and office filters, grid with columns from Workflow Steps (below). **Status cell is read-only**, with a small "Change stage" action that opens the stage dialog. |
| Candidate | `Candidate` `:2470` | Summary, Requirements, Stage history (real rows), Notes. Advance / Set outcome buttons call F3. |
| Intakes | `Intakes` `:2791` | Cards with Requested / Assigned / Ready / Hired, the assignments list, New intake (date picker), Rollover (managers). |
| Site requirements | `Offices` `:3037` | Matrix and Lookup tabs. Managers can edit; everyone else sees read-only text. |
| Workflows | `Workflows` `:3645` | Manager-only editor for Workflow Steps: label, type, options, completing values, category, required, required-before stage, show in grid, order. |
| Reports | `Reports` `:4022` | §7. |
| Automations | `Automations` `:3471` | Optional: a read-only page listing the flows and linking to their run history. No fake counters. |

### 5.1 Pipeline grid (columns from workflow configuration)

Screen **OnVisible** (and after edits):
```powerfx
ClearCollect(colSteps,
    Sort(
        Filter('Workflow Steps', 'Candidate type' = locType, 'Show in grid', Status = 'Status (Workflow Steps)'.Active),
        'Sort order'
    )
);
ClearCollect(colApps,
    Filter(Applications, 'Candidate type' = locType)   // swap for a delegable view if active records > 2,000
);
ClearCollect(colReqs,
    Filter('Application Requirements', 'Application'.'Candidate type' = locType)
    // if this isn't delegable in your tenant, create a system view "Grid – <type> requirements"
    // with the related-table filter and use: Filter('Application Requirements', 'Application Requirements (Views)'.'Grid – Caregiver requirements')
);
```
Outer vertical gallery `galApps`:
```powerfx
Filter(colApps,
    (IsBlank(locStage) || Stage = locStage) &&
    (IsBlank(locOffice) || Office.Office = locOffice.Office) &&
    (IsBlank(txtSearch.Text) ||
        txtSearch.Text in Name || txtSearch.Text in Office.'Office name' ||
        txtSearch.Text in 'Role title' || txtSearch.Text in Recruiter.'Full Name')
)
```
Inner horizontal gallery `galCells` (inside `galApps`). In a nested
gallery's **Items**, `ThisItem` still means the outer row:
```powerfx
ForAll(colSteps As s,
    {
        Step: s,
        App: ThisItem,
        Req: LookUp(colReqs, Application.Application = ThisItem.Application && 'Workflow step'.'Workflow Step' = s.'Workflow Step')
    }
)
```
Cell label `Text`:
```powerfx
If(ThisItem.Step.'Step kind' = 'Step kind'.'Application field',
    Switch(ThisItem.Step.'Application column key',
        "candidate", ThisItem.App.Name,
        "stage",     Text(ThisItem.App.Stage),
        "recruiter", ThisItem.App.Recruiter.'Full Name',
        "source",    Text(ThisItem.App.Source),
        "phone",     ThisItem.App.Candidate.Phone,
        "email",     ThisItem.App.Candidate.Email,
        "zone",      ThisItem.App.Office.Region,
        "office",    ThisItem.App.Office.'Office name',
        "role",      ThisItem.App.'Role title',
        "notes",     ThisItem.App.Notes,
        "dns",       If(ThisItem.App.'Did not start', "Yes", "No"),
        "intake",    Coalesce(ThisItem.App.Intake.'Intake name', "Unassigned")
    ),
    Coalesce(ThisItem.Req.Value, Text(ThisItem.Req.State), "—")   // "—" = no row yet; F1b re-sync adds it
)
```
Requirement cell edit: a dropdown whose `Items` are
`If(ThisItem.Step.'Input type' = 'Step input type'.Status, ["Not started","In progress","Complete","Waived"], Split(ThisItem.Step.Options, ";"))`.
`OnChange`:
```powerfx
With({v: Trim(Self.Selected.Value), st: ThisItem.Step},
    Patch('Application Requirements', ThisItem.Req, {
        Value: If(st.'Input type' = 'Step input type'.Status, Blank(), v),
        State:
            If(st.'Input type' = 'Step input type'.Status,
                LookUp(Choices('Requirement state'), Text(Value) = v).Value,
               CountIf(Split(st.'Completing values', ";"), Trim(Value) = v) > 0,
                'Requirement state'.Complete,
               IsBlank(v), 'Requirement state'.'Not started',
                'Requirement state'.'In progress')          // defect 3: a value alone never means Complete
    })
);
Refresh(Applications)   // F2 updates readiness in a few seconds
```
Only managers see the "Waived" option. For Text steps, show a text input
that saves `Value` only, and a separate state dropdown.

### 5.2 Stage and outcome actions (Candidate screen)
Advance button `OnSelect`:
```powerfx
Set(varStageResult, 'ChangeApplicationStage'.Run(Text(locApp.Application), "Advance", "", User().Email));
Notify(varStageResult.message, If(varStageResult.ok = "true", NotificationType.Success, NotificationType.Warning));
Set(locApp, LookUp(Applications, Application = locApp.Application))
```
Advance `DisplayMode`: `If(locApp.Stage in ActiveStages, DisplayMode.Edit, DisplayMode.Disabled)`.
It is disabled for On hold, Onboarded and Withdrawn. For On hold, show a
**Resume** button instead (`Visible: locApp.Stage = 'Recruitment stage'.'On hold'`,
calling F3 with `"Resume"`). The flow repeats all these checks on the server
anyway.

Outcome dialog: `drpOutcome` (On hold / Withdrawn). Its **OnChange** is
`Reset(drpReason)`, which fixes defect 5. `drpReason.Items`:
```powerfx
If(drpOutcome.Selected.Value = "On hold",
    ["Candidate requested more time","Awaiting document","Role paused","Intake deferred"],
    ["Candidate withdrew","No response","Requirements not met","Did not start","Role no longer available"])
```
Save calls F3 with `Action` = `"Hold"` or `"Withdraw"` and `Reason` = `drpReason.Selected.Value`.

### 5.3 Add candidate
Same dialog as the prototype (`:1586-1714`), plus **email and phone inputs**
(the prototype makes them up, `:991-992`). The recruiter picker lists users
with a recruitment role.
```powerfx
With({c: Patch(Candidates, Defaults(Candidates), {'Full name': txtName.Text, Email: txtEmail.Text, Phone: txtPhone.Text})},
    Set(locApp, Patch(Applications, Defaults(Applications), {
        Name: txtName.Text, Candidate: c, 'Candidate type': locType, 'Role title': txtRole.Text,
        Office: drpOffice.Selected, Recruiter: drpRecruiter.Selected, Intake: drpIntake.Selected,
        Source: drpSource.Selected.Value, 'Applied on': Today()
    }))
);
Navigate(scrCandidate)   // F1 adds the checklist within seconds; show "Generating checklist…" until rows appear
```

### 5.4 Intake rollover (managers)
Keeps `:2820-2840`, but uses dates rather than list order and moves only
**active** stages (defect 9):
```powerfx
With({next: First(Sort(Filter(Intakes, 'Intake status' = 'Intake status'.Open, 'Orientation date' > locIntake.'Orientation date'), 'Orientation date'))},
    If(IsBlank(next),
        Notify("Create a later open intake before rolling candidates forward.", NotificationType.Warning),
        With({movers: Filter(Applications, Intake.Intake = locIntake.Intake, Stage in ActiveStages, Readiness < 80)},
            Patch(Applications, ForAll(movers As m, {Application: m.Application, Intake: next}));
            Notify(CountRows(movers) & " incomplete assignments moved to " & next.'Intake name' & ".", NotificationType.Success)
        )
    )
)
```

### 5.5 Site requirements
Lookup tab: rows = `Sort('Site Requirements', 'Sort order')`. Office text:
```powerfx
With({v: LookUp('Office Site Requirements', Office.Office = drpLookupOffice.Selected.Office && 'Site requirement'.'Site Requirement' = ThisItem.'Site Requirement').'Office text'},
    Coalesce(v, ThisItem.'Standard text'))
```
The variation badge shows when that lookup isn't blank. In the matrix, the
office cell's **OnChange** upserts, and saving text equal to the standard
removes the variation:
```powerfx
With({o: ThisItem.Office, r: ThisItem.Req,
      existing: LookUp('Office Site Requirements', Office.Office = ThisItem.Office.Office && 'Site requirement'.'Site Requirement' = ThisItem.Req.'Site Requirement')},
    If(Trim(Self.Text) = Trim(r.'Standard text') || IsBlank(Trim(Self.Text)),
        If(!IsBlank(existing), Remove('Office Site Requirements', existing)),
        Patch('Office Site Requirements', If(IsBlank(existing), Defaults('Office Site Requirements'), existing),
            {Name: o.'Office name' & " – " & r.'Site requirement', Office: o, 'Site requirement': r, 'Office text': Self.Text})
    )
)
```

## 6. Migration from the Excel tracker

The real workbook's headers aren't in this bundle. The Caregiver columns in
the prototype are described as the workbook's familiar touchpoints
(`:2291`, `:3199`), so use `seed-data/workflow-steps.csv` as the starting map
and confirm it against the real headers.

Load order. Use **Dataflows** (Power Query Online, in the browser), which
can match lookups by alternate key:
1. Offices → Intakes → Workflow Steps → Site Requirements → Office Site
   Requirements (variations only).
2. Candidates (from the tracker's name / email / phone columns; remove
   duplicates on email where there is one [Confirm the dedupe rule]).
3. Applications, run by the service account (it holds the stage-write
   profile) so Stage, Outcome reason and Did not start can be set directly.
   F1 fires for each one and creates *Not started* requirement rows.
4. Requirement states: one row per application × tracked step, from the
   tracker's touchpoint columns. **Upsert** on the *Application + step*
   key, so the rows F1 created are updated rather than duplicated. Convert
   each cell value with the same rule as §5.1.
5. One Stage History row per application: From = blank, To = imported stage,
   Name = "Imported from tracker".
6. Run F4 once by hand to refresh every readiness and risk.
7. Reconcile: counts per office × stage, and per intake, must match the
   workbook's own totals before anyone switches over.

Keep live candidate data inside the Microsoft tenant during migration. Don't
paste tracker rows into outside tools, including this chat.

## 7. Reporting

The prototype's live measures (`:4022-4245`) map directly onto Dataverse
queries:

| Measure | Definition |
|---|---|
| Active | Stage in the four active stages |
| Hires | Stage History rows with To = Onboarded, by **Changed on** month. (The prototype counts current Onboarded records and has no date.) |
| Withdrawal rate | Withdrawn ÷ applications created in the period [Confirm denominator] |
| Withdrawal reasons | Count by Outcome reason where Stage = Withdrawn (On hold reasons reported separately) |
| Average readiness | Mean Readiness over active applications |
| Intake fill rate | Assigned (not Withdrawn) ÷ Requested places, Open intakes |
| Requested vs hired by month | Requested = sum of Requested places by orientation month; Hired as above. This replaces the hard-coded trend. |
| Office comparison | Per office: active, hired, withdrawn, average days in stage, average readiness |

For the monthly and intake reports: **Power BI** with the Dataverse
connector if you have Power BI Pro [Confirm]. Otherwise use model-driven
dashboards and charts built on saved views, or *Export to Excel* from a view
for ad-hoc pivots. Either way, reports read the same tables, with no copied
formulas.
