// ─── Enums ──────────────────────────────────────────────────────────────────
// Mirrors the C# enums from Extensions/ with their XML serialization names.

/** Node types in the flat-file schema tree. */
export enum FFNodeType {
  Choice = 'Choice',
  Field = 'Field',
  Record = 'Record',
  Sequence = 'Sequence',
}

/** Character encoding type for delimiter / pad / wrap / escape characters. */
export enum CharacterType {
  None = 'none',
  Character = 'char',
  Hexadecimal = 'hex',
  Default = 'default',
}

/** Relationship between delimiters and the things they delimit. */
export enum ChildOrder {
  ConditionalDefault = 'conditional',
  Prefix = 'prefix',
  Infix = 'infix',
  Postfix = 'postfix',
}

/** Record structure type. */
export enum StructureType {
  Delimited = 'delimited',
  Positional = 'positional',
}

/** Field content justification. */
export enum Justification {
  Left = 'left',
  Right = 'right',
}

/** Case conversion. */
export enum Case {
  Default = 'default',
  Lowercase = 'lower',
  Uppercase = 'upper',
}

/** Parser optimization strategy. */
export enum ParserOptimization {
  Speed = 'speed',
  Complexity = 'complexity',
}

/** XmlSchemaUse (subset relevant for FFAttribute). */
export enum XmlSchemaUse {
  None = 'none',
  Optional = 'optional',
  Prohibited = 'prohibited',
  Required = 'required',
}

// ─── Extension / Annotation Types ───────────────────────────────────────────
// These mirror the C# annotation classes attached to schema nodes via appinfo.

export interface CharacterRange {
  start: number;
  end: number;
}

/** Schema-level annotation: defaults and global settings. */
export interface SchemaInfo {
  allowEarlyTermination: boolean;
  allowMessageBreakupAtInfixRoot: boolean;
  case: Case;
  codePage: number;
  countPositionsInBytes: boolean;
  cultureName: string | null;
  defaultChildDelimiter: string;
  defaultChildDelimiterType: CharacterType;
  defaultChildOrder: ChildOrder;
  defaultEscapeCharacter: string;
  defaultEscapeCharacterType: CharacterType;
  defaultPadCharacter: string;
  defaultPadCharacterType: CharacterType;
  defaultRepeatingDelimiter: string;
  defaultRepeatingDelimiterType: CharacterType;
  defaultWrapCharacter: string;
  defaultWrapCharacterType: CharacterType;
  earlyTerminateOptionalFields: boolean;
  generateEmptyNodes: boolean;
  lookaheadDepth: number;
  parserOptimization: ParserOptimization;
  restrictedCharacters: CharacterRange[];
  suppressEmptyNodes: boolean;
  rootReference: string | null;
  standard: string;
}

/** Record-level annotation (complex-type elements). */
export interface RecordInfo {
  childDelimiter: string | null;
  childDelimiterType: CharacterType;
  childOrder: ChildOrder;
  escapeCharacter: string | null;
  escapeCharacterType: CharacterType;
  preserveDelimiterForEmptyData: boolean;
  repeatingDelimiter: string | null;
  repeatingDelimiterType: CharacterType;
  sequenceNumber: number;
  structure: StructureType;
  suppressTrailingDelimiters: boolean;
  tagIdentifier: string | null;
  tagOffset: number;
}

/** Field-level annotation (simple-type elements and attributes). */
export interface FieldInfo {
  dateTimeFormat: string;
  justification: Justification;
  minimumLengthWithPadCharacter: number;
  positionalLength: number;
  positionalOffset: number;
  padCharacter: string;
  padCharacterType: CharacterType;
  sequenceNumber: number;
  wrapCharacter: string;
  wrapCharacterType: CharacterType;
}

/** Group-level annotation (sequence / choice particles). */
export interface GroupInfo {
  sequenceNumber: number;
}

// ─── Schema Tree Nodes ──────────────────────────────────────────────────────
// A simplified, serializable tree structure for the editor.
// Unlike the C# version, we use a discriminated union with a `kind` tag.

interface FFNodeBase {
  /** Unique id for react-arborist and store lookups. */
  id: string;
  children: FFNode[];
}

export interface FFSchemaNode extends FFNodeBase {
  kind: 'schema';
  targetNamespace: string;
  elementFormDefault: string;
  schemaInfo: SchemaInfo;
}

export interface FFRecordNode extends FFNodeBase {
  kind: 'record';
  name: string;
  namespace: string;
  minOccurs: number;
  maxOccurs: number;
  recordInfo: RecordInfo;
}

export interface FFElementNode extends FFNodeBase {
  kind: 'element';
  name: string;
  namespace: string;
  dataType: string;
  minOccurs: number;
  maxOccurs: number;
  fieldInfo: FieldInfo;
}

export interface FFAttributeNode extends FFNodeBase {
  kind: 'attribute';
  name: string;
  namespace: string;
  dataType: string;
  use: XmlSchemaUse;
  fieldInfo: FieldInfo;
}

export interface FFSequenceNode extends FFNodeBase {
  kind: 'sequence';
  minOccurs: number;
  maxOccurs: number;
  groupInfo: GroupInfo;
}

export interface FFChoiceNode extends FFNodeBase {
  kind: 'choice';
  minOccurs: number;
  maxOccurs: number;
  groupInfo: GroupInfo;
}

/** Discriminated union of all node types. */
export type FFNode = FFSchemaNode | FFRecordNode | FFElementNode | FFAttributeNode | FFSequenceNode | FFChoiceNode;

/** Nodes that contribute output (have a name). */
export type FFNamedNode = FFRecordNode | FFElementNode | FFAttributeNode;

/** Nodes that carry occurrence info. */
export type FFOccurrenceNode = FFRecordNode | FFElementNode | FFSequenceNode | FFChoiceNode;

// ─── Defaults ───────────────────────────────────────────────────────────────

export function createDefaultSchemaInfo(): SchemaInfo {
  return {
    allowEarlyTermination: false,
    allowMessageBreakupAtInfixRoot: false,
    case: Case.Default,
    codePage: 65001, // UTF-8
    countPositionsInBytes: false,
    cultureName: null,
    defaultChildDelimiter: '',
    defaultChildDelimiterType: CharacterType.None,
    defaultChildOrder: ChildOrder.ConditionalDefault,
    defaultEscapeCharacter: '',
    defaultEscapeCharacterType: CharacterType.None,
    defaultPadCharacter: '',
    defaultPadCharacterType: CharacterType.Character,
    defaultRepeatingDelimiter: '',
    defaultRepeatingDelimiterType: CharacterType.None,
    defaultWrapCharacter: '',
    defaultWrapCharacterType: CharacterType.None,
    earlyTerminateOptionalFields: false,
    generateEmptyNodes: true,
    lookaheadDepth: 3,
    parserOptimization: ParserOptimization.Speed,
    restrictedCharacters: [],
    suppressEmptyNodes: false,
    rootReference: null,
    standard: 'Flat File',
  };
}

export function createDefaultRecordInfo(): RecordInfo {
  return {
    childDelimiter: null,
    childDelimiterType: CharacterType.None,
    childOrder: ChildOrder.ConditionalDefault,
    escapeCharacter: null,
    escapeCharacterType: CharacterType.None,
    preserveDelimiterForEmptyData: true,
    repeatingDelimiter: null,
    repeatingDelimiterType: CharacterType.None,
    sequenceNumber: 0,
    structure: StructureType.Delimited,
    suppressTrailingDelimiters: false,
    tagIdentifier: null,
    tagOffset: 0,
  };
}

export function createDefaultFieldInfo(): FieldInfo {
  return {
    dateTimeFormat: '',
    justification: Justification.Left,
    minimumLengthWithPadCharacter: 0,
    positionalLength: 0,
    positionalOffset: 0,
    padCharacter: '',
    padCharacterType: CharacterType.None,
    sequenceNumber: 0,
    wrapCharacter: '',
    wrapCharacterType: CharacterType.None,
  };
}

export function createDefaultGroupInfo(): GroupInfo {
  return { sequenceNumber: 0 };
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Sentinel value representing an unbounded maxOccurs. */
export const UNBOUNDED = Number.MAX_SAFE_INTEGER;

// ─── Node Creation ──────────────────────────────────────────────────────────

let _nextEditorId = 1;

/** Reset the editor id counter (useful for tests). */
export function resetEditorIds() {
  _nextEditorId = 1;
}

/** Generate a unique node id for editor-created nodes.
 *  Uses an 'e' prefix to avoid collisions with parser-generated 'n' ids. */
export function generateNodeId(): string {
  return `e${_nextEditorId++}`;
}

/** The insertable node kinds (not schema, not attribute). */
export type InsertableKind = 'record' | 'element' | 'sequence' | 'choice' | 'attribute';

/** Which child kinds each parent kind supports. */
export const VALID_CHILDREN: Record<FFNode['kind'], InsertableKind[]> = {
  schema: ['record'],
  record: ['record', 'element', 'sequence', 'choice'],
  sequence: ['record', 'element', 'sequence', 'choice'],
  choice: ['record', 'element', 'sequence', 'choice'],
  element: [],
  attribute: [],
};

/** Return the insertable kinds available for a given node, taking into account
 *  record constraints: a record may have at most one group (sequence/choice)
 *  and cannot have direct element children. */
export function getInsertableKinds(node: FFNode): InsertableKind[] {
  if (node.kind === 'record') {
    const hasGroup = node.children.some(c => c.kind === 'sequence' || c.kind === 'choice');
    // If the record already has a group, offer record/element (redirected to group) + attribute.
    // If not, offer sequence/choice so the user creates one first, + attribute.
    return hasGroup ? ['record', 'element', 'attribute'] : ['sequence', 'choice', 'attribute'];
  }
  return VALID_CHILDREN[node.kind];
}

/** Return the kinds available for "Insert After" (sibling insertion).
 *  - A group (sequence/choice) that is a direct child of a record cannot have
 *    siblings of its own kind because a record allows at most one group.
 *  - A record cannot have element siblings (fields are not valid siblings for records). */
export function getSiblingInsertableKinds(parent: FFNode, child: FFNode): InsertableKind[] {
  if (parent.kind === 'record' && (child.kind === 'sequence' || child.kind === 'choice')) {
    return [];
  }
  const kinds = getInsertableKinds(parent);
  if (child.kind === 'record') {
    return kinds.filter(k => k !== 'element');
  }
  return kinds;
}

/** Auto-generate a unique name like "Record1", "Field2", etc.
 *  Scans the existing tree to avoid collisions. */
export function generateNodeName(kind: InsertableKind, nodeMap: Map<string, FFNode>): string {
  const prefix =
    kind === 'element' ? 'Field' : kind === 'attribute' ? 'Attribute' : kind.charAt(0).toUpperCase() + kind.slice(1);
  const existing = new Set<string>();
  for (const n of nodeMap.values()) {
    if ('name' in n) {
      existing.add((n as FFRecordNode | FFElementNode).name);
    }
  }
  let i = 1;
  while (existing.has(`${prefix}${i}`)) {
    i++;
  }
  return `${prefix}${i}`;
}

/** Create a new node of the given kind with sensible defaults. */
export function createNewNode(kind: InsertableKind, nodeMap: Map<string, FFNode>): FFNode {
  const id = generateNodeId();
  switch (kind) {
    case 'record': {
      // New records automatically get an empty sequence group
      const seqId = generateNodeId();
      return {
        id,
        kind: 'record',
        name: generateNodeName('record', nodeMap),
        namespace: '',
        minOccurs: 1,
        maxOccurs: 1,
        recordInfo: createDefaultRecordInfo(),
        children: [
          {
            id: seqId,
            kind: 'sequence',
            minOccurs: 1,
            maxOccurs: 1,
            groupInfo: createDefaultGroupInfo(),
            children: [],
          },
        ],
      };
    }
    case 'element':
      return {
        id,
        kind: 'element',
        name: generateNodeName('element', nodeMap),
        namespace: '',
        dataType: 'xs:string',
        minOccurs: 1,
        maxOccurs: 1,
        fieldInfo: createDefaultFieldInfo(),
        children: [],
      };
    case 'attribute':
      return {
        id,
        kind: 'attribute',
        name: generateNodeName('attribute', nodeMap),
        namespace: '',
        dataType: 'xs:string',
        use: XmlSchemaUse.Required,
        fieldInfo: createDefaultFieldInfo(),
        children: [],
      };
    case 'sequence':
      return {
        id,
        kind: 'sequence',
        minOccurs: 1,
        maxOccurs: 1,
        groupInfo: createDefaultGroupInfo(),
        children: [],
      };
    case 'choice':
      return {
        id,
        kind: 'choice',
        minOccurs: 1,
        maxOccurs: 1,
        groupInfo: createDefaultGroupInfo(),
        children: [],
      };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Get a display label for a node. */
export function getNodeLabel(node: FFNode): string {
  switch (node.kind) {
    case 'schema':
      return node.targetNamespace || '(schema)';
    case 'record':
    case 'element':
    case 'attribute':
      return node.name;
    case 'sequence':
      return '(sequence)';
    case 'choice':
      return '(choice)';
  }
}

/** Flat lookup map built from a tree. */
export function buildNodeMap(root: FFNode): Map<string, FFNode> {
  const map = new Map<string, FFNode>();
  function walk(node: FFNode) {
    map.set(node.id, node);
    for (const child of node.children) {
      walk(child);
    }
  }
  walk(root);
  return map;
}

/** Walk the tree and return the parent node + index of the child with the given id. */
export function findParent(root: FFNode, childId: string): { parent: FFNode; index: number } | null {
  function walk(node: FFNode): { parent: FFNode; index: number } | null {
    for (let i = 0; i < node.children.length; i++) {
      if (node.children[i].id === childId) {
        return { parent: node, index: i };
      }
      const found = walk(node.children[i]);
      if (found) {
        return found;
      }
    }
    return null;
  }
  return walk(root);
}
