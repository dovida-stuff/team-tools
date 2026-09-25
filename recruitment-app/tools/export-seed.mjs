// Exports the prototype's synthetic seed data as CSV files for Dataverse import.
//
// Reads the seed constants straight out of prototype-source/app/prototype.tsx
// (the block from `const stages` up to `const nav`) so nothing is retyped by
// hand. Output goes to ../seed-data. Run with: node tools/export-seed.mjs
//
// Everything produced here is synthetic demo data from the prototype, not
// business configuration. See docs/01-assessment.md before treating any of it
// as a real rule.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(
  join(root, 'prototype-source/app/prototype.tsx'),
  'utf8',
);
const start = source.indexOf('const stages: Stage[]');
const end = source.indexOf('const nav = [');
if (start < 0 || end < 0) throw new Error('Seed block not found in prototype.tsx');

const scratch = mkdtempSync(join(tmpdir(), 'seed-'));
const module = join(scratch, 'seed.ts');
writeFileSync(
  module,
  `${source.slice(start, end)}
export {
  stages,
  seededApplications,
  officeRules,
  initialOfficeRuleDefinitions,
  initialIntakes,
  initialCaregiverColumns,
  initialKeyPlayerColumns,
  defaultRuleOptions,
};
`,
);
const seed = await import(pathToFileURL(module).href);
rmSync(scratch, { recursive: true, force: true });

const csv = (rows) =>
  rows
    .map((row) =>
      row
        .map((cell) => {
          const text = cell === undefined || cell === null ? '' : String(cell);
          return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
        })
        .join(','),
    )
    .join('\n') + '\n';
const out = (name, rows) => {
  writeFileSync(join(root, 'seed-data', name), csv(rows));
  console.log(`${name}: ${rows.length - 1} rows`);
};
const months = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
// Prototype dates are display strings such as "12 Sep 2026" or "10 Sep".
// Dates without a year are assumed to be 2026, the year used everywhere else.
const isoDate = (text) => {
  if (!text) return '';
  const [day, month, year = '2026'] = text.split(' ');
  if (!months[month]) throw new Error(`Unrecognised date: ${text}`);
  return `${year}-${String(months[month]).padStart(2, '0')}-${day.padStart(2, '0')}`;
};

// Application column keys (spec §2.2, Workflow Step) for the fields that the
// prototype stores on the application itself: coreFields in addApplication,
// plus `orientation`, which the grid edits as the application's intake in
// updateApplicationCell. Everything else in a
// workflow becomes a per-application requirement row.
const coreFieldColumn = {
  candidate: 'candidate',
  status: 'stage',
  recruiter: 'recruiter',
  source: 'source',
  phone: 'phone',
  email: 'email',
  zone: 'zone',
  office: 'office',
  role: 'role',
  notes: 'notes',
  dns: 'dns',
  orientation: 'intake',
};

out('offices.csv', [
  ['Office name', 'Code', 'Region', 'Active'],
  ...seed.officeRules.map((o) => [o.office, o.code, o.region, 'Yes']),
]);

out('intakes.csv', [
  ['Intake name', 'Orientation date', 'Requested places', 'Intake status'],
  ...seed.initialIntakes.map((i) => [i.name, isoDate(i.date), i.requested, i.status]),
]);

// Grid dropdowns that live in EditablePipelineCell's configuredOptions rather
// than in the seed block, with the value that should count as done. Steps
// with no completing value are data fields and do not count toward readiness
// (a proposed change: the prototype counts every generated row).
const gridSteps = {
  bgcStarted: { inputType: 'Text', counts: false },
  payLevel: { inputType: 'Dropdown', options: ['Level 1', 'Level 2', 'Level 3', 'Level 4'], counts: false },
  training: { inputType: 'Dropdown', options: ['Not started', 'Pending', 'Booked', 'Complete'], completing: ['Complete'] },
  contractStart: { inputType: 'Text', counts: false },
  rehire: { inputType: 'Dropdown', options: ['New starter', 'Rehire', 'Transfer'], counts: false },
  fileSent: { inputType: 'Dropdown', options: ['No', 'Yes'], completing: ['Yes'] },
};

const stepRows = (type, columns) =>
  columns.map((column, index) => {
    const core = coreFieldColumn[column.id];
    const grid = gridSteps[column.id] ?? {};
    const inputType = core ? '' : (grid.inputType ?? 'Status');
    const counts = !core && grid.counts !== false;
    return [
      type,
      (index + 1) * 10,
      column.label,
      column.id,
      core ? 'Application field' : 'Tracked step',
      core ?? '',
      column.group,
      inputType,
      (grid.options ?? column.options ?? []).join('; '),
      inputType === 'Status' ? 'Complete; Waived' : (grid.completing ?? []).join('; '),
      counts ? 'Yes' : 'No',
      // The prototype marks new-candidate steps required when their category
      // is Compliance (addApplication). Recorded here so it can be reviewed.
      counts && column.group === 'Compliance' ? 'Yes' : 'No',
      column.visible ? 'Yes' : 'No',
      counts && column.group === 'Compliance' ? 'Offer stage' : '',
    ];
  });
out('workflow-steps.csv', [
  [
    'Candidate type',
    'Sort order',
    'Step label',
    'Prototype key',
    'Step kind',
    'Application column key',
    'Category',
    'Input type',
    'Options',
    'Completing values',
    'Counts toward readiness',
    'Required',
    'Show in grid',
    'Required before stage',
  ],
  ...stepRows('Caregiver', seed.initialCaregiverColumns),
  ...stepRows('Key Player', seed.initialKeyPlayerColumns),
]);

out('site-requirements.csv', [
  ['Sort order', 'Site requirement', 'Standard text'],
  ...seed.initialOfficeRuleDefinitions.map((d, index) => [
    (index + 1) * 10,
    d.label,
    d.defaultValue,
  ]),
]);

// Mirrors resolvedValue() in Offices: a definition missing from an office's
// `rules` list renders as "Not required for this office". Only those
// variations are exported; blank means the office inherits the standard text.
const variations = [];
for (const office of seed.officeRules)
  for (const definition of seed.initialOfficeRuleDefinitions)
    if (!office.rules.includes(definition.label))
      variations.push([office.office, definition.label, 'Not required for this office']);
out('office-site-requirement-variations.csv', [
  ['Office name', 'Site requirement', 'Office text'],
  ...variations,
]);

out('applications-synthetic.csv', [
  [
    'Application number',
    'Candidate name',
    'Email',
    'Phone',
    'Candidate type',
    'Role title',
    'Office name',
    'Recruiter',
    'Stage',
    'Days in stage (seed)',
    'Intake name',
    'Source',
    'Applied on',
    'Readiness (seed)',
    'Risk (seed)',
    'Outcome reason',
    'Did not start',
    'Notes',
  ],
  ...seed.seededApplications.map((a) => [
    a.id,
    a.name,
    a.email,
    a.phone,
    a.type === 'Key player' ? 'Key Player' : 'Caregiver',
    a.role,
    a.office,
    a.recruiter,
    a.stage,
    a.stageAge,
    a.intake,
    a.source,
    isoDate(a.applied),
    a.readiness,
    a.risk,
    a.outcomeReason ?? '',
    a.dns ? 'Yes' : 'No',
    a.notes ?? '',
  ]),
]);

out('application-requirements-synthetic.csv', [
  ['Application number', 'Requirement', 'State', 'Value', 'Required', 'Due date'],
  ...seed.seededApplications.flatMap((a) =>
    a.requirements.map((r) => [
      a.id,
      r.name,
      r.state,
      r.value ?? '',
      r.required ? 'Yes' : 'No',
      isoDate(r.due),
    ]),
  ),
]);
