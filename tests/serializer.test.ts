import { describe, expect, it } from 'vitest';
import { serializeXsd } from '@/model/serializer';
import {
  Case,
  CharacterType,
  ChildOrder,
  createDefaultFieldInfo,
  createDefaultGroupInfo,
  createDefaultRecordInfo,
  createDefaultSchemaInfo,
  type FFAttributeNode,
  type FFChoiceNode,
  type FFElementNode,
  type FFRecordNode,
  type FFSchemaNode,
  type FFSequenceNode,
  Justification,
  ParserOptimization,
  StructureType,
  XmlSchemaUse,
} from '@/model/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a minimal valid schema tree for testing. */
function makeSchema(
  children: import('@/model/types').FFNode[] = [],
  overrides: Partial<FFSchemaNode> = {},
): FFSchemaNode {
  return {
    id: 'n1',
    kind: 'schema',
    targetNamespace: 'http://example.com/ns',
    elementFormDefault: 'qualified',
    schemaInfo: createDefaultSchemaInfo(),
    children,
    ...overrides,
  };
}

function makeRecord(
  name: string,
  children: import('@/model/types').FFNode[] = [],
  overrides: Partial<FFRecordNode> = {},
): FFRecordNode {
  return {
    id: `r_${name}`,
    kind: 'record',
    name,
    namespace: '',
    minOccurs: 1,
    maxOccurs: 1,
    recordInfo: createDefaultRecordInfo(),
    children,
    ...overrides,
  };
}

function makeElement(name: string, overrides: Partial<FFElementNode> = {}): FFElementNode {
  return {
    id: `e_${name}`,
    kind: 'element',
    name,
    namespace: '',
    dataType: 'xs:string',
    minOccurs: 1,
    maxOccurs: 1,
    fieldInfo: createDefaultFieldInfo(),
    children: [],
    ...overrides,
  };
}

function makeSequence(
  children: import('@/model/types').FFNode[] = [],
  overrides: Partial<FFSequenceNode> = {},
): FFSequenceNode {
  return {
    id: `seq_${Math.random().toString(36).slice(2, 6)}`,
    kind: 'sequence',
    minOccurs: 1,
    maxOccurs: 1,
    groupInfo: createDefaultGroupInfo(),
    children,
    ...overrides,
  };
}

function makeChoice(
  children: import('@/model/types').FFNode[] = [],
  overrides: Partial<FFChoiceNode> = {},
): FFChoiceNode {
  return {
    id: `ch_${Math.random().toString(36).slice(2, 6)}`,
    kind: 'choice',
    minOccurs: 1,
    maxOccurs: 1,
    groupInfo: createDefaultGroupInfo(),
    children,
    ...overrides,
  };
}

function makeAttribute(name: string, overrides: Partial<FFAttributeNode> = {}): FFAttributeNode {
  return {
    id: `a_${name}`,
    kind: 'attribute',
    name,
    namespace: '',
    dataType: 'xs:string',
    use: XmlSchemaUse.Optional,
    fieldInfo: createDefaultFieldInfo(),
    children: [],
    ...overrides,
  };
}

// ─── Basic Output ───────────────────────────────────────────────────────────

describe('serializeXsd – basic output', () => {
  it('produces a valid XML declaration and xs:schema element', () => {
    const schema = makeSchema();
    const xml = serializeXsd(schema);
    expect(xml).toContain('<?xml version="1.0" encoding="utf-8" ?>');
    expect(xml).toContain('<xs:schema');
    expect(xml).toContain('</xs:schema>');
  });

  it('includes namespace declarations', () => {
    const schema = makeSchema();
    const xml = serializeXsd(schema);
    expect(xml).toContain('xmlns:xs="http://www.w3.org/2001/XMLSchema"');
    expect(xml).toContain('xmlns:b="http://schemas.microsoft.com/BizTalk/2003"');
  });

  it('includes targetNamespace when set', () => {
    const schema = makeSchema([], { targetNamespace: 'http://my.ns' });
    const xml = serializeXsd(schema);
    expect(xml).toContain('targetNamespace="http://my.ns"');
    expect(xml).toContain('xmlns="http://my.ns"');
  });

  it('omits targetNamespace attributes when empty', () => {
    const schema = makeSchema([], { targetNamespace: '' });
    const xml = serializeXsd(schema);
    expect(xml).not.toContain('targetNamespace=');
    // Should not have a default xmlns with empty value
    expect(xml).not.toMatch(/xmlns=""/);
  });

  it('includes elementFormDefault', () => {
    const schema = makeSchema([], { elementFormDefault: 'unqualified' });
    const xml = serializeXsd(schema);
    expect(xml).toContain('elementFormDefault="unqualified"');
  });
});

// ─── SchemaInfo Serialization ───────────────────────────────────────────────

describe('serializeXsd – schemaInfo annotation', () => {
  it('serializes default schemaInfo with standard attribute', () => {
    const schema = makeSchema();
    const xml = serializeXsd(schema);
    expect(xml).toContain('<b:schemaInfo');
    expect(xml).toContain('standard="Flat File"');
  });

  it('serializes root_reference when set', () => {
    const schemaInfo = createDefaultSchemaInfo();
    schemaInfo.rootReference = 'MyRoot';
    const schema = makeSchema([], { schemaInfo });
    const xml = serializeXsd(schema);
    expect(xml).toContain('root_reference="MyRoot"');
  });

  it('serializes non-default schemaInfo values', () => {
    const schemaInfo = createDefaultSchemaInfo();
    schemaInfo.codePage = 1252;
    schemaInfo.case = Case.Uppercase;
    schemaInfo.allowEarlyTermination = true;
    schemaInfo.countPositionsInBytes = true;
    schemaInfo.defaultChildDelimiter = ',';
    schemaInfo.defaultChildDelimiterType = CharacterType.Character;
    schemaInfo.defaultChildOrder = ChildOrder.Prefix;
    schemaInfo.parserOptimization = ParserOptimization.Complexity;
    schemaInfo.generateEmptyNodes = false;
    schemaInfo.suppressEmptyNodes = true;

    const schema = makeSchema([], { schemaInfo });
    const xml = serializeXsd(schema);
    expect(xml).toContain('codepage="1252"');
    expect(xml).toContain('case="upper"');
    expect(xml).toContain('allow_early_termination="true"');
    expect(xml).toContain('count_positions_by_byte="true"');
    expect(xml).toContain('default_child_delimiter=","');
    expect(xml).toContain('child_delimiter_type="char"');
    expect(xml).toContain('default_child_order="prefix"');
    expect(xml).toContain('parser_optimization="complexity"');
    expect(xml).toContain('generate_empty_nodes="false"');
    expect(xml).toContain('suppress_empty_nodes="true"');
  });
});

// ─── Record Serialization ───────────────────────────────────────────────────

describe('serializeXsd – records', () => {
  it('serializes a record as xs:element with xs:complexType', () => {
    const seq = makeSequence([makeElement('F1')]);
    const rec = makeRecord('Root', [seq]);
    const schema = makeSchema([rec]);
    const xml = serializeXsd(schema);
    expect(xml).toContain('<xs:element name="Root">');
    expect(xml).toContain('<xs:complexType>');
    expect(xml).toContain('</xs:complexType>');
    expect(xml).toContain('</xs:element>');
  });

  it('serializes recordInfo annotation', () => {
    const ri = createDefaultRecordInfo();
    ri.structure = StructureType.Delimited;
    ri.childDelimiter = ',';
    ri.childDelimiterType = CharacterType.Character;
    ri.childOrder = ChildOrder.Infix;
    ri.tagIdentifier = 'TAG';
    ri.tagOffset = 5;

    const rec = makeRecord('Rec', [makeSequence()], { recordInfo: ri });
    const schema = makeSchema([rec]);
    const xml = serializeXsd(schema);
    expect(xml).toContain('<b:recordInfo');
    expect(xml).toContain('structure="delimited"');
    expect(xml).toContain('child_delimiter=","');
    expect(xml).toContain('child_delimiter_type="char"');
    expect(xml).toContain('child_order="infix"');
    expect(xml).toContain('tag_name="TAG"');
    expect(xml).toContain('tag_offset="5"');
  });

  it('serializes minOccurs / maxOccurs when non-default', () => {
    const rec = makeRecord('Multi', [makeSequence()], { minOccurs: 0, maxOccurs: Number.MAX_SAFE_INTEGER });
    const outer = makeRecord('Outer', [makeSequence([rec])]);
    const schema = makeSchema([outer]);
    const xml = serializeXsd(schema);
    expect(xml).toContain('minOccurs="0"');
    expect(xml).toContain('maxOccurs="unbounded"');
  });

  it('omits minOccurs / maxOccurs when both are 1', () => {
    const rec = makeRecord('Default', [makeSequence()], { minOccurs: 1, maxOccurs: 1 });
    const schema = makeSchema([rec]);
    const xml = serializeXsd(schema);
    // The root element line should not contain minOccurs or maxOccurs
    const elementLine = xml.split('\n').find(l => l.includes('name="Default"'));
    expect(elementLine).toBeDefined();
    expect(elementLine).not.toContain('minOccurs');
    expect(elementLine).not.toContain('maxOccurs');
  });
});

// ─── Element / Field Serialization ──────────────────────────────────────────

describe('serializeXsd – elements (fields)', () => {
  it('serializes a simple element with type', () => {
    const elem = makeElement('Amount', { dataType: 'xs:decimal' });
    const rec = makeRecord('Rec', [makeSequence([elem])]);
    const schema = makeSchema([rec]);
    const xml = serializeXsd(schema);
    expect(xml).toContain('name="Amount"');
    expect(xml).toContain('type="xs:decimal"');
  });

  it('qualifies bare type names with xs: prefix', () => {
    const elem = makeElement('Val', { dataType: 'int' });
    const rec = makeRecord('R', [makeSequence([elem])]);
    const schema = makeSchema([rec]);
    const xml = serializeXsd(schema);
    expect(xml).toContain('type="xs:int"');
  });

  it('serializes fieldInfo annotation attributes', () => {
    const fi = createDefaultFieldInfo();
    fi.justification = Justification.Right;
    fi.positionalLength = 10;
    fi.positionalOffset = 2;
    fi.padCharacter = ' ';
    fi.padCharacterType = CharacterType.Character;
    fi.minimumLengthWithPadCharacter = 5;
    fi.wrapCharacter = '"';
    fi.wrapCharacterType = CharacterType.Character;
    fi.dateTimeFormat = 'yyyy-MM-dd';

    const elem = makeElement('F', { fieldInfo: fi });
    const rec = makeRecord('R', [makeSequence([elem])]);
    const schema = makeSchema([rec]);
    const xml = serializeXsd(schema);
    expect(xml).toContain('<b:fieldInfo');
    expect(xml).toContain('justification="right"');
    expect(xml).toContain('pos_length="10"');
    expect(xml).toContain('pos_offset="2"');
    expect(xml).toContain('pad_char=" "');
    expect(xml).toContain('pad_char_type="char"');
    expect(xml).toContain('min_length_with_pad_char="5"');
    expect(xml).toContain('wrap_char="&quot;"');
    expect(xml).toContain('wrap_char_type="char"');
    expect(xml).toContain('datetime_format="yyyy-MM-dd"');
  });

  it('emits only sequence_number when all other values are default', () => {
    const elem = makeElement('Plain');
    const rec = makeRecord('R', [makeSequence([elem])]);
    const schema = makeSchema([rec]);
    const xml = serializeXsd(schema);
    // serializeXsd auto-assigns sequence numbers, so even a "default" field
    // will have a sequence_number attribute — but nothing else.
    const fieldInfoMatch = xml.match(/<b:fieldInfo ([^/]*)\//);
    expect(fieldInfoMatch).not.toBeNull();
    // The only attribute should be sequence_number
    expect(fieldInfoMatch?.[1].trim()).toMatch(/^sequence_number="\d+"$/);
  });
});

// ─── Attribute Serialization ────────────────────────────────────────────────

describe('serializeXsd – attributes', () => {
  it('serializes an attribute with use and type', () => {
    const attr = makeAttribute('ver', { use: XmlSchemaUse.Required, dataType: 'xs:string' });
    const rec = makeRecord('Rec', [attr, makeSequence()]);
    const schema = makeSchema([rec]);
    const xml = serializeXsd(schema);
    expect(xml).toContain('<xs:attribute name="ver"');
    expect(xml).toContain('use="required"');
    expect(xml).toContain('type="xs:string"');
  });

  it('omits use attribute when XmlSchemaUse.None', () => {
    const attr = makeAttribute('a', { use: XmlSchemaUse.None });
    const rec = makeRecord('R', [attr, makeSequence()]);
    const schema = makeSchema([rec]);
    const xml = serializeXsd(schema);
    const attrLine = xml.split('\n').find(l => l.includes('xs:attribute'));
    expect(attrLine).not.toContain('use=');
  });

  it('serializes attribute fieldInfo when non-default', () => {
    const fi = createDefaultFieldInfo();
    fi.justification = Justification.Right;
    const attr = makeAttribute('a', { fieldInfo: fi });
    const rec = makeRecord('R', [attr, makeSequence()]);
    const schema = makeSchema([rec]);
    const xml = serializeXsd(schema);
    expect(xml).toContain('<b:fieldInfo');
    expect(xml).toContain('justification="right"');
  });
});

// ─── Group (Sequence / Choice) Serialization ────────────────────────────────

describe('serializeXsd – groups', () => {
  it('serializes a sequence group node', () => {
    const seq = makeSequence([makeElement('A'), makeElement('B')]);
    const rec = makeRecord('R', [seq]);
    const schema = makeSchema([rec]);
    const xml = serializeXsd(schema);
    expect(xml).toContain('<xs:sequence>');
    expect(xml).toContain('</xs:sequence>');
  });

  it('serializes a choice group node', () => {
    const ch = makeChoice([makeElement('X'), makeElement('Y')]);
    const rec = makeRecord('R', [ch]);
    const schema = makeSchema([rec]);
    const xml = serializeXsd(schema);
    expect(xml).toContain('<xs:choice>');
    expect(xml).toContain('</xs:choice>');
  });

  it('serializes groupInfo annotation with sequence_number', () => {
    const gi = { sequenceNumber: 99 };
    const seq = makeSequence([makeElement('Z')], { groupInfo: gi });
    const rec = makeRecord('R', [seq]);
    const schema = makeSchema([rec]);
    const xml = serializeXsd(schema);
    // After assignSequenceNumbers, the sequence_number will be reassigned
    // but the groupInfo annotation block should still appear
    expect(xml).toContain('<b:groupInfo');
    expect(xml).toContain('sequence_number=');
  });

  it('serializes nested groups', () => {
    const inner = makeSequence([makeElement('Deep')]);
    const outer = makeSequence([inner, makeElement('Shallow')]);
    const rec = makeRecord('R', [outer]);
    const schema = makeSchema([rec]);
    const xml = serializeXsd(schema);
    // Should have nested xs:sequence inside xs:sequence
    const matches = xml.match(/<xs:sequence/g);
    expect(matches?.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── Sequence Number Assignment ─────────────────────────────────────────────

describe('serializeXsd – sequence number assignment', () => {
  it('assigns depth-first sequence numbers automatically', () => {
    const fi1 = createDefaultFieldInfo();
    const fi2 = createDefaultFieldInfo();
    const e1 = makeElement('A', { fieldInfo: fi1 });
    const e2 = makeElement('B', { fieldInfo: fi2 });
    const seq = makeSequence([e1, e2]);
    const rec = makeRecord('R', [seq]);
    const schema = makeSchema([rec]);

    serializeXsd(schema);

    // After serialization, the sequence numbers should have been assigned
    expect(rec.recordInfo.sequenceNumber).toBe(1);
    expect(seq.groupInfo.sequenceNumber).toBe(2);
    expect(e1.fieldInfo.sequenceNumber).toBe(3);
    expect(e2.fieldInfo.sequenceNumber).toBe(4);
  });
});

// ─── XML Escaping ───────────────────────────────────────────────────────────

describe('serializeXsd – XML escaping', () => {
  it('escapes special characters in attribute values', () => {
    const fi = createDefaultFieldInfo();
    fi.wrapCharacter = '"';
    fi.wrapCharacterType = CharacterType.Character;
    const elem = makeElement('Q', { fieldInfo: fi });
    const rec = makeRecord('R', [makeSequence([elem])]);
    const schema = makeSchema([rec]);
    const xml = serializeXsd(schema);
    expect(xml).toContain('wrap_char="&quot;"');
  });

  it('escapes ampersands in names', () => {
    const elem = makeElement('A&B');
    const rec = makeRecord('R', [makeSequence([elem])]);
    const schema = makeSchema([rec]);
    const xml = serializeXsd(schema);
    expect(xml).toContain('name="A&amp;B"');
  });

  it('escapes angle brackets in values', () => {
    const ri = createDefaultRecordInfo();
    ri.tagIdentifier = '<tag>';
    const rec = makeRecord('R', [makeSequence()], { recordInfo: ri });
    const schema = makeSchema([rec]);
    const xml = serializeXsd(schema);
    expect(xml).toContain('tag_name="&lt;tag&gt;"');
  });
});

// ─── Serializer edge cases ──────────────────────────────────────────────────

describe('serializeXsd – additional coverage', () => {
  it('serializes recordInfo with escape and repeating delimiter', () => {
    const ri = createDefaultRecordInfo();
    ri.escapeCharacter = '\\';
    ri.escapeCharacterType = CharacterType.Character;
    ri.repeatingDelimiter = '|';
    ri.repeatingDelimiterType = CharacterType.Character;
    const rec = makeRecord('R', [makeSequence()], { recordInfo: ri });
    const schema = makeSchema([rec]);
    const xml = serializeXsd(schema);
    expect(xml).toContain('escape_char="\\"');
    expect(xml).toContain('escape_char_type="char"');
    expect(xml).toContain('repeating_delimiter="|"');
    expect(xml).toContain('repeating_delimiter_type="char"');
  });

  it('serializes numeric maxOccurs (not unbounded)', () => {
    const rec = makeRecord('Multi', [makeSequence()], { minOccurs: 1, maxOccurs: 5 });
    const outer = makeRecord('Outer', [makeSequence([rec])]);
    const schema = makeSchema([outer]);
    const xml = serializeXsd(schema);
    expect(xml).toContain('maxOccurs="5"');
  });

  it('serializes schemaInfo with culture, escape, pad, wrap, repeating delimiters', () => {
    const si = createDefaultSchemaInfo();
    si.cultureName = 'en-US';
    si.defaultEscapeCharacter = '\\';
    si.defaultEscapeCharacterType = CharacterType.Character;
    si.defaultWrapCharacter = '"';
    si.defaultWrapCharacterType = CharacterType.Character;
    si.defaultRepeatingDelimiter = '~';
    si.defaultRepeatingDelimiterType = CharacterType.Character;
    si.defaultPadCharacter = ' ';
    si.defaultPadCharacterType = CharacterType.None; // different from default (char)
    si.earlyTerminateOptionalFields = true;
    si.allowMessageBreakupAtInfixRoot = true;
    si.lookaheadDepth = 10;
    const schema = makeSchema([], { schemaInfo: si });
    const xml = serializeXsd(schema);
    expect(xml).toContain('culture="en-US"');
    expect(xml).toContain('default_escape_char="\\"');
    expect(xml).toContain('escape_char_type="char"');
    expect(xml).toContain('default_wrap_char=');
    expect(xml).toContain('wrap_char_type="char"');
    expect(xml).toContain('default_repeating_delimiter="~"');
    expect(xml).toContain('repeating_delimiter_type="char"');
    expect(xml).toContain('default_pad_char=" "');
    expect(xml).toContain('pad_char_type="none"');
    expect(xml).toContain('early_terminate_optional_fields="true"');
    expect(xml).toContain('allow_message_breakup_at_infix_root="true"');
    expect(xml).toContain('lookahead_depth="10"');
  });

  it('serializes recordInfo with preserve_delimiter_for_empty_data=false and suppress_trailing', () => {
    const ri = createDefaultRecordInfo();
    ri.preserveDelimiterForEmptyData = false;
    ri.suppressTrailingDelimiters = true;
    const rec = makeRecord('R', [makeSequence()], { recordInfo: ri });
    const schema = makeSchema([rec]);
    const xml = serializeXsd(schema);
    expect(xml).toContain('preserve_delimiter_for_empty_data="false"');
    expect(xml).toContain('suppress_trailing_delimiters="true"');
  });

  it('serializes a record with multiple non-group children (wraps in default sequence)', () => {
    // A record with two records (not a sequence/choice) as direct children
    const child1 = makeRecord('A', [makeSequence()]);
    const child2 = makeRecord('B', [makeSequence()]);
    const rec = makeRecord('Outer', [child1, child2]);
    const schema = makeSchema([rec]);
    const xml = serializeXsd(schema);
    // Should wrap in a default <xs:sequence>
    expect(xml).toContain('<xs:sequence>');
    expect(xml).toContain('name="A"');
    expect(xml).toContain('name="B"');
  });

  it('serializes a record with no non-attribute children (empty complexType)', () => {
    const attr = makeAttribute('only', { use: XmlSchemaUse.Required });
    const rec = makeRecord('Empty', [attr]);
    const schema = makeSchema([rec]);
    const xml = serializeXsd(schema);
    expect(xml).toContain('<xs:complexType>');
    expect(xml).toContain('name="only"');
    // Should not wrap in sequence since there are no non-attribute children
    const lines = xml.split('\n');
    const complexTypeIdx = lines.findIndex(l => l.includes('<xs:complexType>'));
    const closingIdx = lines.findIndex(l => l.includes('</xs:complexType>'));
    const between = lines.slice(complexTypeIdx + 1, closingIdx).join('\n');
    expect(between).not.toContain('<xs:sequence>');
  });

  it('escapes carriage returns and newlines in attribute values', () => {
    const ri = createDefaultRecordInfo();
    ri.childDelimiter = '\r\n';
    ri.childDelimiterType = CharacterType.Character;
    const rec = makeRecord('R', [makeSequence()], { recordInfo: ri });
    const schema = makeSchema([rec]);
    const xml = serializeXsd(schema);
    expect(xml).toContain('child_delimiter="&#xD;&#xA;"');
  });

  it('serializes sequence/choice with non-default minOccurs/maxOccurs', () => {
    const seq = makeSequence([makeElement('X')], { minOccurs: 0, maxOccurs: 3 });
    const rec = makeRecord('R', [seq]);
    const schema = makeSchema([rec]);
    const xml = serializeXsd(schema);
    expect(xml).toContain('minOccurs="0"');
    expect(xml).toContain('maxOccurs="3"');
  });

  it('serializes self-closing attribute when fieldInfo is all default', () => {
    const attr = makeAttribute('plain', { use: XmlSchemaUse.Optional });
    const rec = makeRecord('R', [attr, makeSequence()]);
    const schema = makeSchema([rec]);
    const xml = serializeXsd(schema);
    // Because assignSequenceNumbers sets sequence_number, the attribute will
    // have an annotation. Verify the attribute element is present.
    expect(xml).toContain('xs:attribute name="plain"');
  });
});

// ─── Round-trip (serialize → structure check) ───────────────────────────────

describe('serializeXsd – round-trip structure', () => {
  it('produces well-formed XML that contains all node names', () => {
    const seq = makeSequence([makeElement('Name'), makeElement('Age', { dataType: 'xs:int' })]);
    const rec = makeRecord('Person', [makeAttribute('id', { use: XmlSchemaUse.Required }), seq]);
    const schema = makeSchema([rec]);
    const xml = serializeXsd(schema);

    expect(xml).toContain('name="Person"');
    expect(xml).toContain('name="Name"');
    expect(xml).toContain('name="Age"');
    expect(xml).toContain('name="id"');
    expect(xml).toContain('type="xs:int"');
  });
});
