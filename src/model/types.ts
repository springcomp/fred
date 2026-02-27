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
