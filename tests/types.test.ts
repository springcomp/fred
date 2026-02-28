import { describe, expect, it } from 'vitest';
import {
  buildNodeMap,
  Case,
  CharacterType,
  ChildOrder,
  createDefaultFieldInfo,
  createDefaultGroupInfo,
  createDefaultRecordInfo,
  createDefaultSchemaInfo,
  createNewNode,
  type FFAttributeNode,
  type FFChoiceNode,
  type FFElementNode,
  type FFNode,
  type FFRecordNode,
  type FFSchemaNode,
  type FFSequenceNode,
  generateNodeName,
  getInsertableKinds,
  getNodeLabel,
  getSiblingInsertableKinds,
  Justification,
  ParserOptimization,
  StructureType,
  XmlSchemaUse,
} from '@/model/types';

// ─── Default Factories ──────────────────────────────────────────────────────

describe('createDefaultSchemaInfo', () => {
  it('returns correct defaults', () => {
    const si = createDefaultSchemaInfo();
    expect(si.allowEarlyTermination).toBe(false);
    expect(si.case).toBe(Case.Default);
    expect(si.codePage).toBe(65001);
    expect(si.cultureName).toBeNull();
    expect(si.defaultChildDelimiter).toBe('');
    expect(si.defaultChildDelimiterType).toBe(CharacterType.None);
    expect(si.defaultChildOrder).toBe(ChildOrder.ConditionalDefault);
    expect(si.defaultPadCharacterType).toBe(CharacterType.Character);
    expect(si.generateEmptyNodes).toBe(true);
    expect(si.lookaheadDepth).toBe(3);
    expect(si.parserOptimization).toBe(ParserOptimization.Speed);
    expect(si.rootReference).toBeNull();
    expect(si.standard).toBe('Flat File');
    expect(si.restrictedCharacters).toEqual([]);
  });
});

describe('createDefaultRecordInfo', () => {
  it('returns correct defaults', () => {
    const ri = createDefaultRecordInfo();
    expect(ri.childDelimiter).toBeNull();
    expect(ri.childOrder).toBe(ChildOrder.ConditionalDefault);
    expect(ri.structure).toBe(StructureType.Delimited);
    expect(ri.preserveDelimiterForEmptyData).toBe(true);
    expect(ri.suppressTrailingDelimiters).toBe(false);
    expect(ri.tagIdentifier).toBeNull();
    expect(ri.tagOffset).toBe(0);
    expect(ri.sequenceNumber).toBe(0);
  });
});

describe('createDefaultFieldInfo', () => {
  it('returns correct defaults', () => {
    const fi = createDefaultFieldInfo();
    expect(fi.justification).toBe(Justification.Left);
    expect(fi.positionalLength).toBe(0);
    expect(fi.positionalOffset).toBe(0);
    expect(fi.padCharacter).toBe('');
    expect(fi.padCharacterType).toBe(CharacterType.None);
    expect(fi.wrapCharacter).toBe('');
    expect(fi.dateTimeFormat).toBe('');
    expect(fi.sequenceNumber).toBe(0);
  });
});

describe('createDefaultGroupInfo', () => {
  it('returns correct defaults', () => {
    const gi = createDefaultGroupInfo();
    expect(gi.sequenceNumber).toBe(0);
  });
});

// ─── buildNodeMap ───────────────────────────────────────────────────────────

describe('buildNodeMap', () => {
  it('flattens a tree into a map keyed by id', () => {
    const child: FFElementNode = {
      id: 'c1',
      kind: 'element',
      name: 'F',
      namespace: '',
      dataType: 'xs:string',
      minOccurs: 1,
      maxOccurs: 1,
      fieldInfo: createDefaultFieldInfo(),
      children: [],
    };
    const seq: FFSequenceNode = {
      id: 'seq',
      kind: 'sequence',
      minOccurs: 1,
      maxOccurs: 1,
      groupInfo: createDefaultGroupInfo(),
      children: [child],
    };
    const rec: FFRecordNode = {
      id: 'r1',
      kind: 'record',
      name: 'Rec',
      namespace: '',
      minOccurs: 1,
      maxOccurs: 1,
      recordInfo: createDefaultRecordInfo(),
      children: [seq],
    };
    const schema: FFSchemaNode = {
      id: 's1',
      kind: 'schema',
      targetNamespace: '',
      elementFormDefault: 'qualified',
      schemaInfo: createDefaultSchemaInfo(),
      children: [rec],
    };

    const map = buildNodeMap(schema);
    expect(map.size).toBe(4);
    expect(map.get('s1')).toBe(schema);
    expect(map.get('r1')).toBe(rec);
    expect(map.get('seq')).toBe(seq);
    expect(map.get('c1')).toBe(child);
  });
});

// ─── getNodeLabel ───────────────────────────────────────────────────────────

describe('getNodeLabel', () => {
  it('returns targetNamespace for schema nodes', () => {
    const schema: FFSchemaNode = {
      id: 's',
      kind: 'schema',
      targetNamespace: 'http://ns',
      elementFormDefault: 'qualified',
      schemaInfo: createDefaultSchemaInfo(),
      children: [],
    };
    expect(getNodeLabel(schema)).toBe('http://ns');
  });

  it('returns "(schema)" when targetNamespace is empty', () => {
    const schema: FFSchemaNode = {
      id: 's',
      kind: 'schema',
      targetNamespace: '',
      elementFormDefault: 'qualified',
      schemaInfo: createDefaultSchemaInfo(),
      children: [],
    };
    expect(getNodeLabel(schema)).toBe('(schema)');
  });

  it('returns name for record, element, attribute', () => {
    const rec: FFRecordNode = {
      id: 'r',
      kind: 'record',
      name: 'MyRec',
      namespace: '',
      minOccurs: 1,
      maxOccurs: 1,
      recordInfo: createDefaultRecordInfo(),
      children: [],
    };
    expect(getNodeLabel(rec)).toBe('MyRec');

    const elem: FFElementNode = {
      id: 'e',
      kind: 'element',
      name: 'MyField',
      namespace: '',
      dataType: 'xs:string',
      minOccurs: 1,
      maxOccurs: 1,
      fieldInfo: createDefaultFieldInfo(),
      children: [],
    };
    expect(getNodeLabel(elem)).toBe('MyField');

    const attr: FFAttributeNode = {
      id: 'a',
      kind: 'attribute',
      name: 'MyAttr',
      namespace: '',
      dataType: 'xs:string',
      use: XmlSchemaUse.Optional,
      fieldInfo: createDefaultFieldInfo(),
      children: [],
    };
    expect(getNodeLabel(attr)).toBe('MyAttr');
  });

  it('returns "(sequence)" and "(choice)" for group nodes', () => {
    const seq: FFSequenceNode = {
      id: 'sq',
      kind: 'sequence',
      minOccurs: 1,
      maxOccurs: 1,
      groupInfo: createDefaultGroupInfo(),
      children: [],
    };
    expect(getNodeLabel(seq)).toBe('(sequence)');

    const ch: FFChoiceNode = {
      id: 'ch',
      kind: 'choice',
      minOccurs: 1,
      maxOccurs: 1,
      groupInfo: createDefaultGroupInfo(),
      children: [],
    };
    expect(getNodeLabel(ch)).toBe('(choice)');
  });
});

// ─── getInsertableKinds ─────────────────────────────────────────────────────

describe('getInsertableKinds', () => {
  it('returns ["record"] for schema nodes', () => {
    const schema: FFSchemaNode = {
      id: 's',
      kind: 'schema',
      targetNamespace: '',
      elementFormDefault: '',
      schemaInfo: createDefaultSchemaInfo(),
      children: [],
    };
    expect(getInsertableKinds(schema)).toEqual(['record']);
  });

  it('returns group + attribute types for records without a group', () => {
    const rec: FFRecordNode = {
      id: 'r',
      kind: 'record',
      name: 'R',
      namespace: '',
      minOccurs: 1,
      maxOccurs: 1,
      recordInfo: createDefaultRecordInfo(),
      children: [],
    };
    expect(getInsertableKinds(rec)).toEqual(['sequence', 'choice', 'attribute']);
  });

  it('returns record/element/attribute for records with a group', () => {
    const seq: FFSequenceNode = {
      id: 'sq',
      kind: 'sequence',
      minOccurs: 1,
      maxOccurs: 1,
      groupInfo: createDefaultGroupInfo(),
      children: [],
    };
    const rec: FFRecordNode = {
      id: 'r',
      kind: 'record',
      name: 'R',
      namespace: '',
      minOccurs: 1,
      maxOccurs: 1,
      recordInfo: createDefaultRecordInfo(),
      children: [seq],
    };
    expect(getInsertableKinds(rec)).toEqual(['record', 'element', 'attribute']);
  });

  it('returns empty array for elements and attributes', () => {
    const elem: FFElementNode = {
      id: 'e',
      kind: 'element',
      name: 'F',
      namespace: '',
      dataType: 'xs:string',
      minOccurs: 1,
      maxOccurs: 1,
      fieldInfo: createDefaultFieldInfo(),
      children: [],
    };
    expect(getInsertableKinds(elem)).toEqual([]);

    const attr: FFAttributeNode = {
      id: 'a',
      kind: 'attribute',
      name: 'A',
      namespace: '',
      dataType: 'xs:string',
      use: XmlSchemaUse.Optional,
      fieldInfo: createDefaultFieldInfo(),
      children: [],
    };
    expect(getInsertableKinds(attr)).toEqual([]);
  });

  it('returns all group-child kinds for sequence/choice', () => {
    const seq: FFSequenceNode = {
      id: 'sq',
      kind: 'sequence',
      minOccurs: 1,
      maxOccurs: 1,
      groupInfo: createDefaultGroupInfo(),
      children: [],
    };
    expect(getInsertableKinds(seq)).toEqual(['record', 'element', 'sequence', 'choice']);
  });
});

// ─── getSiblingInsertableKinds ──────────────────────────────────────────────

describe('getSiblingInsertableKinds', () => {
  it('returns empty for a group child of a record', () => {
    const seq: FFSequenceNode = {
      id: 'sq',
      kind: 'sequence',
      minOccurs: 1,
      maxOccurs: 1,
      groupInfo: createDefaultGroupInfo(),
      children: [],
    };
    const rec: FFRecordNode = {
      id: 'r',
      kind: 'record',
      name: 'R',
      namespace: '',
      minOccurs: 1,
      maxOccurs: 1,
      recordInfo: createDefaultRecordInfo(),
      children: [seq],
    };
    expect(getSiblingInsertableKinds(rec, seq)).toEqual([]);
  });

  it('filters out element when child is a record', () => {
    const innerRec: FFRecordNode = {
      id: 'ir',
      kind: 'record',
      name: 'Inner',
      namespace: '',
      minOccurs: 1,
      maxOccurs: 1,
      recordInfo: createDefaultRecordInfo(),
      children: [],
    };
    const seq: FFSequenceNode = {
      id: 'sq',
      kind: 'sequence',
      minOccurs: 1,
      maxOccurs: 1,
      groupInfo: createDefaultGroupInfo(),
      children: [innerRec],
    };
    const kinds = getSiblingInsertableKinds(seq, innerRec);
    expect(kinds).not.toContain('element');
    expect(kinds).toContain('record');
  });

  it('returns parent insertable kinds when child is an element (non-record, non-group)', () => {
    const elem: FFElementNode = {
      id: 'e',
      kind: 'element',
      name: 'F',
      namespace: '',
      dataType: 'xs:string',
      minOccurs: 1,
      maxOccurs: 1,
      fieldInfo: createDefaultFieldInfo(),
      children: [],
    };
    const seq: FFSequenceNode = {
      id: 'sq',
      kind: 'sequence',
      minOccurs: 1,
      maxOccurs: 1,
      groupInfo: createDefaultGroupInfo(),
      children: [elem],
    };
    const kinds = getSiblingInsertableKinds(seq, elem);
    // Should return the full set of insertable kinds for a sequence
    expect(kinds).toEqual(['record', 'element', 'sequence', 'choice']);
  });

  it('returns empty for a choice child of a record', () => {
    const ch: FFChoiceNode = {
      id: 'ch',
      kind: 'choice',
      minOccurs: 1,
      maxOccurs: 1,
      groupInfo: createDefaultGroupInfo(),
      children: [],
    };
    const rec: FFRecordNode = {
      id: 'r',
      kind: 'record',
      name: 'R',
      namespace: '',
      minOccurs: 1,
      maxOccurs: 1,
      recordInfo: createDefaultRecordInfo(),
      children: [ch],
    };
    expect(getSiblingInsertableKinds(rec, ch)).toEqual([]);
  });
});

// ─── generateNodeName ───────────────────────────────────────────────────────

describe('generateNodeName', () => {
  it('generates unique names avoiding collisions', () => {
    const existing: FFElementNode = {
      id: 'e',
      kind: 'element',
      name: 'Field1',
      namespace: '',
      dataType: 'xs:string',
      minOccurs: 1,
      maxOccurs: 1,
      fieldInfo: createDefaultFieldInfo(),
      children: [],
    };
    const schema: FFSchemaNode = {
      id: 's',
      kind: 'schema',
      targetNamespace: '',
      elementFormDefault: '',
      schemaInfo: createDefaultSchemaInfo(),
      children: [existing],
    };
    const map = buildNodeMap(schema);
    expect(generateNodeName('element', map)).toBe('Field2');
  });

  it('uses correct prefix for each kind', () => {
    const emptyMap = new Map<string, FFNode>();
    expect(generateNodeName('record', emptyMap)).toBe('Record1');
    expect(generateNodeName('element', emptyMap)).toBe('Field1');
    expect(generateNodeName('attribute', emptyMap)).toBe('Attribute1');
    expect(generateNodeName('sequence', emptyMap)).toBe('Sequence1');
    expect(generateNodeName('choice', emptyMap)).toBe('Choice1');
  });
});

// ─── createNewNode ──────────────────────────────────────────────────────────

describe('createNewNode', () => {
  const emptyMap = new Map<string, FFNode>();

  it('creates a record with a default sequence child', () => {
    const node = createNewNode('record', emptyMap);
    expect(node.kind).toBe('record');
    expect((node as FFRecordNode).name).toBe('Record1');
    expect(node.children).toHaveLength(1);
    expect(node.children[0].kind).toBe('sequence');
  });

  it('creates an element with defaults', () => {
    const node = createNewNode('element', emptyMap);
    expect(node.kind).toBe('element');
    expect((node as FFElementNode).dataType).toBe('xs:string');
  });

  it('creates an attribute with required use', () => {
    const node = createNewNode('attribute', emptyMap);
    expect(node.kind).toBe('attribute');
    expect((node as FFAttributeNode).use).toBe(XmlSchemaUse.Required);
  });

  it('creates a sequence with empty children', () => {
    const node = createNewNode('sequence', emptyMap);
    expect(node.kind).toBe('sequence');
    expect(node.children).toHaveLength(0);
  });

  it('creates a choice with empty children', () => {
    const node = createNewNode('choice', emptyMap);
    expect(node.kind).toBe('choice');
    expect(node.children).toHaveLength(0);
  });
});
