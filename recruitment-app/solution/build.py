"""Generates the Recruitment Operations Dataverse solution source.

Writes an unpacked solution (SolutionPackager layout) to solution/src, which
`pac solution pack` turns into an importable zip. Run solution/build.sh rather
than this file directly.

The XML shapes are copied from a real Dataverse export: the user-owned table
admin_AppCatalogFeedback in Microsoft's CoE Starter Kit (MIT licence, see
template/COE-STARTER-KIT-LICENSE). Only patterns seen in that export are
used, which is why there are no formula columns and no "Parental"
relationships (see docs/04-importable-solution.md).
"""

import re
import shutil
import uuid
from pathlib import Path
from xml.sax.saxutils import escape

HERE = Path(__file__).parent
SRC = HERE / 'src'
TEMPLATE = HERE / 'template'
PREFIX = 'dov'
OPTION_BASE = 725590000  # choice value prefix Dataverse derives for "dov"
VERSION = '1.0.0.0'
NS = uuid.UUID('5d0c1f6e-8f55-4c4e-9a53-3b1f2f6f0a11')


def guid(*parts):
    """Stable GUID so rebuilding does not change form, view or role IDs."""
    return '{%s}' % uuid.uuid5(NS, '/'.join(parts))


# ---------------------------------------------------------------- choices ---

CHOICES = {
    'dov_candidatetype': ('Candidate type', ['Caregiver', 'Key Player']),
    'dov_stage': ('Recruitment stage', [
        'Background checks', 'Offer stage', 'Contract issued', 'Contract signed',
        'Onboarded', 'On hold', 'Withdrawn']),
    'dov_requirementstate': ('Requirement state', ['Not started', 'In progress', 'Complete', 'Waived']),
    'dov_outcomereason': ('Outcome reason', [
        'Candidate requested more time', 'Awaiting document', 'Role paused', 'Intake deferred',
        'Candidate withdrew', 'No response', 'Requirements not met', 'Did not start',
        'Role no longer available']),
    'dov_source': ('Candidate source', ['Job board', 'Referral', 'Community event', 'Direct sourcing', 'Social campaign']),
    'dov_stepcategory': ('Step category', ['Identity', 'Process', 'Compliance', 'Outcome']),
    'dov_stepinputtype': ('Step input type', ['Status', 'Dropdown', 'Text']),
    'dov_stepkind': ('Step kind', ['Application field', 'Tracked step']),
    'dov_intakestatus': ('Intake status', ['Open', 'Closed']),
    'dov_risklevel': ('Risk level', ['Clear', 'Due soon', 'Blocked']),
}


def choice_value(optionset, label):
    return OPTION_BASE + CHOICES[optionset][1].index(label)


# ----------------------------------------------------------------- tables ---
# Column tuple: (schema name, display name, kind, options)
# kinds: text, email, memo, int, bit, date, datetime, choice, lookup

def col(schema, display, kind, **opts):
    return (schema, display, kind, opts)


TABLES = [
    dict(schema='dov_Office', display='Office', plural='Offices', primary=('dov_Name', 'Office name', 100),
         audit=True, columns=[
             col('dov_Code', 'Code', 'text', max=10, required=True),
             col('dov_Region', 'Region', 'text', max=100),
             col('dov_Active', 'Active', 'bit', default=1),
         ], keys=[('dov_OfficeCodeKey', 'Office code', ['dov_code'])],
         view=['dov_code', 'dov_region', 'dov_active']),
    dict(schema='dov_Candidate', display='Candidate', plural='Candidates', primary=('dov_Name', 'Full name', 200),
         audit=True, columns=[
             col('dov_Email', 'Email', 'email', max=100),
             col('dov_Phone', 'Phone', 'text', max=50),
         ], keys=[], view=['dov_email', 'dov_phone']),
    dict(schema='dov_Intake', display='Intake', plural='Intakes', primary=('dov_Name', 'Intake name', 100),
         audit=True, columns=[
             col('dov_OrientationDate', 'Orientation date', 'date', required=True),
             col('dov_RequestedPlaces', 'Requested places', 'int', min=0, max=10000, required=True),
             col('dov_IntakeStatus', 'Intake status', 'choice', optionset='dov_intakestatus', default='Open'),
         ], keys=[('dov_IntakeNameKey', 'Intake name', ['dov_name'])],
         view=['dov_orientationdate', 'dov_requestedplaces', 'dov_intakestatus']),
    dict(schema='dov_WorkflowStep', display='Workflow Step', plural='Workflow Steps', primary=('dov_Name', 'Step label', 100),
         audit=True, columns=[
             col('dov_CandidateType', 'Candidate type', 'choice', optionset='dov_candidatetype', required=True),
             col('dov_SortOrder', 'Sort order', 'int', min=0, max=100000, required=True),
             col('dov_StepKind', 'Step kind', 'choice', optionset='dov_stepkind', required=True),
             col('dov_AppColumnKey', 'Application column key', 'text', max=50),
             col('dov_Category', 'Category', 'choice', optionset='dov_stepcategory'),
             col('dov_InputType', 'Input type', 'choice', optionset='dov_stepinputtype'),
             col('dov_Options', 'Options', 'memo', max=2000),
             col('dov_CompletingValues', 'Completing values', 'text', max=500),
             col('dov_CountsTowardReadiness', 'Counts toward readiness', 'bit', default=1),
             col('dov_Required', 'Required', 'bit', default=0),
             col('dov_RequiredBeforeStage', 'Required before stage', 'choice', optionset='dov_stage'),
             col('dov_ShowInGrid', 'Show in grid', 'bit', default=1),
         ], keys=[],
         view=['dov_candidatetype', 'dov_sortorder', 'dov_stepkind', 'dov_inputtype', 'dov_required',
               'dov_requiredbeforestage', 'dov_showingrid'],
         order='dov_sortorder'),
    dict(schema='dov_SiteRequirement', display='Site Requirement', plural='Site Requirements',
         primary=('dov_Name', 'Site requirement', 200), audit=True, columns=[
             col('dov_StandardText', 'Standard text', 'memo', max=4000),
             col('dov_SortOrder', 'Sort order', 'int', min=0, max=100000),
         ], keys=[('dov_SiteRequirementNameKey', 'Site requirement name', ['dov_name'])],
         view=['dov_sortorder', 'dov_standardtext'], order='dov_sortorder'),
    dict(schema='dov_Application', display='Application', plural='Applications', primary=('dov_Name', 'Name', 200),
         audit=True, columns=[
             col('dov_ApplicationNumber', 'Application number', 'text', max=20, autonumber='APP-{SEQNUM:5}'),
             col('dov_Candidate', 'Candidate', 'lookup', target='dov_Candidate', delete='Restrict', required=True),
             col('dov_CandidateType', 'Candidate type', 'choice', optionset='dov_candidatetype', required=True),
             col('dov_RoleTitle', 'Role title', 'text', max=100, required=True),
             col('dov_Office', 'Office', 'lookup', target='dov_Office', delete='Restrict', required=True),
             col('dov_Recruiter', 'Recruiter', 'lookup', target='SystemUser', delete='RemoveLink'),
             col('dov_Source', 'Source', 'choice', optionset='dov_source'),
             col('dov_Intake', 'Intake', 'lookup', target='dov_Intake', delete='RemoveLink'),
             col('dov_AppliedOn', 'Applied on', 'date'),
             col('dov_Stage', 'Stage', 'choice', optionset='dov_stage', default='Background checks', secured=True),
             col('dov_StageBeforeHold', 'Stage before hold', 'choice', optionset='dov_stage', secured=True),
             col('dov_StageChangedOn', 'Stage changed on', 'datetime', secured=True),
             col('dov_OutcomeReason', 'Outcome reason', 'choice', optionset='dov_outcomereason', secured=True),
             col('dov_DidNotStart', 'Did not start', 'bit', default=0, secured=True),
             col('dov_Notes', 'Notes', 'memo', max=4000),
             col('dov_ReqTotal', 'Requirements counted', 'int', min=0, max=1000),
             col('dov_ReqCleared', 'Requirements cleared', 'int', min=0, max=1000),
             col('dov_ReqRequiredOpen', 'Required open', 'int', min=0, max=1000),
             col('dov_ReqOverdue', 'Required overdue', 'int', min=0, max=1000),
             col('dov_ReqDueSoon', 'Required due soon', 'int', min=0, max=1000),
             col('dov_Readiness', 'Readiness', 'int', min=0, max=100),
             col('dov_Risk', 'Risk', 'choice', optionset='dov_risklevel', default='Clear'),
         ], keys=[('dov_ApplicationNumberKey', 'Application number', ['dov_applicationnumber'])],
         view=['dov_applicationnumber', 'dov_candidatetype', 'dov_office', 'dov_stage', 'dov_recruiter',
               'dov_intake', 'dov_readiness', 'dov_risk']),
    dict(schema='dov_ApplicationRequirement', display='Application Requirement', plural='Application Requirements',
         primary=('dov_Name', 'Name', 100), audit=True, columns=[
             col('dov_Application', 'Application', 'lookup', target='dov_Application', delete='Cascade', required=True),
             col('dov_WorkflowStep', 'Workflow step', 'lookup', target='dov_WorkflowStep', delete='Restrict', required=True),
             col('dov_State', 'State', 'choice', optionset='dov_requirementstate', default='Not started'),
             col('dov_Value', 'Value', 'text', max=500),
             col('dov_DueDate', 'Due date', 'date'),
             col('dov_Required', 'Required', 'bit', default=0),
             col('dov_CountsTowardReadiness', 'Counts toward readiness', 'bit', default=1),
             col('dov_RequiredBeforeStage', 'Required before stage', 'choice', optionset='dov_stage'),
             col('dov_WaiverNote', 'Waiver note', 'text', max=500),
         ], keys=[('dov_ApplicationStepKey', 'Application and step', ['dov_application', 'dov_workflowstep'])],
         view=['dov_application', 'dov_state', 'dov_value', 'dov_duedate', 'dov_required']),
    dict(schema='dov_OfficeSiteRequirement', display='Office Site Requirement', plural='Office Site Requirements',
         primary=('dov_Name', 'Name', 300), audit=True, columns=[
             col('dov_Office', 'Office', 'lookup', target='dov_Office', delete='Cascade', required=True),
             col('dov_SiteRequirement', 'Site requirement', 'lookup', target='dov_SiteRequirement', delete='Restrict', required=True),
             col('dov_OfficeText', 'Office text', 'memo', max=4000),
         ], keys=[('dov_OfficeSiteRequirementKey', 'Office and site requirement', ['dov_office', 'dov_siterequirement'])],
         view=['dov_office', 'dov_siterequirement', 'dov_officetext']),
    dict(schema='dov_StageHistory', display='Stage History', plural='Stage History', primary=('dov_Name', 'Name', 200),
         audit=False, columns=[
             col('dov_Application', 'Application', 'lookup', target='dov_Application', delete='Cascade', required=True),
             col('dov_FromStage', 'From stage', 'choice', optionset='dov_stage'),
             col('dov_ToStage', 'To stage', 'choice', optionset='dov_stage'),
             col('dov_OutcomeReason', 'Outcome reason', 'choice', optionset='dov_outcomereason'),
             col('dov_ChangedBy', 'Changed by', 'lookup', target='SystemUser', delete='RemoveLink'),
             col('dov_ChangedOn', 'Changed on', 'datetime'),
         ], keys=[], view=['dov_application', 'dov_fromstage', 'dov_tostage', 'dov_outcomereason',
                           'dov_changedby', 'dov_changedon'], order='dov_changedon'),
]

# Privileges per role: table -> privilege verbs (all at Organisation level).
ALL = ['Create', 'Read', 'Write', 'Delete', 'Append', 'AppendTo', 'Assign', 'Share']
CONFIG = ['dov_Office', 'dov_Intake', 'dov_WorkflowStep', 'dov_SiteRequirement', 'dov_OfficeSiteRequirement']
ROLES = {
    'Recruitment - Recruiter': {
        'dov_Application': ['Create', 'Read', 'Write', 'Append', 'AppendTo'],
        'dov_Candidate': ['Create', 'Read', 'Write', 'Append', 'AppendTo'],
        'dov_ApplicationRequirement': ['Read', 'Write', 'Append', 'AppendTo'],
        'dov_StageHistory': ['Read'],
        **{t: ['Read', 'AppendTo'] for t in CONFIG},
    },
    'Recruitment - Compliance reviewer': {
        'dov_Application': ['Read', 'Write', 'Append', 'AppendTo'],
        'dov_Candidate': ['Read', 'Write', 'Append', 'AppendTo'],
        'dov_ApplicationRequirement': ['Read', 'Write', 'Append', 'AppendTo'],
        'dov_StageHistory': ['Read'],
        **{t: ['Read', 'AppendTo'] for t in CONFIG},
    },
    'Recruitment - Manager': {
        **{t['schema']: ALL for t in TABLES},
        'dov_StageHistory': ['Read', 'AppendTo'],
    },
}

# ---------------------------------------------------------------- helpers ---

BOILER_A = '''          <ImeMode>{ime}</ImeMode>
          <ValidForUpdateApi>1</ValidForUpdateApi>
          <ValidForReadApi>1</ValidForReadApi>
          <ValidForCreateApi>1</ValidForCreateApi>
          <IsCustomField>1</IsCustomField>
          <IsAuditEnabled>{audit}</IsAuditEnabled>
          <IsSecured>{secured}</IsSecured>
          <IntroducedVersion>1.0.0.0</IntroducedVersion>
          <IsCustomizable>1</IsCustomizable>
          <IsRenameable>1</IsRenameable>
          <CanModifySearchSettings>1</CanModifySearchSettings>
          <CanModifyRequirementLevelSettings>1</CanModifyRequirementLevelSettings>
          <CanModifyAdditionalSettings>1</CanModifyAdditionalSettings>
          <SourceType>0</SourceType>
          <IsGlobalFilterEnabled>0</IsGlobalFilterEnabled>
          <IsSortableEnabled>0</IsSortableEnabled>
          <CanModifyGlobalFilterSettings>1</CanModifyGlobalFilterSettings>
          <CanModifyIsSortableSettings>1</CanModifyIsSortableSettings>
          <IsDataSourceSecret>0</IsDataSourceSecret>
          <AutoNumberFormat>{autonumber}</AutoNumberFormat>
          <IsSearchable>{searchable}</IsSearchable>
          <IsFilterable>0</IsFilterable>
          <IsRetrievable>{retrievable}</IsRetrievable>
          <IsLocalizable>0</IsLocalizable>
'''


def labels(tag, text, indent):
    pad = ' ' * indent
    return f'{pad}<{tag}s>\n{pad}  <{tag} description="{escape(text)}" languagecode="1033" />\n{pad}</{tag}s>\n'


def attribute_xml(table, schema, display, kind, opts, primary=False):
    logical = schema.lower()
    xml_type = {'text': 'nvarchar', 'email': 'nvarchar', 'memo': 'ntext', 'int': 'int', 'bit': 'bit',
                'date': 'datetime', 'datetime': 'datetime', 'choice': 'picklist', 'lookup': 'lookup'}[kind]
    required = 'required' if (primary or opts.get('required')) else 'none'
    mask = ('PrimaryName|ValidForAdvancedFind|ValidForForm|ValidForGrid|RequiredForForm' if primary
            else 'ValidForAdvancedFind|ValidForForm|ValidForGrid')
    out = f'        <attribute PhysicalName="{schema}">\n'
    out += f'          <Type>{xml_type}</Type>\n          <Name>{logical}</Name>\n          <LogicalName>{logical}</LogicalName>\n'
    out += f'          <RequiredLevel>{required}</RequiredLevel>\n          <DisplayMask>{mask}</DisplayMask>\n'
    out += BOILER_A.format(
        ime='disabled' if kind == 'int' else 'auto',
        audit=1 if table['audit'] else 0,
        secured=1 if opts.get('secured') else 0,
        autonumber=escape(opts.get('autonumber', '')),
        searchable=1 if primary or kind in ('text', 'email') else 0,
        retrievable=1 if primary else 0,
    )
    if kind in ('text', 'email'):
        out += f'          <Format>{"email" if kind == "email" else "text"}</Format>\n'
        out += f'          <MaxLength>{opts["max"]}</MaxLength>\n          <Length>{opts["max"] * 2}</Length>\n'
    elif kind == 'memo':
        out += f'          <Format>text</Format>\n          <MaxLength>{opts["max"]}</MaxLength>\n'
    elif kind == 'int':
        out += f'          <Format>none</Format>\n          <MinValue>{opts["min"]}</MinValue>\n          <MaxValue>{opts["max"]}</MaxValue>\n'
    elif kind == 'date':
        # Date only, time-zone independent (Behavior 3), as in the reference export.
        out += '          <Format>date</Format>\n          <CanChangeDateTimeBehavior>1</CanChangeDateTimeBehavior>\n          <Behavior>3</Behavior>\n'
    elif kind == 'datetime':
        out += '          <Format>datetime</Format>\n          <CanChangeDateTimeBehavior>1</CanChangeDateTimeBehavior>\n          <Behavior>1</Behavior>\n'
    elif kind == 'choice':
        default = choice_value(opts['optionset'], opts['default']) if 'default' in opts else -1
        out += f'          <AppDefaultValue>{default}</AppDefaultValue>\n          <OptionSetName>{opts["optionset"]}</OptionSetName>\n'
    elif kind == 'lookup':
        out += '          <LookupStyle>single</LookupStyle>\n          <LookupTypes />\n'
    elif kind == 'bit':
        out += f'          <AppDefaultValue>{opts["default"]}</AppDefaultValue>\n'
        out += f'          <optionset Name="{table["schema"].lower()}_{logical[len(PREFIX) + 1:]}">\n'
        out += '            <OptionSetType>bit</OptionSetType>\n            <IntroducedVersion>1.0.0.0</IntroducedVersion>\n            <IsCustomizable>1</IsCustomizable>\n'
        out += labels('displayname', display, 12) + labels('Description', '', 12)
        out += '            <options>\n'
        for value, text in ((1, 'Yes'), (0, 'No')):
            out += f'              <option value="{value}" IsHidden="0">\n' + labels('label', text, 16) + '              </option>\n'
        out += '            </options>\n          </optionset>\n'
    out += labels('displayname', display, 10) + labels('Description', '', 10)
    out += '        </attribute>\n'
    return out


def read(path):
    return path.read_text(encoding='utf-8-sig')


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')


def rename_template(text, table):
    schema, logical = table['schema'], table['schema'].lower()
    for old, new in [
        ('admin_AppCatalogFeedbackId', f'{schema}Id'),
        ('admin_appcatalogfeedbackid', f'{logical}id'),
        ('admin_appcatalogfeedbacks', f'{logical}s'),
        ('admin_AppCatalogFeedback', schema),
        ('admin_appcatalogfeedback', logical),
        ('App Catalog Feedbacks', table['plural']),
        ('App Catalog Feedback', table['display']),
    ]:
        text = text.replace(old, new)
    return text


# ------------------------------------------------------------------ build ---

def build_entity(table, template):
    schema, logical = table['schema'], table['schema'].lower()
    head, rest = template.split('      <attributes>\n', 1)
    body, tail = rest.split('      </attributes>\n', 1)
    blocks = re.findall(r'        <attribute PhysicalName="([^"]+)">.*?</attribute>\n', body, re.S)
    system = re.findall(r'(        <attribute PhysicalName="[^"]+">.*?</attribute>\n)', body, re.S)
    assert len(blocks) == len(system)
    keep = []
    for name, block in zip(blocks, system):
        if name == 'admin_AppCatalogFeedbackId' or not name.startswith('admin_'):
            keep.append(rename_template(block, table))
    attributes = keep + [attribute_xml(table, *table['primary'][:2], 'text', {'max': table['primary'][2]}, primary=True)]
    attributes += [attribute_xml(table, *c) for c in table['columns']]
    keys = ''
    if table['keys']:
        keys = '      <EntityKeys>\n'
        for key_schema, key_display, fields in table['keys']:
            keys += (f'        <EntityKey>\n          <Name>{key_schema}</Name>\n          <LogicalName>{key_schema.lower()}</LogicalName>\n'
                     '          <IntroducedVersion>1.0.0.0</IntroducedVersion>\n          <IsCustomizable>1</IsCustomizable>\n'
                     '          <EntityKeyAttributes>\n')
            keys += ''.join(f'            <AttributeName>{f}</AttributeName>\n' for f in fields)
            keys += '          </EntityKeyAttributes>\n' + labels('displayname', key_display, 10) + '        </EntityKey>\n'
        keys += '      </EntityKeys>\n'
    head = rename_template(head, table)
    tail = rename_template(tail, table)
    tail = re.sub(r'<IconVectorName>[^<]*</IconVectorName>', '<IconVectorName></IconVectorName>', tail)
    tail = tail.replace('<IsAuditEnabled>0</IsAuditEnabled>', f'<IsAuditEnabled>{1 if table["audit"] else 0}</IsAuditEnabled>', 1)
    tail = tail.replace('<IntroducedVersion>1.0</IntroducedVersion>', '<IntroducedVersion>1.0.0.0</IntroducedVersion>')
    xml = head + '      <attributes>\n' + ''.join(attributes) + '      </attributes>\n' + keys + tail
    base = SRC / 'Entities' / schema
    write(base / 'Entity.xml', xml)
    write(base / 'RibbonDiff.xml', RIBBON)
    build_views(table, base / 'SavedQueries')
    build_form(table, base / 'FormXml' / 'main')


RIBBON = '''<?xml version="1.0" encoding="utf-8"?>
<RibbonDiffXml xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CustomActions />
  <Templates>
    <RibbonTemplates Id="Mscrm.Templates"></RibbonTemplates>
  </Templates>
  <CommandDefinitions />
  <RuleDefinitions>
    <TabDisplayRules />
    <DisplayRules />
    <EnableRules />
  </RuleDefinitions>
  <LocLabels />
</RibbonDiffXml>'''


def build_views(table, folder):
    logical = table['schema'].lower()
    name = table['primary'][0].lower()
    order = table.get('order', name)

    def view(key, title, querytype, cells, state=0, quickfind=False, default=1, grid='resultset', row='result', deletable=0):
        cell_xml = ''.join(f'          <cell name="{c}" width="{300 if c == name else 150}" />\n' for c in cells)
        attrs = ''.join(f'          <attribute name="{c}" />\n' for c in [f'{logical}id'] + cells)
        qf = ''
        if quickfind:
            qf = ('          <filter type="or" isquickfindfields="1">\n'
                  f'            <condition attribute="{name}" operator="like" value="{{0}}" />\n          </filter>\n')
        xml = f'''<?xml version="1.0" encoding="utf-8"?>
<savedqueries xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <savedquery>
    <IsCustomizable>1</IsCustomizable>
    <CanBeDeleted>{deletable}</CanBeDeleted>
    <isquickfindquery>{1 if quickfind else 0}</isquickfindquery>
    <isprivate>0</isprivate>
    <isdefault>{default}</isdefault>
    <savedqueryid>{guid(logical, key)}</savedqueryid>
    <layoutxml>
      <grid name="{grid}" jump="{name}" select="1" icon="1" preview="1">
        <row name="{row}" id="{logical}id">
{cell_xml}        </row>
      </grid>
    </layoutxml>
    <querytype>{querytype}</querytype>
    <fetchxml>
      <fetch version="1.0" mapping="logical">
        <entity name="{logical}">
{attrs}          <order attribute="{order}" descending="{'true' if order.endswith('changedon') else 'false'}" />
          <filter type="and">
            <condition attribute="statecode" operator="eq" value="{state}" />
          </filter>
{qf}        </entity>
      </fetch>
    </fetchxml>
    <IntroducedVersion>1.0.0.0</IntroducedVersion>
    <LocalizedNames>
      <LocalizedName description="{escape(title)}" languagecode="1033" />
    </LocalizedNames>
  </savedquery>
</savedqueries>'''
        write(folder / f'{guid(logical, key)}.xml', xml)

    main = [name] + table['view']
    view('active', f'Active {table["plural"]}', 0, main)
    view('inactive', f'Inactive {table["plural"]}', 0, main, state=1, default=0, deletable=1)
    view('lookup', f'{table["display"]} Lookup View', 64, [name, 'createdon'], grid=f'{logical}s', row=logical)
    view('quickfind', f'Quick Find Active {table["plural"]}', 4, [name, 'createdon'], quickfind=True)
    view('advancedfind', f'{table["display"]} Advanced Find View', 1, main)
    view('associated', f'{table["display"]} Associated View', 2, main)


CONTROL = {
    'text': '{4273EDBD-AC1D-40D3-9FB2-095C621B552D}', 'email': '{ADA2203E-B4CD-49BE-9DDF-234642B43B52}',
    'memo': '{E0DECE4B-6FC8-4A8F-A065-082708572369}', 'int': '{C6D124CA-7EDA-4A60-AEA9-7FB8D318B68F}',
    'bit': '{67FAC785-CD58-4F9F-ABB3-4B7DDC6ED5ED}', 'date': '{5B773807-9FB2-42DB-97C3-7A91EFF8ADFF}',
    'datetime': '{5B773807-9FB2-42DB-97C3-7A91EFF8ADFF}', 'choice': '{3EF39988-22BB-4F0B-BBBE-64B5A3748AEE}',
    'lookup': '{270BD3DB-D9AF-4782-9025-509E298DEC0A}',
}


def build_form(table, folder):
    logical = table['schema'].lower()
    fields = [(table['primary'][0].lower(), table['primary'][1], 'text')]
    fields += [(schema.lower(), display, kind) for schema, display, kind, _ in table['columns']]
    fields += [('ownerid', 'Owner', 'lookup')]
    rows = ''
    for field, display, kind in fields:
        rows += f'''                    <row>
                      <cell id="{guid(logical, 'form', field)}">
                        <labels>
                          <label description="{escape(display)}" languagecode="1033" />
                        </labels>
                        <control id="{field}" classid="{CONTROL[kind]}" datafieldname="{field}" />
                      </cell>
                    </row>
'''
    form_id = guid(logical, 'mainform')
    xml = f'''<?xml version="1.0" encoding="utf-8"?>
<forms xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <systemform>
    <formid>{form_id}</formid>
    <IntroducedVersion>1.0.0.0</IntroducedVersion>
    <FormPresentation>1</FormPresentation>
    <FormActivationState>1</FormActivationState>
    <form headerdensity="HighWithControls">
      <tabs>
        <tab verticallayout="true" id="{guid(logical, 'tab')}" IsUserDefined="1">
          <labels>
            <label description="General" languagecode="1033" />
          </labels>
          <columns>
            <column width="100%">
              <sections>
                <section showlabel="false" showbar="false" IsUserDefined="0" id="{guid(logical, 'section')}">
                  <labels>
                    <label description="General" languagecode="1033" />
                  </labels>
                  <rows>
{rows}                  </rows>
                </section>
              </sections>
            </column>
          </columns>
        </tab>
      </tabs>
      <DisplayConditions Order="0" FallbackForm="true">
        <Everyone />
      </DisplayConditions>
    </form>
    <IsCustomizable>1</IsCustomizable>
    <CanBeDeleted>1</CanBeDeleted>
    <LocalizedNames>
      <LocalizedName description="Information" languagecode="1033" />
    </LocalizedNames>
    <Descriptions>
      <Description description="A form for this entity." languagecode="1033" />
    </Descriptions>
  </systemform>
</forms>'''
    write(folder / f'{form_id}.xml', xml)


CASCADE = {
    # Patterns observed in the reference export.
    'Cascade': dict(Assign='NoCascade', Delete='Cascade', Archive='NoCascade'),
    'RemoveLink': dict(Assign='NoCascade', Delete='RemoveLink', Archive='NoCascade'),
    'Restrict': dict(Assign='NoCascade', Delete='Restrict', Archive='Restrict'),
}


def relationship_xml(name, referencing, referenced, attribute, delete):
    c = CASCADE[delete]
    return f'''  <EntityRelationship Name="{name}">
    <EntityRelationshipType>OneToMany</EntityRelationshipType>
    <IsCustomizable>1</IsCustomizable>
    <IntroducedVersion>1.0.0.0</IntroducedVersion>
    <IsHierarchical>0</IsHierarchical>
    <ReferencingEntityName>{referencing}</ReferencingEntityName>
    <ReferencedEntityName>{referenced}</ReferencedEntityName>
    <CascadeAssign>{c['Assign']}</CascadeAssign>
    <CascadeDelete>{c['Delete']}</CascadeDelete>
    <CascadeArchive>{c['Archive']}</CascadeArchive>
    <CascadeReparent>NoCascade</CascadeReparent>
    <CascadeShare>NoCascade</CascadeShare>
    <CascadeUnshare>NoCascade</CascadeUnshare>
    <CascadeRollupView>NoCascade</CascadeRollupView>
    <IsValidForAdvancedFind>1</IsValidForAdvancedFind>
    <ReferencingAttributeName>{attribute}</ReferencingAttributeName>
    <RelationshipDescription>
      <Descriptions>
        <Description description="" languagecode="1033" />
      </Descriptions>
    </RelationshipDescription>
    <EntityRelationshipRoles>
      <EntityRelationshipRole>
        <NavPaneDisplayOption>UseCollectionName</NavPaneDisplayOption>
        <NavPaneArea>Details</NavPaneArea>
        <NavPaneOrder>10000</NavPaneOrder>
        <NavigationPropertyName>{attribute}</NavigationPropertyName>
        <RelationshipRoleType>1</RelationshipRoleType>
      </EntityRelationshipRole>
      <EntityRelationshipRole>
        <NavigationPropertyName>{name}</NavigationPropertyName>
        <RelationshipRoleType>0</RelationshipRoleType>
      </EntityRelationshipRole>
    </EntityRelationshipRoles>
  </EntityRelationship>
'''


def build_relationships():
    system = read(TEMPLATE / 'system-relationships.xml')
    groups = re.findall(r'<Group file="([^"]+)">\n(.*?)\n</Group>', system, re.S)
    files, names = {}, []
    for table in TABLES:
        for file, block in groups:
            block = rename_template(block, table).replace('<IntroducedVersion>1.0</IntroducedVersion>', '<IntroducedVersion>1.0.0.0</IntroducedVersion>')
            files.setdefault(file, []).append(block + '\n')
            names.append(re.search(r'Name="([^"]+)"', block).group(1))
        for schema, _, kind, opts in table['columns']:
            if kind != 'lookup':
                continue
            target = opts['target']
            # Kept under the 57-character maximum seen in the reference export.
            name = f'{table["schema"]}_{schema[len(PREFIX) + 1:]}'
            files.setdefault(f'{target}.xml', []).append(
                relationship_xml(name, table['schema'], target, schema, opts['delete']))
            names.append(name)
    for file, blocks in files.items():
        write(SRC / 'Other' / 'Relationships' / file,
              '<?xml version="1.0" encoding="utf-8"?>\n<EntityRelationships xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n'
              + ''.join(blocks) + '</EntityRelationships>')
    write(SRC / 'Other' / 'Relationships.xml',
          '<?xml version="1.0" encoding="utf-8"?>\n<EntityRelationships xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n'
          + ''.join(f'  <EntityRelationship Name="{n}" />\n' for n in sorted(names, key=str.lower)) + '</EntityRelationships>')
    return names


def build_optionsets():
    for name, (display, options) in CHOICES.items():
        opts = ''.join(f'    <option value="{OPTION_BASE + i}" IsHidden="0">\n' + labels('label', o, 6) + '    </option>\n'
                       for i, o in enumerate(options))
        write(SRC / 'OptionSets' / f'{name}.xml', f'''<?xml version="1.0" encoding="utf-8"?>
<optionset Name="{name}" localizedName="{escape(display)}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <OptionSetType>picklist</OptionSetType>
  <IsGlobal>1</IsGlobal>
  <IntroducedVersion>1.0.0.0</IntroducedVersion>
  <IsCustomizable>1</IsCustomizable>
{labels('displayname', display, 2)}{labels('Description', '', 2)}  <options>
{opts}  </options>
</optionset>''')


def build_roles():
    ids = []
    for role, tables in ROLES.items():
        role_id = guid('role', role)
        ids.append(role_id)
        privileges = [f'prv{verb}{table}' for table, verbs in tables.items() for verb in verbs]
        privileges.append('prvAppendToUser')  # lets the role set Recruiter / Changed by lookups
        body = ''.join(f'    <RolePrivilege name="{p}" level="Global" />\n' for p in sorted(privileges, key=str.lower))
        write(SRC / 'Roles' / f'{role}.xml', f'''<?xml version="1.0" encoding="utf-8"?>
<Role id="{role_id}" name="{escape(role)}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <IsCustomizable>1</IsCustomizable>
  <IsAutoAssigned>0</IsAutoAssigned>
  <RolePrivileges>
{body}  </RolePrivileges>
</Role>''')
    return ids


SOLUTION = '''<?xml version="1.0" encoding="utf-8"?>
<ImportExportXml version="9.2.24014.198" SolutionPackageVersion="9.2" languagecode="1033" generatedBy="CrmLive" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <SolutionManifest>
    <UniqueName>RecruitmentOperations</UniqueName>
    <LocalizedNames>
      <LocalizedName description="Recruitment Operations" languagecode="1033" />
    </LocalizedNames>
    <Descriptions>
      <Description description="Dataverse tables, choices and security roles for the recruitment tracker." languagecode="1033" />
    </Descriptions>
    <Version>{version}</Version>
    <Managed>0</Managed>
    <Publisher>
      <UniqueName>dovida</UniqueName>
      <LocalizedNames>
        <LocalizedName description="Dovida" languagecode="1033" />
      </LocalizedNames>
      <Descriptions>
        <Description description="Dovida" languagecode="1033" />
      </Descriptions>
      <EMailAddress xsi:nil="true"></EMailAddress>
      <SupportingWebsiteUrl xsi:nil="true"></SupportingWebsiteUrl>
      <CustomizationPrefix>dov</CustomizationPrefix>
      <CustomizationOptionValuePrefix>72559</CustomizationOptionValuePrefix>
      <Addresses>
        <!-- Address of the Publisher-->
        <Address>
          <AddressNumber>1</AddressNumber>
          <AddressTypeCode>1</AddressTypeCode>
          <City xsi:nil="true"></City>
          <County xsi:nil="true"></County>
          <Country xsi:nil="true"></Country>
          <Fax xsi:nil="true"></Fax>
          <FreightTermsCode xsi:nil="true"></FreightTermsCode>
          <ImportSequenceNumber xsi:nil="true"></ImportSequenceNumber>
          <Latitude xsi:nil="true"></Latitude>
          <Line1 xsi:nil="true"></Line1>
          <Line2 xsi:nil="true"></Line2>
          <Line3 xsi:nil="true"></Line3>
          <Longitude xsi:nil="true"></Longitude>
          <Name xsi:nil="true"></Name>
          <PostalCode xsi:nil="true"></PostalCode>
          <PostOfficeBox xsi:nil="true"></PostOfficeBox>
          <PrimaryContactName xsi:nil="true"></PrimaryContactName>
          <ShippingMethodCode>1</ShippingMethodCode>
          <StateOrProvince xsi:nil="true"></StateOrProvince>
          <Telephone1 xsi:nil="true"></Telephone1>
          <Telephone2 xsi:nil="true"></Telephone2>
          <Telephone3 xsi:nil="true"></Telephone3>
          <TimeZoneRuleVersionNumber xsi:nil="true"></TimeZoneRuleVersionNumber>
          <UPSZone xsi:nil="true"></UPSZone>
          <UTCOffset xsi:nil="true"></UTCOffset>
          <UTCConversionTimeZoneCode xsi:nil="true"></UTCConversionTimeZoneCode>
        </Address>
        <Address>
          <AddressNumber>2</AddressNumber>
          <AddressTypeCode>1</AddressTypeCode>
          <City xsi:nil="true"></City>
          <County xsi:nil="true"></County>
          <Country xsi:nil="true"></Country>
          <Fax xsi:nil="true"></Fax>
          <FreightTermsCode xsi:nil="true"></FreightTermsCode>
          <ImportSequenceNumber xsi:nil="true"></ImportSequenceNumber>
          <Latitude xsi:nil="true"></Latitude>
          <Line1 xsi:nil="true"></Line1>
          <Line2 xsi:nil="true"></Line2>
          <Line3 xsi:nil="true"></Line3>
          <Longitude xsi:nil="true"></Longitude>
          <Name xsi:nil="true"></Name>
          <PostalCode xsi:nil="true"></PostalCode>
          <PostOfficeBox xsi:nil="true"></PostOfficeBox>
          <PrimaryContactName xsi:nil="true"></PrimaryContactName>
          <ShippingMethodCode>1</ShippingMethodCode>
          <StateOrProvince xsi:nil="true"></StateOrProvince>
          <Telephone1 xsi:nil="true"></Telephone1>
          <Telephone2 xsi:nil="true"></Telephone2>
          <Telephone3 xsi:nil="true"></Telephone3>
          <TimeZoneRuleVersionNumber xsi:nil="true"></TimeZoneRuleVersionNumber>
          <UPSZone xsi:nil="true"></UPSZone>
          <UTCOffset xsi:nil="true"></UTCOffset>
          <UTCConversionTimeZoneCode xsi:nil="true"></UTCConversionTimeZoneCode>
        </Address>
      </Addresses>
    </Publisher>
    <RootComponents>
{roots}    </RootComponents>
    <MissingDependencies />
  </SolutionManifest>
</ImportExportXml>'''

CUSTOMIZATIONS = '''<?xml version="1.0" encoding="utf-8"?>
<ImportExportXml xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Entities />
  <Roles />
  <Workflows />
  <FieldSecurityProfiles />
  <Templates />
  <EntityMaps />
  <EntityRelationships />
  <OrganizationSettings />
  <optionsets />
  <CustomControls />
  <SolutionPluginAssemblies />
  <EntityDataProviders />
  <Languages>
    <Language>1033</Language>
  </Languages>
</ImportExportXml>'''


def main():
    if SRC.exists():
        shutil.rmtree(SRC)
    template = read(TEMPLATE / 'entity-template.xml')
    for table in TABLES:
        build_entity(table, template)
    build_optionsets()
    build_relationships()
    role_ids = build_roles()
    roots = ''.join(f'      <RootComponent type="1" schemaName="{t["schema"].lower()}" behavior="0" />\n' for t in TABLES)
    roots += ''.join(f'      <RootComponent type="9" schemaName="{n}" behavior="0" />\n' for n in CHOICES)
    roots += ''.join(f'      <RootComponent type="20" id="{i}" behavior="0" />\n' for i in role_ids)
    write(SRC / 'Other' / 'Solution.xml', SOLUTION.format(version=VERSION, roots=roots))
    write(SRC / 'Other' / 'Customizations.xml', CUSTOMIZATIONS)
    print(f'Wrote {len(TABLES)} tables, {len(CHOICES)} choices, {len(ROLES)} roles to {SRC}')


if __name__ == '__main__':
    main()
