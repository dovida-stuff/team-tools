'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Gauge,
  GripVertical,
  ArrowUp,
  Eye,
  EyeOff,
  HelpCircle,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type View =
  | 'overview'
  | 'pipeline'
  | 'candidate'
  | 'intakes'
  | 'offices'
  | 'reports'
  | 'trackables'
  | 'automations';
type Stage =
  | 'Background checks'
  | 'Offer stage'
  | 'Contract issued'
  | 'Contract signed'
  | 'Onboarded'
  | 'On hold'
  | 'Withdrawn';
type RequirementState = 'Complete' | 'In progress' | 'Not started' | 'Waived';
type Requirement = {
  name: string;
  state: RequirementState;
  due?: string;
  required: boolean;
  inputType?: RuleInputType;
  options?: string[];
  value?: string;
};
type RuleInputType = 'dropdown' | 'text';
type OfficeRuleDefinition = {
  id: string;
  label: string;
  inputType: RuleInputType;
  options: string[];
  defaultValue: string;
};
type OfficeRule = {
  office: string;
  code: string;
  region: string;
  active: number;
  readiness: number;
  rules: string[];
  requirementValues?: Record<string, string>;
  exceptions: number;
};
type Application = {
  id: number;
  name: string;
  initials: string;
  email: string;
  phone: string;
  role: string;
  type: 'Caregiver' | 'Key player';
  office: string;
  recruiter: string;
  stage: Stage;
  stageAge: number;
  intake: string;
  source: string;
  applied: string;
  readiness: number;
  risk: 'Clear' | 'Due soon' | 'Blocked';
  requirements: Requirement[];
  outcomeReason?: string;
  dns?: boolean;
  notes?: string;
  trackingValues?: Record<string, string>;
};
type TrackableColumn = {
  id: string;
  label: string;
  visible: boolean;
  group: 'Identity' | 'Process' | 'Compliance' | 'Outcome';
  inputType?: RuleInputType;
  options?: string[];
};
type IntakePlan = {
  name: string;
  date: string;
  requested: number;
  status: 'Open' | 'Closed';
};
type PrototypeState = {
  applications: Application[];
  caregiverColumns: TrackableColumn[];
  keyPlayerColumns: TrackableColumn[];
  officeConfigs: OfficeRule[];
  officeRuleDefinitions: OfficeRuleDefinition[];
  intakes: IntakePlan[];
};

const stages: Stage[] = [
  'Background checks',
  'Offer stage',
  'Contract issued',
  'Contract signed',
  'Onboarded',
];
const baseRequirements: Requirement[] = [
  { name: 'Banning register', state: 'Complete', required: true },
  { name: 'Right to work', state: 'Complete', required: true },
  { name: 'Police check', state: 'In progress', due: '10 Sep', required: true },
  {
    name: 'Reference check',
    state: 'Not started',
    due: '12 Sep',
    required: true,
  },
  { name: 'Statutory declaration', state: 'Not started', required: false },
  { name: 'Driver licence', state: 'Complete', required: true },
  { name: 'Quality check', state: 'Not started', required: true },
];

const initialApplications: Application[] = [
  {
    id: 101,
    name: 'Ava Mitchell',
    initials: 'AM',
    email: 'ava.mitchell@example.invalid',
    phone: '0400 000 101',
    role: 'Caregiver',
    type: 'Caregiver',
    office: 'Northside',
    recruiter: 'Alex Morgan',
    stage: 'Background checks',
    stageAge: 4,
    intake: 'September A',
    source: 'Referral',
    applied: '2 Sep 2026',
    readiness: 71,
    risk: 'Due soon',
    requirements: baseRequirements,
  },
  {
    id: 102,
    name: 'Noah Chen',
    initials: 'NC',
    email: 'noah.chen@example.invalid',
    phone: '0400 000 102',
    role: 'Caregiver',
    type: 'Caregiver',
    office: 'Bayside',
    recruiter: 'Jordan Lee',
    stage: 'Offer stage',
    stageAge: 2,
    intake: 'September A',
    source: 'Job board',
    applied: '28 Aug 2026',
    readiness: 86,
    risk: 'Clear',
    requirements: baseRequirements.map((r, i) => ({
      ...r,
      state: i < 5 ? 'Complete' : r.state,
    })),
  },
  {
    id: 103,
    name: 'Priya Shah',
    initials: 'PS',
    email: 'priya.shah@example.invalid',
    phone: '0400 000 103',
    role: 'Clinical Lead',
    type: 'Key player',
    office: 'Central',
    recruiter: 'Taylor Singh',
    stage: 'Contract issued',
    stageAge: 5,
    intake: 'September B',
    source: 'Direct sourcing',
    applied: '21 Aug 2026',
    readiness: 93,
    risk: 'Due soon',
    requirements: [
      { name: 'Qualifications', state: 'Complete', required: true },
      { name: 'Insurance', state: 'Complete', required: true },
      { name: 'Position description sent', state: 'Complete', required: true },
      { name: 'Reference check', state: 'Complete', required: true },
      {
        name: 'Contract acceptance',
        state: 'In progress',
        due: '9 Sep',
        required: true,
      },
      { name: 'Hiring manager email', state: 'Not started', required: true },
    ],
  },
  {
    id: 104,
    name: 'Liam Brooks',
    initials: 'LB',
    email: 'liam.brooks@example.invalid',
    phone: '0400 000 104',
    role: 'Caregiver',
    type: 'Caregiver',
    office: 'Hills District',
    recruiter: 'Casey Brooks',
    stage: 'Contract signed',
    stageAge: 1,
    intake: 'September A',
    source: 'Community event',
    applied: '18 Aug 2026',
    readiness: 100,
    risk: 'Clear',
    requirements: baseRequirements.map((r) => ({ ...r, state: 'Complete' })),
  },
  {
    id: 105,
    name: 'Sofia Nguyen',
    initials: 'SN',
    email: 'sofia.nguyen@example.invalid',
    phone: '0400 000 105',
    role: 'Caregiver',
    type: 'Caregiver',
    office: 'Riverland',
    recruiter: 'Alex Morgan',
    stage: 'Background checks',
    stageAge: 8,
    intake: 'September B',
    source: 'Job board',
    applied: '30 Aug 2026',
    readiness: 43,
    risk: 'Blocked',
    requirements: baseRequirements.map((r, i) => ({
      ...r,
      state: i < 3 ? r.state : 'Not started',
    })),
  },
  {
    id: 106,
    name: 'Ethan Clarke',
    initials: 'EC',
    email: 'ethan.clarke@example.invalid',
    phone: '0400 000 106',
    role: 'Caregiver',
    type: 'Caregiver',
    office: 'Coastal',
    recruiter: 'Jordan Lee',
    stage: 'On hold',
    stageAge: 12,
    intake: 'October A',
    source: 'Referral',
    applied: '15 Aug 2026',
    readiness: 57,
    risk: 'Blocked',
    requirements: baseRequirements,
  },
  {
    id: 107,
    name: 'Maya Patel',
    initials: 'MP',
    email: 'maya.patel@example.invalid',
    phone: '0400 000 107',
    role: 'Caregiver',
    type: 'Caregiver',
    office: 'Central',
    recruiter: 'Taylor Singh',
    stage: 'Offer stage',
    stageAge: 3,
    intake: 'September B',
    source: 'Social campaign',
    applied: '27 Aug 2026',
    readiness: 83,
    risk: 'Clear',
    requirements: baseRequirements.map((r, i) => ({
      ...r,
      state: i < 5 ? 'Complete' : r.state,
    })),
  },
  {
    id: 108,
    name: 'Lucas Bennett',
    initials: 'LB',
    email: 'lucas.bennett@example.invalid',
    phone: '0400 000 108',
    role: 'Office Coordinator',
    type: 'Key player',
    office: 'Northside',
    recruiter: 'Casey Brooks',
    stage: 'Background checks',
    stageAge: 6,
    intake: 'September B',
    source: 'Job board',
    applied: '29 Aug 2026',
    readiness: 50,
    risk: 'Due soon',
    requirements: [
      { name: 'Qualifications', state: 'Complete', required: false },
      { name: 'Insurance', state: 'Waived', required: false },
      { name: 'Position description sent', state: 'Complete', required: true },
      {
        name: 'Reference check',
        state: 'In progress',
        due: '11 Sep',
        required: true,
      },
      {
        name: 'Assessment',
        state: 'Not started',
        due: '12 Sep',
        required: true,
      },
    ],
  },
];

const extraApplications: Application[] = [
  [
    'Zoe Martin',
    'Caregiver',
    'Bayside',
    'Jordan Lee',
    'Onboarded',
    'August B',
    100,
    'Clear',
  ],
  [
    'Jack Wilson',
    'Caregiver',
    'Northside',
    'Alex Morgan',
    'Onboarded',
    'August B',
    100,
    'Clear',
  ],
  [
    'Amelia Hart',
    'Caregiver',
    'Central',
    'Taylor Singh',
    'Contract signed',
    'September B',
    100,
    'Clear',
  ],
  [
    'Oliver Kim',
    'Caregiver',
    'Riverland',
    'Casey Brooks',
    'Withdrawn',
    'September A',
    29,
    'Clear',
  ],
  [
    'Isla Evans',
    'Caregiver',
    'Hills District',
    'Jordan Lee',
    'Offer stage',
    'October A',
    86,
    'Clear',
  ],
  [
    'Leo Carter',
    'Caregiver',
    'Coastal',
    'Alex Morgan',
    'Background checks',
    'October A',
    57,
    'Due soon',
  ],
  [
    'Harper Jones',
    'Caregiver',
    'Northside',
    'Casey Brooks',
    'Contract issued',
    'September B',
    93,
    'Clear',
  ],
  [
    'Aria Thompson',
    'Key player',
    'Bayside',
    'Taylor Singh',
    'Offer stage',
    'September B',
    82,
    'Due soon',
  ],
  [
    'Henry Davis',
    'Key player',
    'Hills District',
    'Jordan Lee',
    'Contract signed',
    'September A',
    100,
    'Clear',
  ],
  [
    'Mila Roberts',
    'Key player',
    'Coastal',
    'Alex Morgan',
    'Background checks',
    'October A',
    48,
    'Blocked',
  ],
].map((row, index) => {
  const [name, type, office, recruiter, stage, intake, readiness, risk] =
    row as [
      string,
      'Caregiver' | 'Key player',
      string,
      string,
      Stage,
      string,
      number,
      Application['risk'],
    ];
  const isKeyPlayer = type === 'Key player';
  const requirements = (
    isKeyPlayer
      ? [
          { name: 'Qualifications', required: true },
          { name: 'Insurance', required: false },
          { name: 'Position description sent', required: true },
          { name: 'Reference check', required: true },
          { name: 'Assessment', required: true },
        ]
      : baseRequirements
  ).map((requirement, requirementIndex) => ({
    ...requirement,
    state:
      readiness >= 95 ||
      requirementIndex < Math.round((readiness / 100) * (isKeyPlayer ? 5 : 7))
        ? ('Complete' as const)
        : requirementIndex === 2
          ? ('In progress' as const)
          : ('Not started' as const),
  }));
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('');
  return {
    id: 109 + index,
    name,
    initials,
    email: `${name.toLowerCase().replace(' ', '.')}@example.invalid`,
    phone: `0400 000 ${109 + index}`,
    role: isKeyPlayer
      ? index % 2
        ? 'Service Manager'
        : 'Clinical Lead'
      : 'Caregiver',
    type,
    office,
    recruiter,
    stage,
    stageAge: index + 1,
    intake,
    source: ['Referral', 'Job board', 'Direct sourcing'][index % 3],
    applied: `${18 + index} Aug 2026`,
    readiness,
    risk,
    requirements,
    outcomeReason: stage === 'Withdrawn' ? 'Candidate withdrew' : undefined,
  };
});

const seededApplications = [...initialApplications, ...extraApplications];

const officeRules: OfficeRule[] = [
  {
    office: 'Northside',
    code: 'NTH',
    region: 'Metro North',
    active: 11,
    readiness: 78,
    rules: ['Police check', 'Right to work', 'Driver licence'],
    exceptions: 2,
  },
  {
    office: 'Bayside',
    code: 'BAY',
    region: 'Metro East',
    active: 8,
    readiness: 84,
    rules: ['Police check', 'Right to work', 'First aid'],
    exceptions: 1,
  },
  {
    office: 'Central',
    code: 'CTR',
    region: 'Metro Central',
    active: 14,
    readiness: 81,
    rules: ['Police check', 'Right to work', 'Qualifications'],
    exceptions: 3,
  },
  {
    office: 'Hills District',
    code: 'HIL',
    region: 'Metro West',
    active: 6,
    readiness: 92,
    rules: ['Police check', 'Right to work', 'Driver licence'],
    exceptions: 0,
  },
  {
    office: 'Riverland',
    code: 'RIV',
    region: 'Regional',
    active: 9,
    readiness: 69,
    rules: ['Police check', 'Right to work', 'Statutory declaration'],
    exceptions: 4,
  },
  {
    office: 'Coastal',
    code: 'CST',
    region: 'Coastal',
    active: 7,
    readiness: 75,
    rules: ['Police check', 'Right to work', 'First aid'],
    exceptions: 2,
  },
];

const defaultRuleOptions = ['Not started', 'In progress', 'Complete', 'Waived'];
const initialOfficeRuleDefinitions: OfficeRuleDefinition[] = [
  ['Banning register', 'Check required before commencement'],
  ['Police check', 'Current national police check required'],
  ['Right to work', 'Evidence must be verified'],
  ['Reference check', 'Two satisfactory references'],
  ['Driver licence', 'Confirm against the duties of the role'],
  ['First aid', 'Current certificate where the role requires it'],
  ['Statutory declaration', 'Only when approved as an interim control'],
  ['Qualifications', 'Verify against the position requirements'],
].map(([label, defaultValue], index) => ({
  id: `office-rule-${index + 1}`,
  label,
  inputType: 'dropdown',
  options: defaultRuleOptions,
  defaultValue,
}));

const initialIntakes: IntakePlan[] = [
  { name: 'August B', date: '29 Aug 2026', requested: 16, status: 'Closed' },
  { name: 'September A', date: '12 Sep 2026', requested: 18, status: 'Open' },
  { name: 'September B', date: '26 Sep 2026', requested: 22, status: 'Open' },
  { name: 'October A', date: '10 Oct 2026', requested: 20, status: 'Open' },
];

const initialCaregiverColumns: TrackableColumn[] = [
  { id: 'candidate', label: 'Candidate', visible: true, group: 'Identity' },
  { id: 'status', label: 'Status', visible: true, group: 'Process' },
  { id: 'recruiter', label: 'Recruiter', visible: true, group: 'Identity' },
  { id: 'bgcStarted', label: 'BGC started', visible: true, group: 'Process' },
  {
    id: 'orientation',
    label: 'Orientation / intake',
    visible: true,
    group: 'Process',
  },
  { id: 'source', label: 'Source', visible: true, group: 'Identity' },
  { id: 'phone', label: 'Phone', visible: true, group: 'Identity' },
  { id: 'email', label: 'Email', visible: true, group: 'Identity' },
  { id: 'zone', label: 'Zone / location', visible: true, group: 'Identity' },
  {
    id: 'banning',
    label: 'Banning register',
    visible: true,
    group: 'Compliance',
  },
  {
    id: 'reference',
    label: 'Reference check',
    visible: true,
    group: 'Compliance',
  },
  { id: 'police', label: 'Police check', visible: true, group: 'Compliance' },
  { id: 'rtw', label: 'Right to work', visible: true, group: 'Compliance' },
  { id: 'statdec', label: 'Stat dec', visible: true, group: 'Compliance' },
  { id: 'payLevel', label: 'Pay level', visible: true, group: 'Process' },
  { id: 'driving', label: 'Driving req.', visible: true, group: 'Compliance' },
  { id: 'qc', label: 'QC complete', visible: true, group: 'Compliance' },
  { id: 'training', label: 'Training', visible: true, group: 'Process' },
  {
    id: 'contractStart',
    label: 'Contract start',
    visible: true,
    group: 'Process',
  },
  {
    id: 'rehire',
    label: 'Rehire / transfer',
    visible: true,
    group: 'Identity',
  },
  { id: 'onboarding', label: 'Onboarding', visible: true, group: 'Process' },
  { id: 'fileSent', label: 'File sent', visible: true, group: 'Outcome' },
  { id: 'notes', label: 'Notes', visible: true, group: 'Outcome' },
  { id: 'dns', label: 'DNS', visible: true, group: 'Outcome' },
];

const initialKeyPlayerColumns: TrackableColumn[] = [
  { id: 'candidate', label: 'Candidate', visible: true, group: 'Identity' },
  { id: 'office', label: 'Office', visible: true, group: 'Identity' },
  { id: 'role', label: 'Role title', visible: true, group: 'Identity' },
  { id: 'status', label: 'Status', visible: true, group: 'Process' },
  { id: 'recruiter', label: 'Recruiter', visible: true, group: 'Identity' },
  { id: 'assessment', label: 'Assessment', visible: true, group: 'Process' },
  {
    id: 'qualifications',
    label: 'Qualifications',
    visible: true,
    group: 'Compliance',
  },
  { id: 'insurance', label: 'Insurance', visible: true, group: 'Compliance' },
  {
    id: 'positionDesc',
    label: 'Position description sent',
    visible: true,
    group: 'Process',
  },
  {
    id: 'reference',
    label: 'Reference check',
    visible: true,
    group: 'Compliance',
  },
  {
    id: 'contractAccepted',
    label: 'Contract accepted',
    visible: true,
    group: 'Outcome',
  },
  { id: 'hmEmail', label: 'Email sent to HM', visible: true, group: 'Outcome' },
];

const nav = [
  { id: 'overview' as View, label: 'Overview', icon: LayoutDashboard },
  { id: 'pipeline' as View, label: 'Pipeline', icon: Users },
  { id: 'intakes' as View, label: 'Intakes', icon: CalendarDays },
  { id: 'trackables' as View, label: 'Workflows', icon: Activity },
  { id: 'offices' as View, label: 'Site requirements', icon: Building2 },
  { id: 'reports' as View, label: 'Reports', icon: BarChart3 },
];
const stageTone: Record<Stage, string> = {
  'Background checks': 'bg-sky-50 text-sky-700 border-sky-200',
  'Offer stage': 'bg-violet-50 text-violet-700 border-violet-200',
  'Contract issued': 'bg-amber-50 text-amber-700 border-amber-200',
  'Contract signed': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Onboarded: 'bg-teal-50 text-teal-700 border-teal-200',
  'On hold': 'bg-slate-100 text-slate-600 border-slate-200',
  Withdrawn: 'bg-rose-50 text-rose-700 border-rose-200',
};
const riskTone = {
  Clear: 'text-emerald-700 bg-emerald-50',
  'Due soon': 'text-amber-700 bg-amber-50',
  Blocked: 'text-rose-700 bg-rose-50',
};

function Avatar({
  initials,
  large = false,
}: {
  initials: string;
  large?: boolean;
}) {
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full bg-teal-100 font-semibold text-teal-800 ${large ? 'h-14 w-14 text-base' : 'h-9 w-9 text-xs'}`}
    >
      {initials}
    </div>
  );
}
function StageBadge({ stage }: { stage: Stage }) {
  return (
    <Badge
      variant="outline"
      className={`whitespace-nowrap font-medium ${stageTone[stage]}`}
    >
      {stage}
    </Badge>
  );
}
function Heading({
  eyebrow,
  title,
  body,
  actions,
}: {
  eyebrow: string;
  title: string;
  body: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-[.14em] text-teal-700">
          {eyebrow}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-[28px]">
          {title}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">{body}</p>
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
function Metric({
  label,
  value,
  delta,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  delta: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <Card className="border-slate-200/90 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              {value}
            </p>
          </div>
          <div className={`rounded-xl p-2.5 ${accent}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">{delta}</p>
      </CardContent>
    </Card>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

export default function Prototype() {
  const [view, setView] = useState<View>('overview');
  const [apps, setApps] = useState<Application[]>(seededApplications);
  const [selectedId, setSelectedId] = useState(105);
  const [query, setQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('All stages');
  const [officeFilter, setOfficeFilter] = useState('All offices');
  const [persona, setPersona] = useState('Recruitment manager');
  const [addOpen, setAddOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState('');
  const [pipelineType, setPipelineType] = useState<'Caregiver' | 'Key player'>(
    'Caregiver',
  );
  const [caregiverColumns, setCaregiverColumns] = useState<TrackableColumn[]>(
    initialCaregiverColumns,
  );
  const [keyPlayerColumns, setKeyPlayerColumns] = useState<TrackableColumn[]>(
    initialKeyPlayerColumns,
  );
  const [officeConfigs, setOfficeConfigs] = useState<OfficeRule[]>(officeRules);
  const [officeRuleDefinitions, setOfficeRuleDefinitions] = useState<
    OfficeRuleDefinition[]
  >(initialOfficeRuleDefinitions);
  const [intakes, setIntakes] = useState<IntakePlan[]>(initialIntakes);
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    'Loading' | 'Saving' | 'Saved' | 'Session only'
  >('Loading');
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [outcomeStage, setOutcomeStage] = useState<'On hold' | 'Withdrawn'>(
    'On hold',
  );
  const [outcomeReason, setOutcomeReason] = useState(
    'Candidate requested more time',
  );
  const [addOfficeLocked, setAddOfficeLocked] = useState(false);
  const [newDraft, setNewDraft] = useState({
    name: 'Jamie Rivera',
    type: 'Caregiver' as 'Caregiver' | 'Key player',
    office: 'Bayside',
    recruiter: 'Alex Morgan',
    intake: 'October A',
    source: 'Job board',
    role: 'Caregiver',
  });
  const selected = apps.find((app) => app.id === selectedId) ?? apps[0];
  const activeCount = apps.filter((app) =>
    stages.slice(0, 4).includes(app.stage),
  ).length;
  const filtered = useMemo(
    () =>
      apps.filter(
        (app) =>
          `${app.name} ${app.office} ${app.role} ${app.recruiter}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (stageFilter === 'All stages' || app.stage === stageFilter) &&
          (officeFilter === 'All offices' || app.office === officeFilter),
      ),
    [apps, query, stageFilter, officeFilter],
  );
  const openCandidate = (id: number) => {
    setSelectedId(id);
    setView('candidate');
    setMobileNav(false);
  };
  const editPipelineCell = (id: number, columnId: string, value: string) => {
    setApps((current) =>
      current.map((app) =>
        app.id === id ? updateApplicationCell(app, columnId, value) : app,
      ),
    );
  };
  const openAddCandidate = () => {
    const hasSpecificOffice = officeFilter !== 'All offices';
    const targetOffice = hasSpecificOffice
      ? officeFilter
      : officeConfigs.some((office) => office.office === newDraft.office)
        ? newDraft.office
        : (officeConfigs[0]?.office ?? '');
    setNewDraft((draft) => ({
      ...draft,
      type: pipelineType,
      office: targetOffice,
      role: pipelineType === 'Caregiver' ? 'Caregiver' : 'Clinical Lead',
    }));
    setAddOfficeLocked(hasSpecificOffice);
    setAddOpen(true);
  };
  const changeRequirement = (index: number, value: string) => {
    setApps((current) =>
      current.map((app) => {
        if (app.id !== selected.id) return app;
        const requirements = app.requirements.map((r, i) => {
          if (i !== index) return r;
          const standardState = defaultRuleOptions.includes(value)
            ? (value as RequirementState)
            : value.trim()
              ? ('Complete' as const)
              : ('Not started' as const);
          return { ...r, value, state: standardState };
        });
        const cleared = requirements.filter((r) =>
          ['Complete', 'Waived'].includes(r.state),
        ).length;
        return {
          ...app,
          requirements,
          readiness: Math.round((cleared / requirements.length) * 100),
          risk: cleared === requirements.length ? 'Clear' : app.risk,
        };
      }),
    );
    setNotice(
      value && value !== 'Not started'
        ? 'Requirement updated and readiness recalculated.'
        : 'Requirement reopened and readiness recalculated.',
    );
  };
  const advanceStage = () => {
    const currentIndex = stages.indexOf(selected.stage);
    const incomplete = selected.requirements.filter(
      (r) => r.required && !['Complete', 'Waived'].includes(r.state),
    ).length;
    if (incomplete && selected.stage === 'Background checks')
      return setNotice(
        `${incomplete} required items still need attention before this application can advance.`,
      );
    if (currentIndex >= 0 && currentIndex < stages.length - 1) {
      const next = stages[currentIndex + 1];
      setApps((current) =>
        current.map((app) =>
          app.id === selected.id
            ? { ...app, stage: next, stageAge: 0, risk: 'Clear' }
            : app,
        ),
      );
      setNotice(
        `Application moved to ${next}. Stage history and notifications updated.`,
      );
    }
  };
  const addApplication = () => {
    const id = Math.max(...apps.map((a) => a.id)) + 1;
    const workflow =
      newDraft.type === 'Caregiver' ? caregiverColumns : keyPlayerColumns;
    const coreFields = new Set([
      'candidate',
      'status',
      'recruiter',
      'source',
      'phone',
      'email',
      'zone',
      'office',
      'role',
      'notes',
      'dns',
    ]);
    const workflowSteps = workflow.filter(
      (column) => column.visible && !coreFields.has(column.id),
    );
    const requirements = workflowSteps.map((definition) => {
      return {
        name: definition.label,
        state: 'Not started' as const,
        required: definition.group === 'Compliance',
        inputType: definition?.inputType,
        options: definition?.options,
        value: '',
      };
    });
    const initials = newDraft.name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    const fresh: Application = {
      id,
      name: newDraft.name,
      initials,
      email: `${newDraft.name.toLowerCase().replace(/\s+/g, '.')}@example.invalid`,
      phone: `0400 000 ${id}`,
      role: newDraft.role,
      type: newDraft.type,
      office: newDraft.office,
      recruiter: newDraft.recruiter,
      stage: 'Background checks',
      stageAge: 0,
      intake: newDraft.intake,
      source: newDraft.source,
      applied: '6 Sep 2026',
      readiness: 0,
      risk: 'Clear',
      requirements,
    };
    setApps((current) => [fresh, ...current]);
    setAddOpen(false);
    setSelectedId(id);
    setView('candidate');
    setNotice(
      `Candidate added. ${requirements.length} workflow steps generated from the ${newDraft.type} workflow.`,
    );
  };
  const applyOutcome = () => {
    setApps((current) =>
      current.map((app) =>
        app.id === selected.id
          ? {
              ...app,
              stage: outcomeStage,
              outcomeReason,
              dns:
                outcomeStage === 'Withdrawn' &&
                outcomeReason === 'Did not start',
            }
          : app,
      ),
    );
    setOutcomeOpen(false);
    setNotice(
      `${selected.name} moved to ${outcomeStage}. Outcome reporting updated.`,
    );
  };

  useEffect(() => {
    let active = true;
    fetch('/api/state', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('State unavailable');
        return response.json() as Promise<{ state?: PrototypeState | null }>;
      })
      .then((data) => {
        if (!active) return;
        if (data.state?.applications?.length) {
          setApps(data.state.applications);
          setCaregiverColumns(data.state.caregiverColumns);
          setKeyPlayerColumns(data.state.keyPlayerColumns);
          if (data.state.officeConfigs?.length)
            setOfficeConfigs(data.state.officeConfigs);
          if (data.state.officeRuleDefinitions?.length) {
            setOfficeRuleDefinitions(
              (data.state.officeRuleDefinitions as unknown[]).map(
                (definition, index) =>
                  typeof definition === 'string'
                    ? {
                        id: `migrated-office-rule-${index + 1}`,
                        label: definition,
                        inputType: 'dropdown' as const,
                        options: defaultRuleOptions,
                        defaultValue:
                          'Required unless an office variation is recorded',
                      }
                    : {
                        ...(definition as OfficeRuleDefinition),
                        defaultValue:
                          (definition as OfficeRuleDefinition).defaultValue ??
                          'Required unless an office variation is recorded',
                      },
              ),
            );
          } else if (data.state.officeConfigs?.length) {
            setOfficeRuleDefinitions(
              Array.from(
                new Set(
                  data.state.officeConfigs.flatMap((office) => office.rules),
                ),
              ).map((label, index) => ({
                id: `migrated-office-rule-${index + 1}`,
                label,
                inputType: 'dropdown' as const,
                options: defaultRuleOptions,
                defaultValue: 'Required unless an office variation is recorded',
              })),
            );
          }
          if (data.state.intakes?.length) setIntakes(data.state.intakes);
        }
        setHydrated(true);
        setSaveStatus('Saved');
      })
      .catch(() => {
        if (active) {
          setHydrated(true);
          setSaveStatus('Session only');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || saveStatus === 'Session only') return;
    setSaveStatus('Saving');
    const timer = window.setTimeout(() => {
      const state: PrototypeState = {
        applications: apps,
        caregiverColumns,
        keyPlayerColumns,
        officeConfigs,
        officeRuleDefinitions,
        intakes,
      };
      fetch('/api/state', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state }),
      })
        .then((response) => {
          if (!response.ok) throw new Error('Save failed');
          setSaveStatus('Saved');
        })
        .catch(() => setSaveStatus('Session only'));
    }, 600);
    return () => window.clearTimeout(timer);
  }, [
    apps,
    caregiverColumns,
    keyPlayerColumns,
    officeConfigs,
    officeRuleDefinitions,
    intakes,
    hydrated,
  ]);

  useEffect(() => {
    type ToolDefinition = {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: Record<string, unknown>) => unknown;
    };
    const modelContext = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: ToolDefinition,
            options?: { signal?: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: ToolDefinition) => {
      try {
        void Promise.resolve(
          modelContext.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => undefined);
      } catch {
        /* Unsupported preview implementations are ignored. */
      }
    };
    register({
      name: 'navigate_recruitment_view',
      title: 'Open recruitment view',
      description:
        'Open a main prototype view: overview, pipeline, intakes, offices, reports, trackables, or automations.',
      inputSchema: {
        type: 'object',
        properties: {
          view: {
            type: 'string',
            enum: [
              'overview',
              'pipeline',
              'intakes',
              'offices',
              'reports',
              'trackables',
              'automations',
            ],
          },
        },
        required: ['view'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input) {
        const target = String(input.view);
        if (
          ![
            'overview',
            'pipeline',
            'intakes',
            'offices',
            'reports',
            'trackables',
            'automations',
          ].includes(target)
        )
          throw new Error('Unknown view');
        setView(target as View);
        return { view: target };
      },
    });
    register({
      name: 'find_synthetic_applications',
      title: 'Find synthetic applications',
      description:
        'Search the currently loaded synthetic application records by candidate, office, role, or recruiter.',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input) {
        const q = String(input.query ?? '').toLowerCase();
        return apps
          .filter((a) =>
            `${a.name} ${a.office} ${a.role} ${a.recruiter}`
              .toLowerCase()
              .includes(q),
          )
          .map((a) => ({
            id: a.id,
            name: a.name,
            office: a.office,
            stage: a.stage,
            readiness: a.readiness,
          }));
      },
    });
    register({
      name: 'open_synthetic_application',
      title: 'Open synthetic application',
      description:
        'Open one synthetic application record in the visible candidate workspace.',
      inputSchema: {
        type: 'object',
        properties: { applicationId: { type: 'number' } },
        required: ['applicationId'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input) {
        const id = Number(input.applicationId);
        if (!apps.some((a) => a.id === id))
          throw new Error('Application not found');
        setSelectedId(id);
        setView('candidate');
        return { applicationId: id, view: 'candidate' };
      },
    });
    register({
      name: 'complete_application_requirement',
      title: 'Complete requirement',
      description:
        'Mark a requirement complete on a synthetic application and open that record.',
      inputSchema: {
        type: 'object',
        properties: {
          applicationId: { type: 'number' },
          requirement: { type: 'string' },
        },
        required: ['applicationId', 'requirement'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const id = Number(input.applicationId);
        const requirement = String(input.requirement);
        const application = apps.find((a) => a.id === id);
        if (!application) throw new Error('Application not found');
        if (!application.requirements.some((r) => r.name === requirement))
          throw new Error('Requirement not found');
        setApps((current) =>
          current.map((a) =>
            a.id === id
              ? {
                  ...a,
                  requirements: a.requirements.map((r) =>
                    r.name === requirement ? { ...r, state: 'Complete' } : r,
                  ),
                }
              : a,
          ),
        );
        setSelectedId(id);
        setView('candidate');
        setNotice(`${requirement} marked complete.`);
        return { applicationId: id, requirement, state: 'Complete' };
      },
    });
    register({
      name: 'add_tracking_column',
      title: 'Add tracking column',
      description:
        'Add a visible configurable tracking column to the Caregiver or Key Player grid.',
      inputSchema: {
        type: 'object',
        properties: {
          workspace: { type: 'string', enum: ['Caregiver', 'Key player'] },
          label: { type: 'string', minLength: 1 },
          group: {
            type: 'string',
            enum: ['Identity', 'Process', 'Compliance', 'Outcome'],
          },
        },
        required: ['workspace', 'label', 'group'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const workspace = String(input.workspace);
        const label = String(input.label).trim();
        const group = String(input.group) as TrackableColumn['group'];
        if (!label) throw new Error('Column label is required');
        const column = {
          id: `custom-${Date.now()}`,
          label,
          group,
          visible: true,
        } as TrackableColumn;
        if (workspace === 'Caregiver')
          setCaregiverColumns((current) => [...current, column]);
        else if (workspace === 'Key player')
          setKeyPlayerColumns((current) => [...current, column]);
        else throw new Error('Unknown workspace');
        setView('trackables');
        setNotice(`${label} added to the ${workspace} tracking view.`);
        return { workspace, label, group, visible: true };
      },
    });
    return () => lifecycle.abort();
  }, [apps]);

  return (
    <div className="min-h-screen bg-[#f4f7f9] text-slate-900">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[244px] border-r border-white/10 bg-[#102732] text-white transition-transform lg:translate-x-0 ${mobileNav ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-full flex-col px-3 py-4">
          <div className="flex h-12 items-center gap-3 px-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-teal-400 text-[#102732]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">
                Recruitment Ops
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Synthetic prototype
              </p>
            </div>
            <button
              aria-label="Close menu"
              title="Close menu"
              className="ml-auto rounded-md p-1 text-slate-400 lg:hidden"
              onClick={() => setMobileNav(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="mt-7 space-y-1">
            {nav.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setView(item.id);
                  setMobileNav(false);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${view === item.id || (view === 'candidate' && item.id === 'pipeline') ? 'bg-white/10 font-medium text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
              >
                <item.icon className="h-[18px] w-[18px]" />
                {item.label}
                {item.id === 'pipeline' && (
                  <span className="ml-auto rounded-full bg-teal-400/15 px-2 py-0.5 text-[11px] text-teal-300">
                    {activeCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="mt-7 border-t border-white/10 pt-5">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">
              Workspace
            </p>
            <button
              onClick={() => {
                setView('automations');
                setMobileNav(false);
              }}
              className={`mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${view === 'automations' ? 'bg-white/10 font-medium text-white' : 'text-slate-300 hover:bg-white/5'}`}
            >
              <ShieldCheck className="h-[18px] w-[18px]" />
              Automations
            </button>
          </div>
          <div className="mt-auto rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-teal-400/20 text-xs font-semibold text-teal-300">
                AM
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">Alex Morgan</p>
                <p className="truncate text-[10px] text-slate-400">{persona}</p>
              </div>
              <ChevronDown className="ml-auto h-4 w-4 text-slate-500" />
            </div>
            <select
              aria-label="Preview persona"
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              className="mt-3 w-full rounded-md border border-white/10 bg-[#193541] px-2 py-1.5 text-[11px] text-slate-200 outline-none"
            >
              <option>Recruitment manager</option>
              <option>Recruiter</option>
              <option>Compliance reviewer</option>
            </select>
          </div>
        </div>
      </aside>
      <div className="lg:pl-[244px]">
        <header className="sticky top-0 z-30 flex h-16 items-center border-b border-slate-200/90 bg-white/95 px-4 backdrop-blur md:px-7">
          <button
            aria-label="Open menu"
            title="Open menu"
            onClick={() => setMobileNav(true)}
            className="mr-3 rounded-lg border border-slate-200 p-2 lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="relative hidden w-72 md:block">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => view !== 'pipeline' && setView('pipeline')}
              placeholder="Search people, office or role"
              className="h-9 border-slate-200 bg-slate-50 pl-9 text-sm"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge
              variant="outline"
              className={`hidden sm:inline-flex ${saveStatus === 'Session only' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-teal-200 bg-teal-50 text-teal-700'}`}
            >
              <span
                className={`mr-1.5 h-1.5 w-1.5 rounded-full ${saveStatus === 'Saving' ? 'animate-pulse bg-sky-500' : saveStatus === 'Session only' ? 'bg-amber-500' : 'bg-teal-500'}`}
              />
              {saveStatus === 'Saved'
                ? 'Changes saved'
                : saveStatus === 'Saving'
                  ? 'Saving changes'
                  : saveStatus === 'Loading'
                    ? 'Loading data'
                    : 'Session only'}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              title="Notifications"
              className="relative"
              onClick={() =>
                setNotice(
                  '5 reminders are due today: 2 blocked checks, 2 due soon, and 1 intake review.',
                )
              }
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-500" />
            </Button>
          </div>
        </header>
        {notice && (
          <div
            className={`mx-4 mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm md:mx-7 ${notice.includes('still need') ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-teal-200 bg-teal-50 text-teal-800'}`}
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{notice}</span>
            <button
              aria-label="Dismiss"
              title="Dismiss"
              onClick={() => setNotice('')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <main className="p-4 md:p-7">
          {view === 'overview' && (
            <Overview apps={apps} openCandidate={openCandidate} go={setView} />
          )}
          {view === 'pipeline' && (
            <Pipeline
              apps={filtered}
              query={query}
              setQuery={setQuery}
              stageFilter={stageFilter}
              setStageFilter={setStageFilter}
              officeFilter={officeFilter}
              setOfficeFilter={setOfficeFilter}
              openCandidate={openCandidate}
              type={pipelineType}
              setType={setPipelineType}
              caregiverColumns={caregiverColumns}
              keyPlayerColumns={keyPlayerColumns}
              officeConfigs={officeConfigs}
              intakes={intakes}
              configure={() => setView('trackables')}
              addCandidate={openAddCandidate}
              onCellChange={editPipelineCell}
            />
          )}
          {view === 'candidate' && (
            <Candidate
              key={selected.id}
              app={selected}
              goBack={() => setView('pipeline')}
              onRequirement={changeRequirement}
              onAdvance={advanceStage}
              onOutcome={() => setOutcomeOpen(true)}
              intakes={intakes}
              onNote={(notes) => {
                setApps((current) =>
                  current.map((a) =>
                    a.id === selected.id ? { ...a, notes } : a,
                  ),
                );
                setNotice('Internal note saved.');
              }}
              onIntake={(value) => {
                setApps((current) =>
                  current.map((a) =>
                    a.id === selected.id ? { ...a, intake: value } : a,
                  ),
                );
                setNotice(`Assigned to ${value}. Intake capacity updated.`);
              }}
            />
          )}
          {view === 'intakes' && (
            <Intakes
              apps={apps}
              intakes={intakes}
              setIntakes={setIntakes}
              openCandidate={openCandidate}
              notify={setNotice}
              setApps={setApps}
            />
          )}
          {view === 'offices' && (
            <Offices
              notify={setNotice}
              officeConfigs={officeConfigs}
              setOfficeConfigs={setOfficeConfigs}
              ruleDefinitions={officeRuleDefinitions}
              setRuleDefinitions={setOfficeRuleDefinitions}
            />
          )}
          {view === 'reports' && (
            <Reports
              apps={apps}
              officeConfigs={officeConfigs}
              intakes={intakes}
            />
          )}
          {view === 'trackables' && (
            <Workflows
              caregiverColumns={caregiverColumns}
              setCaregiverColumns={setCaregiverColumns}
              keyPlayerColumns={keyPlayerColumns}
              setKeyPlayerColumns={setKeyPlayerColumns}
              notify={setNotice}
            />
          )}
          {view === 'automations' && <Automations notify={setNotice} />}
        </main>
      </div>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add candidate</DialogTitle>
            <DialogDescription>
              Adding a synthetic{' '}
              {newDraft.type === 'Caregiver' ? 'Caregiver' : 'Key Player'}{' '}
              candidate to {newDraft.office}. The correct checklist will be
              generated automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Candidate name
              <Input
                value={newDraft.name}
                onChange={(e) =>
                  setNewDraft((draft) => ({ ...draft, name: e.target.value }))
                }
                className="mt-1.5"
              />
            </label>
            <label className="text-sm font-medium">
              Candidate type
              <Input
                value={
                  newDraft.type === 'Caregiver' ? 'Caregiver' : 'Key Player'
                }
                disabled
                className="mt-1.5 bg-slate-50"
              />
            </label>
            <label className="text-sm font-medium">
              Role
              <Input
                value={newDraft.role}
                onChange={(e) =>
                  setNewDraft((draft) => ({ ...draft, role: e.target.value }))
                }
                className="mt-1.5"
              />
            </label>
            <label className="text-sm font-medium">
              Office
              <select
                value={newDraft.office}
                onChange={(e) =>
                  setNewDraft((draft) => ({ ...draft, office: e.target.value }))
                }
                disabled={addOfficeLocked}
                className="form-select mt-1.5 disabled:bg-slate-50 disabled:text-slate-700"
              >
                {officeConfigs.map((office) => (
                  <option key={office.office}>{office.office}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Recruiter
              <select
                value={newDraft.recruiter}
                onChange={(e) =>
                  setNewDraft((draft) => ({
                    ...draft,
                    recruiter: e.target.value,
                  }))
                }
                className="form-select mt-1.5"
              >
                <option>Alex Morgan</option>
                <option>Jordan Lee</option>
                <option>Taylor Singh</option>
                <option>Casey Brooks</option>
              </select>
            </label>
            <label className="text-sm font-medium">
              Intake
              <select
                value={newDraft.intake}
                onChange={(e) =>
                  setNewDraft((draft) => ({ ...draft, intake: e.target.value }))
                }
                className="form-select mt-1.5"
              >
                {intakes
                  .filter((intake) => intake.status === 'Open')
                  .map((intake) => (
                    <option key={intake.name}>{intake.name}</option>
                  ))}
              </select>
            </label>
            <label className="text-sm font-medium sm:col-span-2">
              Source
              <select
                value={newDraft.source}
                onChange={(e) =>
                  setNewDraft((draft) => ({ ...draft, source: e.target.value }))
                }
                className="form-select mt-1.5"
              >
                <option>Job board</option>
                <option>Referral</option>
                <option>Community event</option>
                <option>Direct sourcing</option>
                <option>Social campaign</option>
              </select>
            </label>
          </div>
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
            <Sparkles className="mr-2 inline h-4 w-4" />
            The {newDraft.type === 'Caregiver' ? 'Caregiver' : 'Key Player'}
            workflow will generate this candidate&apos;s steps.{' '}
            {newDraft.office}
            information remains available in Site Requirements → Lookup.
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!newDraft.name.trim() || !newDraft.role.trim()}
              onClick={addApplication}
              className="bg-teal-700 hover:bg-teal-800"
            >
              Add Candidate
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={outcomeOpen} onOpenChange={setOutcomeOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Set application outcome</DialogTitle>
            <DialogDescription>
              Record a structured outcome so reporting and follow-up remain
              accurate.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <label className="text-sm font-medium">
              Outcome
              <select
                value={outcomeStage}
                onChange={(e) =>
                  setOutcomeStage(e.target.value as 'On hold' | 'Withdrawn')
                }
                className="form-select mt-1.5"
              >
                <option>On hold</option>
                <option>Withdrawn</option>
              </select>
            </label>
            <label className="text-sm font-medium">
              Reason
              <select
                value={outcomeReason}
                onChange={(e) => setOutcomeReason(e.target.value)}
                className="form-select mt-1.5"
              >
                {outcomeStage === 'On hold' ? (
                  <>
                    <option>Candidate requested more time</option>
                    <option>Awaiting document</option>
                    <option>Role paused</option>
                    <option>Intake deferred</option>
                  </>
                ) : (
                  <>
                    <option>Candidate withdrew</option>
                    <option>No response</option>
                    <option>Requirements not met</option>
                    <option>Did not start</option>
                    <option>Role no longer available</option>
                  </>
                )}
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOutcomeOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={applyOutcome}
              className="bg-teal-700 hover:bg-teal-800"
            >
              Save outcome
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Overview({
  apps,
  openCandidate,
  go,
}: {
  apps: Application[];
  openCandidate: (id: number) => void;
  go: (v: View) => void;
}) {
  const exceptions = apps.filter((a) => a.risk !== 'Clear');
  const active = apps.filter((app) =>
    stages.slice(0, 4).includes(app.stage),
  ).length;
  const hires = apps.filter((app) => app.stage === 'Onboarded').length;
  const ready = apps.filter(
    (app) => app.readiness >= 80 && app.stage !== 'Onboarded',
  ).length;
  const stageSummary: Array<[string, number, string]> = [
    [
      'Background checks',
      apps.filter((a) => a.stage === 'Background checks').length,
      'bg-sky-500',
    ],
    [
      'Offer stage',
      apps.filter((a) => a.stage === 'Offer stage').length,
      'bg-violet-500',
    ],
    [
      'Contract issued',
      apps.filter((a) => a.stage === 'Contract issued').length,
      'bg-amber-500',
    ],
    [
      'Contract signed',
      apps.filter((a) => a.stage === 'Contract signed').length,
      'bg-emerald-500',
    ],
    [
      'On hold',
      apps.filter((a) => a.stage === 'On hold').length,
      'bg-slate-400',
    ],
  ];
  return (
    <>
      <Heading
        eyebrow="Tuesday, 6 September"
        title="Recruitment overview"
        body="One live view across offices, intakes and compliance—replacing manual rollups and copied formulas."
        actions={
          <Button variant="outline" onClick={() => go('reports')}>
            <BarChart3 className="mr-2 h-4 w-4" />
            View reports
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Active applications"
          value={String(active)}
          delta="Across 6 synthetic offices"
          icon={Users}
          accent="bg-sky-50 text-sky-700"
        />
        <Metric
          label="Hires in sample"
          value={String(hires)}
          delta="Updates when a record is onboarded"
          icon={CheckCircle2}
          accent="bg-emerald-50 text-emerald-700"
        />
        <Metric
          label="Ready for intake"
          value={String(ready)}
          delta="80% readiness or higher"
          icon={CalendarDays}
          accent="bg-violet-50 text-violet-700"
        />
        <Metric
          label="Open exceptions"
          value={String(exceptions.length)}
          delta={`${exceptions.filter((a) => a.risk === 'Blocked').length} blocked · ${exceptions.filter((a) => a.risk === 'Due soon').length} due soon`}
          icon={AlertCircle}
          accent="bg-rose-50 text-rose-700"
        />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-base">Pipeline by stage</CardTitle>
              <p className="mt-1 text-xs text-slate-500">
                Active applications only; on hold is separate
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => go('pipeline')}>
              Open pipeline
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {stageSummary.map(([label, value, colour]) => (
                <button
                  key={label}
                  onClick={() => go('pipeline')}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"
                >
                  <div className={`mb-8 h-1.5 w-full rounded-full ${colour}`} />
                  <p className="text-2xl font-semibold">{value}</p>
                  <p className="mt-1 text-xs leading-tight text-slate-500">
                    {label}
                  </p>
                </button>
              ))}
            </div>
            <MiniBars />
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Attention needed</CardTitle>
              <p className="mt-1 text-xs text-slate-500">
                Prioritised by due date and stage age
              </p>
            </div>
            <Badge
              variant="outline"
              className="border-rose-200 bg-rose-50 text-rose-700"
            >
              {exceptions.length} shown
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {exceptions.slice(0, 5).map((app) => (
              <button
                key={app.id}
                onClick={() => openCandidate(app.id)}
                className="flex w-full items-center gap-3 rounded-lg border border-transparent p-2 text-left hover:border-slate-200 hover:bg-slate-50"
              >
                <Avatar initials={app.initials} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{app.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {app.office} · {app.stageAge} days in stage
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-semibold ${riskTone[app.risk]}`}
                >
                  {app.risk}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <Card className="border-slate-200 shadow-sm md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Upcoming intake readiness
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              ['September A', '12 Sep', 18, 14, 12],
              ['September B', '26 Sep', 22, 17, 11],
              ['October A', '10 Oct', 20, 9, 4],
            ].map(([name, date, requested, assigned, ready]) => (
              <div
                key={String(name)}
                className="grid grid-cols-[96px_1fr_auto] items-center gap-3"
              >
                <div>
                  <p className="text-sm font-medium">{name}</p>
                  <p className="text-[11px] text-slate-500">{date}</p>
                </div>
                <Progress
                  value={(Number(assigned) / Number(requested)) * 100}
                  className="h-2"
                />
                <p className="text-xs text-slate-500">
                  <strong className="text-slate-800">{ready}</strong> ready /{' '}
                  {requested}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-[#102732] text-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-teal-300">
              <Activity className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[.12em]">
                Automation pulse
              </p>
            </div>
            <p className="mt-4 text-3xl font-semibold">34</p>
            <p className="text-sm text-slate-300">workflow actions today</p>
            <div className="mt-5 space-y-2 text-xs text-slate-300">
              <p className="flex justify-between">
                <span>Reminders sent</span>
                <strong className="text-white">18</strong>
              </p>
              <p className="flex justify-between">
                <span>Checklists generated</span>
                <strong className="text-white">9</strong>
              </p>
              <p className="flex justify-between">
                <span>Stage gates applied</span>
                <strong className="text-white">7</strong>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function MiniBars() {
  return (
    <div className="mt-5 rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">
          Rolling 3-month conversion
        </span>
        <span className="text-slate-500">Requested 156 · Hired 128</span>
      </div>
      <div className="mt-4 flex h-24 items-end gap-5">
        {[
          ['Jul', 64, 53],
          ['Aug', 82, 68],
          ['Sep', 76, 61],
        ].map(([month, requested, hired]) => (
          <div
            key={String(month)}
            className="flex flex-1 items-end justify-center gap-1.5"
          >
            <div
              className="w-5 rounded-t bg-slate-200"
              style={{ height: `${requested}%` }}
            />
            <div
              className="w-5 rounded-t bg-teal-600"
              style={{ height: `${hired}%` }}
            />
            <span className="ml-1 text-[10px] text-slate-400">{month}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-end gap-4 text-[10px] text-slate-500">
        <span>
          <i className="mr-1 inline-block h-2 w-2 bg-slate-200" />
          Requested
        </span>
        <span>
          <i className="mr-1 inline-block h-2 w-2 bg-teal-600" />
          Hired
        </span>
      </div>
    </div>
  );
}

function requirementState(app: Application, name: string) {
  const requirement = app.requirements.find((r) =>
    r.name.toLowerCase().includes(name.toLowerCase()),
  );
  return requirement?.value || requirement?.state || 'Not started';
}

function cellValue(app: Application, id: string): string {
  if (app.trackingValues?.[id] !== undefined) return app.trackingValues[id];
  const values: Record<string, string> = {
    candidate: app.name,
    status: app.stage,
    recruiter: app.recruiter,
    bgcStarted: app.applied,
    orientation: app.intake,
    source: app.source,
    phone: app.phone,
    email: app.email,
    zone:
      officeRules.find((o) => o.office === app.office)?.region ?? app.office,
    banning: requirementState(app, 'Banning'),
    reference: requirementState(app, 'Reference'),
    police: requirementState(app, 'Police'),
    rtw: requirementState(app, 'Right to work'),
    statdec: requirementState(app, 'Statutory'),
    driving: requirementState(app, 'Driver'),
    qc: requirementState(app, 'Quality'),
    qualifications: requirementState(app, 'Qualification'),
    insurance: requirementState(app, 'Insurance'),
    assessment: requirementState(app, 'Assessment'),
    positionDesc: requirementState(app, 'Position description'),
    payLevel: app.id % 2 ? 'Level 2' : 'Level 3',
    training: app.readiness > 80 ? 'Booked' : 'Pending',
    contractStart: app.stage.includes('Contract') ? '14 Sep 2026' : '—',
    rehire: app.id % 3 === 0 ? 'Transfer' : 'New starter',
    onboarding: app.stage === 'Contract signed' ? 'In progress' : 'Not started',
    fileSent: app.stage === 'Contract signed' ? 'Yes' : 'No',
    notes: app.notes || (app.risk === 'Clear' ? '—' : 'Follow-up required'),
    dns: app.dns ? 'Yes' : 'No',
    office: app.office,
    role: app.role,
    contractAccepted:
      app.stage === 'Contract signed' ? 'Complete' : 'Not started',
    hmEmail: app.stage === 'Contract signed' ? 'Complete' : 'Not started',
  };
  return values[id] ?? 'Not started';
}

const requirementNeedles: Record<string, string> = {
  banning: 'Banning',
  reference: 'Reference',
  police: 'Police',
  rtw: 'Right to work',
  statdec: 'Statutory',
  driving: 'Driver',
  qc: 'Quality',
  qualifications: 'Qualification',
  insurance: 'Insurance',
  assessment: 'Assessment',
  positionDesc: 'Position description',
};

function updateApplicationCell(
  app: Application,
  columnId: string,
  value: string,
): Application {
  if (columnId === 'status') return { ...app, stage: value as Stage };
  if (columnId === 'recruiter') return { ...app, recruiter: value };
  if (columnId === 'orientation') return { ...app, intake: value };
  if (columnId === 'source') return { ...app, source: value };
  if (columnId === 'phone') return { ...app, phone: value };
  if (columnId === 'email') return { ...app, email: value };
  if (columnId === 'office') return { ...app, office: value };
  if (columnId === 'role') return { ...app, role: value };
  if (columnId === 'notes') return { ...app, notes: value };
  if (columnId === 'dns') return { ...app, dns: value === 'Yes' };
  const needle = requirementNeedles[columnId];
  if (needle) {
    const requirements = app.requirements.map((requirement) => {
      if (!requirement.name.toLowerCase().includes(needle.toLowerCase())) {
        return requirement;
      }
      const state = defaultRuleOptions.includes(value)
        ? (value as RequirementState)
        : value.trim()
          ? ('Complete' as const)
          : ('Not started' as const);
      return { ...requirement, value, state };
    });
    const cleared = requirements.filter((requirement) =>
      ['Complete', 'Waived'].includes(requirement.state),
    ).length;
    return {
      ...app,
      requirements,
      readiness: requirements.length
        ? Math.round((cleared / requirements.length) * 100)
        : 0,
    };
  }
  return {
    ...app,
    trackingValues: { ...app.trackingValues, [columnId]: value },
  };
}

function TouchpointCell({ value, id }: { value: string; id: string }) {
  if (id === 'status') return <StageBadge stage={value as Stage} />;
  if (['Complete', 'Yes', 'Waived'].includes(value))
    return (
      <span className="touch touch-done">
        <Check className="h-3.5 w-3.5" />
        {value}
      </span>
    );
  if (['In progress', 'Booked'].includes(value))
    return <span className="touch touch-progress">{value}</span>;
  if (['Not started', 'Pending', 'No'].includes(value))
    return <span className="touch touch-empty">{value}</span>;
  return (
    <span className="whitespace-nowrap text-sm text-slate-700">{value}</span>
  );
}

function EditablePipelineCell({
  app,
  column,
  officeConfigs,
  intakes,
  onChange,
}: {
  app: Application;
  column: TrackableColumn;
  officeConfigs: OfficeRule[];
  intakes: IntakePlan[];
  onChange: (value: string) => void;
}) {
  const value = cellValue(app, column.id);
  const configuredOptions: Record<string, string[]> = {
    status: [...stages, 'On hold', 'Withdrawn'],
    recruiter: ['Alex Morgan', 'Jordan Lee', 'Taylor Singh', 'Casey Brooks'],
    orientation: [...intakes.map((intake) => intake.name), 'Unassigned'],
    office: officeConfigs.map((office) => office.office),
    source: [
      'Job board',
      'Referral',
      'Community event',
      'Direct sourcing',
      'Social campaign',
    ],
    dns: ['No', 'Yes'],
    fileSent: ['No', 'Yes'],
    rehire: ['New starter', 'Rehire', 'Transfer'],
    payLevel: ['Level 1', 'Level 2', 'Level 3', 'Level 4'],
    training: ['Not started', 'Pending', 'Booked', 'Complete'],
    onboarding: defaultRuleOptions,
    contractAccepted: defaultRuleOptions,
    hmEmail: defaultRuleOptions,
  };
  const complianceOptions = requirementNeedles[column.id]
    ? defaultRuleOptions
    : undefined;
  const options = column.options?.length
    ? column.options
    : (configuredOptions[column.id] ?? complianceOptions);
  if (column.inputType === 'text' || !options) {
    return (
      <Input
        value={value === '—' || value === 'Not started' ? '' : value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={column.id === 'notes' ? 'Add notes' : 'Enter value'}
        className="h-8 min-w-32 border-transparent bg-transparent px-2 text-sm hover:border-slate-200 focus:border-teal-500 focus:bg-white"
        aria-label={`Edit ${column.label} for ${app.name}`}
      />
    );
  }
  const choices = options.includes(value) ? options : [value, ...options];
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 min-w-32 rounded-md border border-transparent bg-transparent px-2 text-sm text-slate-700 outline-none hover:border-slate-200 focus:border-teal-500 focus:bg-white"
      aria-label={`Edit ${column.label} for ${app.name}`}
    >
      {choices.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  );
}

function Pipeline({
  apps,
  query,
  setQuery,
  stageFilter,
  setStageFilter,
  officeFilter,
  setOfficeFilter,
  openCandidate,
  type,
  setType,
  caregiverColumns,
  keyPlayerColumns,
  officeConfigs,
  intakes,
  configure,
  addCandidate,
  onCellChange,
}: {
  apps: Application[];
  query: string;
  setQuery: (s: string) => void;
  stageFilter: string;
  setStageFilter: (s: string) => void;
  officeFilter: string;
  setOfficeFilter: (s: string) => void;
  openCandidate: (id: number) => void;
  type: 'Caregiver' | 'Key player';
  setType: (v: 'Caregiver' | 'Key player') => void;
  caregiverColumns: TrackableColumn[];
  keyPlayerColumns: TrackableColumn[];
  officeConfigs: OfficeRule[];
  intakes: IntakePlan[];
  configure: () => void;
  addCandidate: () => void;
  onCellChange: (id: number, columnId: string, value: string) => void;
}) {
  const columns = (
    type === 'Caregiver' ? caregiverColumns : keyPlayerColumns
  ).filter((c) => c.visible);
  const rows = apps.filter((app) => app.type === type);
  return (
    <>
      <Heading
        eyebrow="Operational tracking"
        title={
          type === 'Caregiver' ? 'Caregiver tracking' : 'Key Player tracking'
        }
        body={
          type === 'Caregiver'
            ? 'View the familiar touchpoints by office, with one reliable record behind every row.'
            : 'A separate workspace for Key Player roles and their distinct recruitment requirements.'
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={configure}>
              <Settings2 className="mr-2 h-4 w-4" />
              Configure workflow
            </Button>
            <Button
              onClick={addCandidate}
              className="bg-teal-700 text-white hover:bg-teal-800"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Candidate
            </Button>
          </div>
        }
      />
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="inline-flex w-fit rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          <button
            onClick={() => setType('Caregiver')}
            className={`rounded-md px-4 py-2 text-sm font-medium ${type === 'Caregiver' ? 'bg-[#102732] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Caregivers
          </button>
          <button
            onClick={() => setType('Key player')}
            className={`rounded-md px-4 py-2 text-sm font-medium ${type === 'Key player' ? 'bg-[#102732] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Key Players
          </button>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">
            {rows.length} records
          </span>
          <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-200">
            {columns.length} visible columns
          </span>
        </div>
      </div>
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${type === 'Caregiver' ? 'caregivers' : 'Key Players'}`}
              className="h-9 pl-9"
            />
          </div>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="form-select md:w-48"
          >
            <option>All stages</option>
            {[
              'Background checks',
              'Offer stage',
              'Contract issued',
              'Contract signed',
              'On hold',
              'Onboarded',
              'Withdrawn',
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            value={officeFilter}
            onChange={(e) => setOfficeFilter(e.target.value)}
            className="form-select md:w-48"
          >
            <option>All offices</option>
            {officeConfigs.map((o) => (
              <option key={o.office}>{o.office}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 bg-slate-50/70 px-4 py-3">
          <span className="mr-1 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Office
          </span>
          <button
            onClick={() => setOfficeFilter('All offices')}
            className={`office-chip ${officeFilter === 'All offices' ? 'office-chip-active' : ''}`}
          >
            All offices
          </button>
          {officeConfigs.map((o) => (
            <button
              key={o.office}
              onClick={() => setOfficeFilter(o.office)}
              className={`office-chip ${officeFilter === o.office ? 'office-chip-active' : ''}`}
            >
              {o.office}
            </button>
          ))}
        </div>
        <div className="tracker-scroll">
          <table className="tracker-table">
            <thead>
              <tr>
                {columns.map((column, index) => (
                  <th
                    key={column.id}
                    className={index === 0 ? 'sticky-column' : ''}
                  >
                    <span>{column.label}</span>
                    <small>{column.group}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((app) => (
                <tr key={app.id}>
                  {columns.map((column, index) => (
                    <td
                      key={column.id}
                      className={index === 0 ? 'sticky-column' : ''}
                    >
                      {column.id === 'candidate' ? (
                        <button
                          type="button"
                          onClick={() => openCandidate(app.id)}
                          className="flex min-w-44 items-center gap-3 rounded-md p-1 text-left hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                          aria-label={`Open ${app.name} profile`}
                        >
                          <Avatar initials={app.initials} />
                          <div>
                            <p className="font-medium text-teal-800 underline-offset-2 hover:underline">
                              {app.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              #{app.id} · {app.office}
                            </p>
                          </div>
                        </button>
                      ) : (
                        <EditablePipelineCell
                          app={app}
                          column={column}
                          officeConfigs={officeConfigs}
                          intakes={intakes}
                          onChange={(value) =>
                            onCellChange(app.id, column.id, value)
                          }
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <div className="py-16 text-center">
              <Search className="mx-auto h-7 w-7 text-slate-300" />
              <p className="mt-2 text-sm font-medium">No matching records</p>
            </div>
          )}
        </div>
        <div className="flex flex-col justify-between gap-2 border-t border-slate-200 px-5 py-3 text-xs text-slate-500 sm:flex-row">
          <span>
            Edit any touchpoint directly in the grid. Only the candidate name
            opens the full profile.
          </span>
          <span>Showing {rows.length} synthetic records</span>
        </div>
      </Card>
    </>
  );
}

function Candidate({
  app,
  goBack,
  onRequirement,
  onAdvance,
  onIntake,
  onOutcome,
  onNote,
  intakes,
}: {
  app: Application;
  goBack: () => void;
  onRequirement: (i: number, value: string) => void;
  onAdvance: () => void;
  onIntake: (v: string) => void;
  onOutcome: () => void;
  onNote: (note: string) => void;
  intakes: IntakePlan[];
}) {
  const complete = app.requirements.filter((r) =>
    ['Complete', 'Waived'].includes(r.state),
  ).length;
  const incomplete = app.requirements.filter(
    (r) => r.required && !['Complete', 'Waived'].includes(r.state),
  );
  const [note, setNote] = useState(app.notes ?? '');
  return (
    <>
      <button
        onClick={goBack}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to pipeline
      </button>
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row">
        <div className="flex items-center gap-4">
          <Avatar initials={app.initials} large />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {app.name}
              </h1>
              <Badge variant="outline">#{app.id}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {app.role} · {app.office} · {app.type}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StageBadge stage={app.stage} />
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-semibold ${riskTone[app.risk]}`}
              >
                {app.risk}
              </span>
              {app.outcomeReason && (
                <Badge variant="outline">{app.outcomeReason}</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onOutcome}>
            Set outcome
          </Button>
          <Button
            onClick={onAdvance}
            disabled={['Onboarded', 'Withdrawn'].includes(app.stage)}
            className="bg-teal-700 hover:bg-teal-800"
          >
            Advance stage
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="mb-5 overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex min-w-[720px] items-center">
          {stages.map((stage, index) => {
            const current = stages.indexOf(app.stage);
            const done = current > index || app.stage === 'Onboarded';
            const active = app.stage === stage;
            return (
              <div key={stage} className="flex flex-1 items-center">
                <div className="flex items-center gap-2">
                  <div
                    className={`grid h-7 w-7 place-items-center rounded-full text-xs font-semibold ${done ? 'bg-teal-600 text-white' : active ? 'bg-teal-700 text-white ring-4 ring-teal-100' : 'bg-slate-100 text-slate-400'}`}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                  </div>
                  <span
                    className={`text-xs ${active ? 'font-semibold' : 'text-slate-500'}`}
                  >
                    {stage}
                  </span>
                </div>
                {index < stages.length - 1 && (
                  <div
                    className={`mx-3 h-px flex-1 ${done ? 'bg-teal-500' : 'bg-slate-200'}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <Tabs defaultValue="summary">
        <TabsList className="mb-4 bg-slate-200/60">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="requirements">
            Requirements{' '}
            <Badge className="ml-2 bg-slate-200 text-slate-700">
              {complete}/{app.requirements.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="history">Stage history</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>
        <TabsContent value="summary">
          <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Application details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                <Info label="Email" value={app.email} />
                <Info label="Phone" value={app.phone} />
                <Info label="Recruiter" value={app.recruiter} />
                <Info label="Source" value={app.source} />
                <Info label="Applied" value={app.applied} />
                <Info label="Time in stage" value={`${app.stageAge} days`} />
                <label className="text-sm">
                  <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">
                    Intake assignment
                  </span>
                  <select
                    value={app.intake}
                    onChange={(e) => onIntake(e.target.value)}
                    className="form-select"
                  >
                    {intakes.map((intake) => (
                      <option key={intake.name}>{intake.name}</option>
                    ))}
                    <option>Unassigned</option>
                  </select>
                </label>
                <Info label="Candidate type" value={app.type} />
              </CardContent>
            </Card>
            <div className="space-y-5">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Readiness</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between">
                    <p className="text-3xl font-semibold">{app.readiness}%</p>
                    <span className="text-xs text-slate-500">
                      {complete} of {app.requirements.length} cleared
                    </span>
                  </div>
                  <Progress value={app.readiness} className="mt-3 h-2" />
                  <div
                    className={`mt-4 rounded-lg p-3 text-xs ${incomplete.length ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}
                  >
                    {incomplete.length ? (
                      <>
                        <AlertCircle className="mr-1.5 inline h-4 w-4" />
                        {incomplete.length} required item(s) block the next
                        gate.
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-1.5 inline h-4 w-4" />
                        Ready to advance.
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Next best actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {incomplete.slice(0, 3).map((r) => (
                    <div
                      key={r.name}
                      className="flex items-center gap-3 rounded-lg bg-slate-50 p-2.5"
                    >
                      <CircleDashed className="h-4 w-4 text-amber-600" />
                      <div className="flex-1">
                        <p className="text-xs font-medium">Complete {r.name}</p>
                        <p className="text-[10px] text-slate-500">
                          {r.due ? `Due ${r.due}` : 'No date set'}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="requirements">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">
                  Generated requirements
                </CardTitle>
                <p className="mt-1 text-xs text-slate-500">
                  Created from the global {app.type} workflow. Office
                  information is available in Site Requirements → Lookup.
                </p>
              </div>
              <Badge
                variant="outline"
                className="border-teal-200 bg-teal-50 text-teal-700"
              >
                {complete} cleared
              </Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              {app.requirements.map((r, i) => (
                <div
                  key={r.name}
                  className="flex items-center gap-4 rounded-lg border border-slate-200 p-3"
                >
                  {r.inputType === 'dropdown' ? (
                    <select
                      value={r.value || r.state}
                      onChange={(event) => onRequirement(i, event.target.value)}
                      className="form-select w-40 shrink-0"
                    >
                      {(r.options?.length ? r.options : defaultRuleOptions).map(
                        (option) => (
                          <option key={option}>{option}</option>
                        ),
                      )}
                    </select>
                  ) : r.inputType === 'text' ? (
                    <Input
                      value={r.value ?? ''}
                      onChange={(event) => onRequirement(i, event.target.value)}
                      placeholder="Add notes"
                      className="w-48 shrink-0"
                    />
                  ) : (
                    <Checkbox
                      checked={r.state === 'Complete'}
                      onCheckedChange={(checked) =>
                        onRequirement(i, checked ? 'Complete' : 'Not started')
                      }
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{r.name}</p>
                      {r.required && (
                        <span className="text-[10px] font-medium text-rose-600">
                          REQUIRED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {r.due ? `Due ${r.due}` : 'No due date'} · Evidence
                      recorded against application
                    </p>
                  </div>
                  <Badge variant="outline">{r.state}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="history">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="space-y-5 p-6">
              {[
                ['Background checks started', app.applied, app.recruiter],
                ['Application assigned to office', app.applied, 'Automation'],
                ['Candidate record created', app.applied, app.recruiter],
              ].map(([event, date, actor], i) => (
                <div key={event} className="flex gap-3">
                  <div
                    className={`mt-1 h-3 w-3 rounded-full ${i ? 'bg-slate-300' : 'bg-teal-600 ring-4 ring-teal-100'}`}
                  />
                  <div>
                    <p className="text-sm font-medium">{event}</p>
                    <p className="text-xs text-slate-500">
                      {date} · {actor}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="notes">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add an internal note…"
                className="min-h-28 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-teal-500"
              />
              <div className="mt-3 flex justify-end">
                <Button variant="outline" onClick={() => onNote(note)}>
                  Save note
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Intakes({
  apps,
  intakes,
  setIntakes,
  setApps,
  openCandidate,
  notify,
}: {
  apps: Application[];
  intakes: IntakePlan[];
  setIntakes: React.Dispatch<React.SetStateAction<IntakePlan[]>>;
  setApps: React.Dispatch<React.SetStateAction<Application[]>>;
  openCandidate: (id: number) => void;
  notify: (message: string) => void;
}) {
  const [selected, setSelected] = useState(
    intakes.find((i) => i.status === 'Open')?.name ?? intakes[0]?.name,
  );
  const [newOpen, setNewOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: 'October B',
    date: '24 Oct 2026',
    requested: 18,
  });
  const assigned = apps.filter(
    (app) => app.intake === selected && app.stage !== 'Withdrawn',
  );
  const blocked = assigned.filter((app) => app.risk === 'Blocked').length;
  const dueSoon = assigned.filter((app) => app.risk === 'Due soon').length;
  const rollover = () => {
    const currentIndex = intakes.findIndex((i) => i.name === selected);
    const next = intakes
      .slice(currentIndex + 1)
      .find((i) => i.status === 'Open');
    if (!next)
      return notify(
        'Create a later open intake before rolling candidates forward.',
      );
    const candidates = assigned
      .filter((app) => app.readiness < 80)
      .map((app) => app.id);
    setApps((current) =>
      current.map((app) =>
        candidates.includes(app.id) ? { ...app, intake: next.name } : app,
      ),
    );
    notify(
      `${candidates.length} incomplete assignments moved to ${next.name}.`,
    );
  };
  const addIntake = () => {
    if (!draft.name.trim()) return;
    setIntakes((current) => [...current, { ...draft, status: 'Open' }]);
    setSelected(draft.name);
    setNewOpen(false);
    notify(`${draft.name} intake created.`);
  };
  return (
    <>
      <Heading
        eyebrow="Capacity planning"
        title="Monthly intakes"
        body="Requested headcount, assignments and readiness are linked to application records—no duplicated monthly formulas."
        actions={
          <Button
            onClick={() => setNewOpen(true)}
            className="bg-teal-700 hover:bg-teal-800"
          >
            <Plus className="mr-2 h-4 w-4" />
            New intake
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {intakes.map((intake, index) => {
          const records = apps.filter(
            (app) => app.intake === intake.name && app.stage !== 'Withdrawn',
          );
          const ready = records.filter((app) => app.readiness >= 80).length;
          const hired = records.filter(
            (app) => app.stage === 'Onboarded',
          ).length;
          return (
            <button
              key={intake.name}
              onClick={() => setSelected(intake.name)}
              className="text-left"
            >
              <Card
                className={`h-full border-slate-200 border-t-4 shadow-sm transition ${selected === intake.name ? 'ring-2 ring-teal-600 ring-offset-2' : ''} ${['border-t-sky-500', 'border-t-violet-500', 'border-t-teal-500', 'border-t-amber-500'][index % 4]}`}
              >
                <CardContent className="p-5">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-semibold">{intake.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Orientation · {intake.date}
                      </p>
                    </div>
                    <Badge variant="outline">{intake.status}</Badge>
                  </div>
                  <div className="mt-6 grid grid-cols-4 text-center">
                    {[
                      ['Requested', intake.requested],
                      ['Assigned', records.length],
                      ['Ready', ready],
                      ['Hired', hired],
                    ].map(([label, value]) => (
                      <div key={String(label)}>
                        <p className="text-xl font-semibold">{value}</p>
                        <p className="text-[10px] text-slate-500">{label}</p>
                      </div>
                    ))}
                  </div>
                  <Progress
                    value={(records.length / intake.requested) * 100}
                    className="mt-5 h-2"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    {Math.max(0, intake.requested - records.length)} places
                    unfilled
                  </p>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{selected} assignments</CardTitle>
            <p className="text-xs text-slate-500">
              Select a candidate to update their requirements or intake
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {assigned.map((app) => (
              <button
                onClick={() => openCandidate(app.id)}
                key={app.id}
                className="flex w-full items-center gap-3 border-t px-6 py-3 text-left hover:bg-slate-50"
              >
                <Avatar initials={app.initials} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{app.name}</p>
                  <p className="text-xs text-slate-500">
                    {app.office} · {app.stage}
                  </p>
                </div>
                <Progress value={app.readiness} className="h-1.5 w-24" />
                <span className="text-xs font-medium">{app.readiness}%</span>
              </button>
            ))}
            {!assigned.length && (
              <p className="p-8 text-center text-sm text-slate-500">
                No candidates assigned to this intake.
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Intake exceptions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
              <p className="text-sm font-medium text-rose-800">
                {blocked} blocked candidates
              </p>
              <p className="text-xs text-rose-700">
                Required checks are not complete.
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-800">
                {dueSoon} due soon
              </p>
              <p className="text-xs text-amber-700">
                Recruiter reminders are queued.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={rollover}>
              Rollover incomplete
            </Button>
          </CardContent>
        </Card>
      </div>
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Create intake</DialogTitle>
            <DialogDescription>
              Add a new orientation intake and requested capacity.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="text-sm font-medium">
              Intake name
              <Input
                value={draft.name}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, name: e.target.value }))
                }
                className="mt-1.5"
              />
            </label>
            <label className="text-sm font-medium">
              Orientation date
              <Input
                value={draft.date}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, date: e.target.value }))
                }
                className="mt-1.5"
              />
            </label>
            <label className="text-sm font-medium">
              Requested places
              <Input
                type="number"
                value={draft.requested}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, requested: Number(e.target.value) }))
                }
                className="mt-1.5"
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={addIntake}
              className="bg-teal-700 hover:bg-teal-800"
            >
              Create intake
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Offices({
  notify,
  officeConfigs,
  setOfficeConfigs,
  ruleDefinitions,
  setRuleDefinitions,
}: {
  notify: (s: string) => void;
  officeConfigs: OfficeRule[];
  setOfficeConfigs: React.Dispatch<React.SetStateAction<OfficeRule[]>>;
  ruleDefinitions: OfficeRuleDefinition[];
  setRuleDefinitions: React.Dispatch<
    React.SetStateAction<OfficeRuleDefinition[]>
  >;
}) {
  const [newRule, setNewRule] = useState('');
  const [newDefault, setNewDefault] = useState(
    'Required unless noted otherwise',
  );
  const [lookupOffice, setLookupOffice] = useState(
    officeConfigs[0]?.office ?? '',
  );
  const [draggedRuleId, setDraggedRuleId] = useState<string | null>(null);
  const resolvedValue = (
    office: OfficeRule,
    definition: OfficeRuleDefinition,
  ) => {
    const saved = office.requirementValues?.[definition.id];
    if (saved !== undefined) return saved || definition.defaultValue;
    return office.rules.includes(definition.label)
      ? definition.defaultValue
      : 'Not required for this office';
  };
  const updateOfficeValue = (
    officeName: string,
    definitionId: string,
    value: string,
  ) =>
    setOfficeConfigs((current) =>
      current.map((item) =>
        item.office === officeName
          ? {
              ...item,
              requirementValues: {
                ...item.requirementValues,
                [definitionId]: value,
              },
            }
          : item,
      ),
    );
  const updateDefaultValue = (definitionId: string, value: string) =>
    setRuleDefinitions((current) =>
      current.map((definition) =>
        definition.id === definitionId
          ? { ...definition, defaultValue: value }
          : definition,
      ),
    );
  const addRule = () => {
    const label = newRule.trim();
    if (!label) return;
    if (
      ruleDefinitions.some(
        (rule) => rule.label.toLowerCase() === label.toLowerCase(),
      )
    ) {
      notify('That site requirement already exists in the matrix.');
      return;
    }
    setRuleDefinitions((current) => [
      ...current,
      {
        id: `office-rule-${Date.now()}`,
        label,
        inputType: 'dropdown',
        options: defaultRuleOptions,
        defaultValue: newDefault.trim() || 'Required unless noted otherwise',
      },
    ]);
    setOfficeConfigs((current) =>
      current.map((office) => ({
        ...office,
        rules: office.rules.includes(label)
          ? office.rules
          : [...office.rules, label],
      })),
    );
    setNewRule('');
    setNewDefault('Required unless noted otherwise');
    notify(`${label} added with the standard value applied to all offices.`);
  };
  const renameRule = (
    definition: OfficeRuleDefinition,
    proposedName: string,
  ) => {
    const nextName = proposedName.trim();
    if (!nextName || nextName === definition.label) return;
    if (
      ruleDefinitions.some(
        (rule) =>
          rule.id !== definition.id &&
          rule.label.toLowerCase() === nextName.toLowerCase(),
      )
    ) {
      notify('A site requirement with that name already exists.');
      return;
    }
    setRuleDefinitions((current) =>
      current.map((rule) =>
        rule.id === definition.id ? { ...rule, label: nextName } : rule,
      ),
    );
    setOfficeConfigs((current) =>
      current.map((office) => ({
        ...office,
        rules: office.rules.map((rule) =>
          rule === definition.label ? nextName : rule,
        ),
      })),
    );
    notify(`${definition.label} renamed to ${nextName}.`);
  };
  const removeRule = (definition: OfficeRuleDefinition) => {
    setRuleDefinitions((current) =>
      current.filter((rule) => rule.id !== definition.id),
    );
    setOfficeConfigs((current) =>
      current.map((office) => ({
        ...office,
        rules: office.rules.filter((rule) => rule !== definition.label),
        requirementValues: Object.fromEntries(
          Object.entries(office.requirementValues ?? {}).filter(
            ([id]) => id !== definition.id,
          ),
        ),
      })),
    );
    notify(`${definition.label} removed from site requirements.`);
  };
  const reorderRule = (targetId: string) => {
    if (!draggedRuleId || draggedRuleId === targetId) return;
    setRuleDefinitions((current) => {
      const from = current.findIndex((rule) => rule.id === draggedRuleId);
      const to = current.findIndex((rule) => rule.id === targetId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDraggedRuleId(null);
    notify('Site requirement order updated.');
  };
  const selectedLookupOffice =
    officeConfigs.find((office) => office.office === lookupOffice) ??
    officeConfigs[0];
  return (
    <>
      <Heading
        eyebrow="Configuration"
        title="Site requirements"
        body="Maintain the Caregiver-only location requirements from the original workbook, with every office visible side by side."
        actions={
          <Button
            variant="outline"
            onClick={() =>
              notify(
                'Site Requirements is an information reference for Caregiver offices. Every office inherits the standard text unless a local variation is recorded.',
              )
            }
          >
            <HelpCircle className="mr-2 h-4 w-4" />
            How requirements work
          </Button>
        }
      />
      <Tabs defaultValue="matrix">
        <TabsList className="mb-4 bg-slate-200/60">
          <TabsTrigger value="matrix">Information matrix</TabsTrigger>
          <TabsTrigger value="lookup">Lookup</TabsTrigger>
        </TabsList>
        <TabsContent value="matrix">
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-200 bg-slate-50/60">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
                <div>
                  <CardTitle className="text-base">
                    Caregiver site requirement matrix
                  </CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    Offices inherit the standard text unless you enter a local
                    variation.
                  </p>
                </div>
                <div className="grid w-full gap-2 md:w-auto md:grid-cols-[210px_280px_auto]">
                  <Input
                    value={newRule}
                    onChange={(event) => setNewRule(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && addRule()}
                    placeholder="New requirement name"
                  />
                  <Input
                    value={newDefault}
                    onChange={(event) => setNewDefault(event.target.value)}
                    placeholder="Standard/default information"
                  />
                  <Button
                    onClick={addRule}
                    className="shrink-0 bg-teal-700 hover:bg-teal-800"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add requirement
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[2000px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-white">
                      <th className="sticky left-0 z-10 w-72 min-w-72 border-r border-slate-200 bg-white px-4 py-4 text-left font-semibold text-slate-700">
                        Site requirement
                      </th>
                      <th className="min-w-80 border-r border-slate-200 bg-slate-50 px-3 py-3 text-left">
                        <span className="block font-semibold text-slate-900">
                          Standard / default
                        </span>
                        <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                          Inherited by every office
                        </span>
                      </th>
                      {officeConfigs.map((office) => (
                        <th
                          key={office.office}
                          className="min-w-64 border-r border-slate-100 px-3 py-3 text-center last:border-r-0"
                        >
                          <span className="block font-semibold text-slate-900">
                            {office.office}
                          </span>
                          <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                            {office.code} · {office.region}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ruleDefinitions.map((rule) => (
                      <tr
                        key={rule.id}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => reorderRule(rule.id)}
                        className={`border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 ${draggedRuleId === rule.id ? 'opacity-40' : ''}`}
                      >
                        <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div
                              draggable
                              onDragStart={() => setDraggedRuleId(rule.id)}
                              onDragEnd={() => setDraggedRuleId(null)}
                              className="cursor-grab rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing"
                              title="Drag to reorder"
                              aria-label={`Drag ${rule.label} to reorder`}
                            >
                              <GripVertical className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <Input
                                key={rule.id}
                                defaultValue={rule.label}
                                onBlur={(event) =>
                                  renameRule(rule, event.target.value)
                                }
                                className="h-8 border-transparent bg-transparent font-medium hover:border-slate-200 focus:border-teal-500"
                                aria-label={`Edit ${rule.label}`}
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeRule(rule)}
                              aria-label={`Remove ${rule.label}`}
                              title={`Remove ${rule.label}`}
                              className="h-8 w-8 shrink-0 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                        <td className="border-r border-slate-200 bg-slate-50/70 px-3 py-3 align-top">
                          <textarea
                            value={rule.defaultValue}
                            onChange={(event) =>
                              updateDefaultValue(rule.id, event.target.value)
                            }
                            className="min-h-20 w-full resize-y rounded-md border border-slate-200 bg-white p-2 text-sm outline-none focus:border-teal-500"
                            aria-label={`Standard value for ${rule.label}`}
                          />
                        </td>
                        {officeConfigs.map((office) => {
                          const value = resolvedValue(office, rule);
                          const variation =
                            value.trim() !== rule.defaultValue.trim();
                          return (
                            <td
                              key={office.office}
                              className={`border-r border-slate-100 px-3 py-3 align-top last:border-r-0 ${variation ? 'bg-amber-50/80' : 'bg-white'}`}
                            >
                              <textarea
                                value={value}
                                onChange={(event) =>
                                  updateOfficeValue(
                                    office.office,
                                    rule.id,
                                    event.target.value,
                                  )
                                }
                                className={`min-h-20 w-full resize-y rounded-md border p-2 text-sm outline-none focus:border-teal-500 ${variation ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}
                                aria-label={`${rule.label} information for ${office.office}`}
                              />
                              <div className="mt-1.5 flex items-center justify-between gap-2">
                                <span
                                  className={`text-[10px] font-semibold uppercase tracking-wide ${variation ? 'text-amber-700' : 'text-teal-700'}`}
                                >
                                  {variation ? 'Variation' : 'Standard'}
                                </span>
                                {variation && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateOfficeValue(
                                        office.office,
                                        rule.id,
                                        rule.defaultValue,
                                      )
                                    }
                                    className="text-[10px] font-medium text-slate-500 underline hover:text-slate-900"
                                  >
                                    Use default
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!ruleDefinitions.length && (
                <div className="px-6 py-12 text-center text-sm text-slate-500">
                  No site requirements yet. Add the first requirement above.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="lookup">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-200">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <CardTitle className="text-base">
                    Office requirement lookup
                  </CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    View the standard information and any variations for one
                    office.
                  </p>
                </div>
                <select
                  value={selectedLookupOffice?.office ?? ''}
                  onChange={(event) => setLookupOffice(event.target.value)}
                  className="form-select sm:w-64"
                  aria-label="Select office for requirement lookup"
                >
                  {officeConfigs.map((office) => (
                    <option key={office.office}>{office.office}</option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {selectedLookupOffice && (
                <div className="divide-y divide-slate-100">
                  {ruleDefinitions.map((definition) => {
                    const value = resolvedValue(
                      selectedLookupOffice,
                      definition,
                    );
                    const variation =
                      value.trim() !== definition.defaultValue.trim();
                    return (
                      <div
                        key={definition.id}
                        className={`grid gap-3 px-5 py-4 md:grid-cols-[220px_1fr_auto] md:items-start ${variation ? 'bg-amber-50/70' : ''}`}
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {definition.label}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Standard: {definition.defaultValue}
                          </p>
                        </div>
                        <p className="text-sm leading-relaxed text-slate-700">
                          {value || 'No information recorded'}
                        </p>
                        <Badge
                          variant="outline"
                          className={
                            variation
                              ? 'w-fit border-amber-300 bg-amber-100 text-amber-800'
                              : 'w-fit border-teal-200 bg-teal-50 text-teal-700'
                          }
                        >
                          {variation ? 'Office variation' : 'Standard'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Automations({ notify }: { notify: (message: string) => void }) {
  const [flows, setFlows] = useState([
    {
      id: 1,
      name: 'Generate application checklist',
      detail:
        'When a candidate is added, apply the global Caregiver or Key Player workflow.',
      enabled: true,
      last: 'Ran 8 minutes ago',
      runs: 9,
    },
    {
      id: 2,
      name: 'Requirement due reminder',
      detail:
        'Notify the recruiter three days before a required touchpoint is due.',
      enabled: true,
      last: 'Ran 24 minutes ago',
      runs: 18,
    },
    {
      id: 3,
      name: 'Stage readiness gate',
      detail: 'Prevent progression while required checks remain incomplete.',
      enabled: true,
      last: 'Ran 1 hour ago',
      runs: 7,
    },
    {
      id: 4,
      name: 'Intake rollover review',
      detail:
        'Flag candidates below 80% readiness five days before orientation.',
      enabled: true,
      last: 'Ran yesterday',
      runs: 4,
    },
    {
      id: 5,
      name: 'Hiring manager notification',
      detail: 'Send the Key Player summary after contract acceptance.',
      enabled: false,
      last: 'Not run',
      runs: 0,
    },
  ]);
  return (
    <>
      <Heading
        eyebrow="Power Automate"
        title="Workflow automations"
        body="Review the automated actions that replace reminders, copied formulas and manual hand-offs."
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Automation rules</CardTitle>
            <p className="text-xs text-slate-500">
              Toggle rules for prototype testing or run one immediately.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {flows.map((flow) => (
              <div
                key={flow.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center"
              >
                <button
                  aria-label={`${flow.enabled ? 'Disable' : 'Enable'} ${flow.name}`}
                  onClick={() =>
                    setFlows((current) =>
                      current.map((item) =>
                        item.id === flow.id
                          ? { ...item, enabled: !item.enabled }
                          : item,
                      ),
                    )
                  }
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${flow.enabled ? 'bg-teal-600' : 'bg-slate-200'}`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${flow.enabled ? 'left-6' : 'left-1'}`}
                  />
                </button>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{flow.name}</p>
                    <Badge
                      variant="outline"
                      className={
                        flow.enabled
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : ''
                      }
                    >
                      {flow.enabled ? 'Active' : 'Paused'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{flow.detail}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {flow.last} · {flow.runs} sample runs
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!flow.enabled}
                  onClick={() => {
                    setFlows((current) =>
                      current.map((item) =>
                        item.id === flow.id
                          ? {
                              ...item,
                              last: 'Ran just now',
                              runs: item.runs + 1,
                            }
                          : item,
                      ),
                    );
                    notify(`${flow.name} completed a sample run.`);
                  }}
                >
                  Run now
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="space-y-5">
          <Card className="border-slate-200 bg-[#102732] text-white shadow-sm">
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-teal-300">Today</p>
              <p className="mt-3 text-4xl font-semibold">38</p>
              <p className="mt-1 text-sm text-slate-300">
                successful workflow actions
              </p>
              <div className="mt-5 space-y-2 text-xs text-slate-300">
                <p className="flex justify-between">
                  <span>Successful</span>
                  <strong className="text-white">38</strong>
                </p>
                <p className="flex justify-between">
                  <span>Needs attention</span>
                  <strong className="text-amber-300">1</strong>
                </p>
                <p className="flex justify-between">
                  <span>Average duration</span>
                  <strong className="text-white">4 sec</strong>
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Recent exception</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-medium text-amber-900">
                  Missing recruiter assignment
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  One imported record was held for review instead of sending an
                  incomplete notification.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Workflows({
  caregiverColumns,
  setCaregiverColumns,
  keyPlayerColumns,
  setKeyPlayerColumns,
  notify,
}: {
  caregiverColumns: TrackableColumn[];
  setCaregiverColumns: React.Dispatch<React.SetStateAction<TrackableColumn[]>>;
  keyPlayerColumns: TrackableColumn[];
  setKeyPlayerColumns: React.Dispatch<React.SetStateAction<TrackableColumn[]>>;
  notify: (s: string) => void;
}) {
  const [kind, setKind] = useState<'Caregiver' | 'Key player'>('Caregiver');
  const [newLabel, setNewLabel] = useState('');
  const [newGroup, setNewGroup] = useState<TrackableColumn['group']>('Process');
  const [newInputType, setNewInputType] = useState<RuleInputType>('dropdown');
  const [newOptions, setNewOptions] = useState(defaultRuleOptions.join(', '));
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const columns = kind === 'Caregiver' ? caregiverColumns : keyPlayerColumns;
  const setColumns =
    kind === 'Caregiver' ? setCaregiverColumns : setKeyPlayerColumns;
  const fieldType = (column: TrackableColumn): RuleInputType =>
    column.inputType ??
    (['candidate', 'phone', 'email', 'zone', 'role', 'notes'].includes(
      column.id,
    )
      ? 'text'
      : 'dropdown');
  const update = (id: string, changes: Partial<TrackableColumn>) =>
    setColumns((current) =>
      current.map((column) =>
        column.id === id ? { ...column, ...changes } : column,
      ),
    );
  const move = (index: number, direction: -1 | 1) =>
    setColumns((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  const reorderColumn = (targetId: string) => {
    if (!draggedColumnId || draggedColumnId === targetId) return;
    setColumns((current) => {
      const from = current.findIndex((column) => column.id === draggedColumnId);
      const to = current.findIndex((column) => column.id === targetId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDraggedColumnId(null);
    notify('Workflow order updated.');
  };
  const remove = (column: TrackableColumn) => {
    if (column.id === 'candidate') return;
    setColumns((current) => current.filter((item) => item.id !== column.id));
    notify(`${column.label} removed from the ${kind} workflow.`);
  };
  const add = () => {
    const label = newLabel.trim();
    if (!label) return;
    setColumns((current) => [
      ...current,
      {
        id: `custom-${kind.toLowerCase().replace(' ', '-')}-${Date.now()}`,
        label,
        visible: true,
        group: newGroup,
        inputType: newInputType,
        options:
          newInputType === 'dropdown'
            ? newOptions
                .split(',')
                .map((option) => option.trim())
                .filter(Boolean)
            : undefined,
      },
    ]);
    setNewLabel('');
    notify(`${label} added globally to the ${kind} workflow.`);
  };
  return (
    <>
      <Heading
        eyebrow="No-code configuration"
        title="Workflows"
        body="Maintain separate global workflows for Caregivers and Key Players. Workflow steps become editable columns in the matching pipeline."
      />
      <div className="mb-5 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        <div className="flex gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
          <div>
            <p className="font-semibold">
              Designed to change with your process
            </p>
            <p className="mt-1 text-sky-800">
              Every workflow is managed globally for its candidate type and
              applies to all offices by default. Site-specific Caregiver
              requirements are maintained separately on the Site requirements
              page.
            </p>
          </div>
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <CardTitle className="text-base">
                  Global workflow definition
                </CardTitle>
                <p className="mt-1 text-xs text-slate-500">
                  Drag steps into order. Changes appear immediately in the
                  corresponding pipeline grid.
                </p>
              </div>
              <div className="inline-flex rounded-lg bg-slate-100 p-1">
                <button
                  onClick={() => setKind('Caregiver')}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${kind === 'Caregiver' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}
                >
                  Caregivers
                </button>
                <button
                  onClick={() => setKind('Key player')}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${kind === 'Key player' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}
                >
                  Key Players
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="min-w-[940px]">
                <div className="grid grid-cols-[44px_minmax(240px,1fr)_145px_135px_100px_126px] gap-3 border-b bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <span>Order</span>
                  <span>Workflow step</span>
                  <span>Field type</span>
                  <span>Category</span>
                  <span>Applies to</span>
                  <span>Actions</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {columns.map((column, index) => (
                    <div
                      key={column.id}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => reorderColumn(column.id)}
                      className={`grid grid-cols-[44px_minmax(240px,1fr)_145px_135px_100px_126px] items-center gap-3 px-4 py-2.5 ${!column.visible ? 'bg-slate-50/60 opacity-60' : ''} ${draggedColumnId === column.id ? 'opacity-40' : ''}`}
                    >
                      <span
                        draggable
                        onDragStart={() => setDraggedColumnId(column.id)}
                        onDragEnd={() => setDraggedColumnId(null)}
                        className="grid h-8 w-8 cursor-grab place-items-center rounded-md bg-slate-100 text-slate-500 active:cursor-grabbing"
                        title="Drag to reorder"
                      >
                        <GripVertical className="h-4 w-4" />
                      </span>
                      <div className="space-y-1.5">
                        <Input
                          aria-label={`${column.label} label`}
                          value={column.label}
                          onChange={(e) =>
                            update(column.id, { label: e.target.value })
                          }
                          className="h-8 bg-white text-sm"
                        />
                        {fieldType(column) === 'dropdown' && (
                          <Input
                            aria-label={`${column.label} dropdown options`}
                            value={column.options?.join(', ') ?? ''}
                            onChange={(event) =>
                              update(column.id, {
                                options: event.target.value
                                  .split(',')
                                  .map((option) => option.trim())
                                  .filter(Boolean),
                              })
                            }
                            placeholder="Dropdown options, separated by commas"
                            className="h-7 bg-white text-[11px]"
                          />
                        )}
                      </div>
                      <select
                        aria-label={`${column.label} field type`}
                        value={fieldType(column)}
                        disabled={column.id === 'candidate'}
                        onChange={(event) =>
                          update(column.id, {
                            inputType: event.target.value as RuleInputType,
                            options:
                              event.target.value === 'dropdown'
                                ? (column.options ?? defaultRuleOptions)
                                : undefined,
                          })
                        }
                        className="form-select h-8"
                      >
                        <option value="dropdown">Dropdown</option>
                        <option value="text">Free text / notes</option>
                      </select>
                      <select
                        aria-label={`${column.label} category`}
                        value={column.group}
                        onChange={(e) =>
                          update(column.id, {
                            group: e.target.value as TrackableColumn['group'],
                          })
                        }
                        className="form-select h-8"
                      >
                        <option>Identity</option>
                        <option>Process</option>
                        <option>Compliance</option>
                        <option>Outcome</option>
                      </select>
                      <Badge
                        variant="outline"
                        className="w-fit border-teal-200 bg-teal-50 text-teal-700"
                      >
                        All offices
                      </Badge>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            update(column.id, { visible: !column.visible })
                          }
                          aria-label={
                            column.visible ? 'Hide step' : 'Show step'
                          }
                          title={column.visible ? 'Hide step' : 'Show step'}
                        >
                          {column.visible ? (
                            <Eye className="h-3.5 w-3.5" />
                          ) : (
                            <EyeOff className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                          aria-label={`Move ${column.label} up`}
                          title="Move up"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          disabled={column.id === 'candidate'}
                          onClick={() => remove(column)}
                          aria-label={`Remove ${column.label}`}
                          title="Remove workflow step"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="space-y-5">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Add workflow step</CardTitle>
              <p className="text-xs text-slate-500">
                It will apply to all offices in the {kind} workflow by default.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="text-sm font-medium">
                Column name
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && add()}
                  placeholder="e.g. Vaccination evidence"
                  className="mt-1.5"
                />
              </label>
              <label className="text-sm font-medium">
                Field type
                <select
                  value={newInputType}
                  onChange={(event) =>
                    setNewInputType(event.target.value as RuleInputType)
                  }
                  className="form-select mt-1.5"
                >
                  <option value="dropdown">Dropdown</option>
                  <option value="text">Free text / notes</option>
                </select>
              </label>
              {newInputType === 'dropdown' && (
                <label className="text-sm font-medium">
                  Dropdown options
                  <Input
                    value={newOptions}
                    onChange={(event) => setNewOptions(event.target.value)}
                    placeholder="Not started, In progress, Complete"
                    className="mt-1.5"
                  />
                  <span className="mt-1 block text-[11px] font-normal text-slate-500">
                    Separate options with commas.
                  </span>
                </label>
              )}
              <label className="text-sm font-medium">
                Category
                <select
                  value={newGroup}
                  onChange={(e) =>
                    setNewGroup(e.target.value as TrackableColumn['group'])
                  }
                  className="form-select mt-1.5"
                >
                  <option>Process</option>
                  <option>Compliance</option>
                  <option>Identity</option>
                  <option>Outcome</option>
                </select>
              </label>
              <Button
                onClick={add}
                disabled={!newLabel.trim()}
                className="w-full bg-teal-700 hover:bg-teal-800"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add workflow step
              </Button>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Workflow summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Active steps</span>
                <strong>{columns.filter((c) => c.visible).length}</strong>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-slate-500">Hidden steps</span>
                <strong>{columns.filter((c) => !c.visible).length}</strong>
              </div>
              <div className="mt-4 border-t pt-4">
                <p className="text-xs leading-relaxed text-slate-500">
                  In the production app, configuration changes would be
                  permission-controlled and recorded in an audit history.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Reports({
  apps,
  officeConfigs,
  intakes,
}: {
  apps: Application[];
  officeConfigs: OfficeRule[];
  intakes: IntakePlan[];
}) {
  const hires = apps.filter((app) => app.stage === 'Onboarded').length;
  const withdrawals = apps.filter((app) => app.stage === 'Withdrawn').length;
  const withdrawalRate = Math.round(
    (withdrawals / Math.max(1, apps.length)) * 100,
  );
  const totalRequested = intakes
    .filter((intake) => intake.status === 'Open')
    .reduce((sum, intake) => sum + intake.requested, 0);
  const totalAssigned = apps.filter(
    (app) =>
      intakes.some(
        (intake) => intake.status === 'Open' && intake.name === app.intake,
      ) && app.stage !== 'Withdrawn',
  ).length;
  const reasons = [
    'Candidate withdrew',
    'No response',
    'Requirements not met',
    'Did not start',
    'Role no longer available',
  ].map((reason) => ({
    reason,
    count: apps.filter((app) => app.outcomeReason === reason).length,
  }));
  const maxReason = Math.max(1, ...reasons.map((reason) => reason.count));
  return (
    <>
      <Heading
        eyebrow="Live reporting"
        title="Recruitment performance"
        body="Measures update from the same application, outcome and intake records used by the working screens."
        actions={
          <select className="form-select w-44">
            <option>All offices</option>
            {officeConfigs.map((office) => (
              <option key={office.office}>{office.office}</option>
            ))}
          </select>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Hires in sample"
          value={String(hires)}
          delta="Based on onboarded stage"
          icon={CheckCircle2}
          accent="bg-emerald-50 text-emerald-700"
        />
        <Metric
          label="Withdrawal rate"
          value={`${withdrawalRate}%`}
          delta={`${withdrawals} structured outcomes`}
          icon={Activity}
          accent="bg-rose-50 text-rose-700"
        />
        <Metric
          label="Average readiness"
          value={`${Math.round(apps.reduce((sum, app) => sum + app.readiness, 0) / Math.max(1, apps.length))}%`}
          delta="Across current applications"
          icon={Gauge}
          accent="bg-sky-50 text-sky-700"
        />
        <Metric
          label="Intake fill rate"
          value={`${Math.round((totalAssigned / Math.max(1, totalRequested)) * 100)}%`}
          delta={`${totalAssigned} assigned of ${totalRequested} requested`}
          icon={CalendarDays}
          accent="bg-violet-50 text-violet-700"
        />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Requested versus hired</CardTitle>
            <p className="text-xs text-slate-500">
              Synthetic historical trend plus live sample outcomes
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 items-end gap-5 border-b border-slate-200 pb-1">
              {[
                ['Apr', 14, 11],
                ['May', 17, 13],
                ['Jun', 16, 14],
                ['Jul', 19, 15],
                ['Aug', 16, hires],
                ['Sep', 22, 0],
              ].map(([month, requested, hired]) => (
                <div
                  key={String(month)}
                  className="flex h-full flex-1 flex-col justify-end"
                >
                  <div className="flex flex-1 items-end justify-center gap-1">
                    <div
                      className="w-[35%] rounded-t bg-slate-200"
                      style={{ height: `${Number(requested) * 8}px` }}
                    />
                    <div
                      className="w-[35%] rounded-t bg-teal-600"
                      style={{ height: `${Number(hired) * 8}px` }}
                    />
                  </div>
                  <p className="mt-2 text-center text-[11px] text-slate-500">
                    {month}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-center gap-5 text-xs text-slate-500">
              <span>
                <i className="mr-1.5 inline-block h-2.5 w-2.5 bg-slate-200" />
                Requested
              </span>
              <span>
                <i className="mr-1.5 inline-block h-2.5 w-2.5 bg-teal-600" />
                Hired
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Withdrawal reasons</CardTitle>
            <p className="text-xs text-slate-500">
              Updates when a structured outcome is saved
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {reasons.map(({ reason, count }) => (
              <div key={reason}>
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{reason}</span>
                  <span>{count}</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-rose-400"
                    style={{ width: `${(count / maxReason) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card className="mt-5 border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Office comparison</CardTitle>
          <p className="text-xs text-slate-500">
            Calculated from the live synthetic records
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="pb-3">Office</th>
                <th>Active</th>
                <th>Hired</th>
                <th>Withdrawn</th>
                <th>Avg. days in stage</th>
                <th>Readiness</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {officeConfigs.map((office) => {
                const records = apps.filter(
                  (app) => app.office === office.office,
                );
                const active = records.filter((app) =>
                  stages.slice(0, 4).includes(app.stage),
                ).length;
                const ready = Math.round(
                  records.reduce((sum, app) => sum + app.readiness, 0) /
                    Math.max(1, records.length),
                );
                return (
                  <tr key={office.office}>
                    <td className="py-3 font-medium">{office.office}</td>
                    <td>{active}</td>
                    <td>
                      {
                        records.filter((app) => app.stage === 'Onboarded')
                          .length
                      }
                    </td>
                    <td>
                      {
                        records.filter((app) => app.stage === 'Withdrawn')
                          .length
                      }
                    </td>
                    <td>
                      {Math.round(
                        records.reduce((sum, app) => sum + app.stageAge, 0) /
                          Math.max(1, records.length),
                      )}
                      d
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Progress value={ready} className="h-1.5 w-20" />
                        <span className="text-xs">{ready}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}
