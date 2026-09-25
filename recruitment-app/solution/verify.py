"""Checks the generated solution source before packing.

1. Every generated column has exactly the element sequence Dataverse itself
   exports for that column type (compared with a reference solution folder,
   e.g. a CoE Starter Kit checkout: python3 verify.py <reference src>).
2. Everything a view, form, key, relationship or role refers to exists.
"""
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

SRC = Path(__file__).parent / 'src'
problems = []


def sig(attr):
    t = attr.findtext('Type')
    fmt = attr.findtext('Format') or ''
    return (t, fmt, attr.find('optionset') is not None and attr.find('optionset').findtext('OptionSetType') == 'bit')


def shape(attr):
    return [child.tag for child in attr]


reference = {}
if len(sys.argv) > 1:
    for entity in Path(sys.argv[1]).glob('Entities/*/Entity.xml'):
        for attr in ET.parse(entity).getroot().iter('attribute'):
            if attr.findtext('IsCustomField') == '1':
                reference.setdefault(sig(attr), set()).add(tuple(shape(attr)))

choices = {p.stem for p in (SRC / 'OptionSets').glob('*.xml')}
entities = {}
for entity_file in (SRC / 'Entities').glob('*/Entity.xml'):
    root = ET.parse(entity_file).getroot()
    name = root.findtext('Name')
    attrs = {a.findtext('LogicalName'): a for a in root.iter('attribute')}
    entities[name] = attrs
    for logical, attr in attrs.items():
        if attr.findtext('IsCustomField') != '1':
            continue
        if reference:
            known = reference.get(sig(attr))
            if not known:
                problems.append(f'{name}.{logical}: no reference column of type {sig(attr)}')
            elif tuple(shape(attr)) not in known:
                problems.append(f'{name}.{logical}: element order differs from every reference {sig(attr)} column')
        if attr.findtext('OptionSetName') and attr.findtext('OptionSetName') not in choices:
            problems.append(f'{name}.{logical}: unknown choice {attr.findtext("OptionSetName")}')
    for key in root.iter('EntityKey'):
        for field in key.iter('AttributeName'):
            if field.text not in attrs:
                problems.append(f'{name}: key field {field.text} missing')
    folder = entity_file.parent
    for view in folder.glob('SavedQueries/*.xml'):
        text = view.read_text(encoding='utf-8-sig')
        fields = set(re.findall(r'<(?:cell|attribute) name="([^"]+)"', text))
        fields |= set(re.findall(r'\sattribute="([^"]+)"', text))
        if not fields:
            problems.append(f'{name} view {view.name}: no columns found')
        for field in fields:
            if field not in attrs:
                problems.append(f'{name} view {view.name}: {field} missing')
    for form in folder.glob('FormXml/*/*.xml'):
        for field in re.findall(r'datafieldname="([^"]+)"', form.read_text(encoding='utf-8-sig')):
            if field not in attrs:
                problems.append(f'{name} form: {field} missing')

by_schema = {k.lower(): k for k in entities}
lookups_seen = set()
for rel_file in (SRC / 'Other' / 'Relationships').glob('*.xml'):
    for rel in ET.parse(rel_file).getroot():
        referencing = rel.findtext('ReferencingEntityName')
        attribute = rel.findtext('ReferencingAttributeName').lower()
        if referencing not in entities or attribute not in entities[referencing]:
            problems.append(f'relationship {rel.get("Name")}: {referencing}.{attribute} missing')
        lookups_seen.add((referencing, attribute))
        if len(rel.get('Name')) > 50:
            problems.append(f'relationship {rel.get("Name")}: name longer than 50 characters')
        if rel_file.stem != rel.findtext('ReferencedEntityName'):
            problems.append(f'relationship {rel.get("Name")} is in the wrong file')
for name, attrs in entities.items():
    for logical, attr in attrs.items():
        if attr.findtext('Type') in ('lookup', 'owner') and logical not in ('ownerid',) and (name, logical) not in lookups_seen:
            if attr.findtext('IsCustomField') == '1' or logical in ('createdby', 'modifiedby', 'owningteam', 'owninguser', 'owningbusinessunit'):
                problems.append(f'{name}.{logical}: lookup has no relationship')

for role in (SRC / 'Roles').glob('*.xml'):
    for privilege in ET.parse(role).getroot().iter('RolePrivilege'):
        m = re.match(r'prv(?:Create|Read|Write|Delete|Append|AppendTo|Assign|Share)(dov_\w+)$', privilege.get('name'))
        if m and m.group(1) not in entities:
            problems.append(f'{role.stem}: privilege for unknown table {m.group(1)}')

print('\n'.join(problems) or f'OK: {len(entities)} tables checked' + (' against reference export' if reference else ''))
sys.exit(1 if problems else 0)
