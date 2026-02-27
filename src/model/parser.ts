/**
 * XSD Parser — converts an XSD schema (with BizTalk flat-file annotations)
 * into the editor's FFNode tree using the browser DOMParser.
 *
 * This mirrors the C# FlatFileSchemaHelper logic:
 * 1. Parse the XSD XML.
 * 2. Walk xs:element / xs:complexType / xs:sequence / xs:choice / xs:attribute.
 * 3. For each annotated node, deserialize <b:schemaInfo>, <b:recordInfo>,
 *    <b:fieldInfo>, <b:groupInfo> from xs:appinfo.
 */

import {
  CharacterType,
  ChildOrder,
  Case,
  Justification,
  ParserOptimization,
  StructureType,
  XmlSchemaUse,
  type FFNode,
  type FFSchemaNode,
  type FFRecordNode,
  type FFElementNode,
  type FFAttributeNode,
  type FFSequenceNode,
  type FFChoiceNode,
  type SchemaInfo,
  type RecordInfo,
  type FieldInfo,
  type GroupInfo,
  createDefaultSchemaInfo,
  createDefaultRecordInfo,
  createDefaultFieldInfo,
  createDefaultGroupInfo,
} from './types';

const XS = 'http://www.w3.org/2001/XMLSchema';
const BTS = 'http://schemas.microsoft.com/BizTalk/2003';

let nextId = 1;
function uid(): string {
  return `n${nextId++}`;
}

/** Reset the id counter (useful between parses). */
export function resetIds() {
  nextId = 1;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Parse an XSD string into an FFSchemaNode tree. */
export function parseXsd(xsdText: string): FFSchemaNode {
  resetIds();
  const doc = new DOMParser().parseFromString(xsdText, 'application/xml');
  const schemaEl = doc.documentElement;

  if (schemaEl.localName !== 'schema' || schemaEl.namespaceURI !== XS) {
    throw new Error('Not a valid XSD schema');
  }

  const targetNamespace = schemaEl.getAttribute('targetNamespace') ?? '';
  const schemaInfo = parseSchemaInfo(schemaEl);

  // Find root element(s)
  const rootElements = childrenByTag(schemaEl, XS, 'element');

  // Determine which one is the root reference
  let rootEl = rootElements[0];
  if (schemaInfo.rootReference) {
    const found = rootElements.find(el => el.getAttribute('name') === schemaInfo.rootReference);
    if (found) {
      rootEl = found;
    }
  }

  const schemaNode: FFSchemaNode = {
    id: uid(),
    kind: 'schema',
    targetNamespace,
    schemaInfo,
    children: [],
  };

  if (rootEl) {
    const rootChild = parseElement(rootEl, schemaInfo);
    if (rootChild) {
      schemaNode.children.push(rootChild);
    }
  }

  return schemaNode;
}

// ─── Element Parsing ────────────────────────────────────────────────────────

function parseElement(el: Element, schemaInfo: SchemaInfo): FFNode | null {
  const name = el.getAttribute('name') ?? '';
  const ns = el.closest('schema')?.getAttribute('targetNamespace') ?? '';
  const minOccurs = intAttr(el, 'minOccurs', 1);
  const maxOccurs = maxOccursAttr(el);

  // Check if it has a complex type child → record
  const complexType = firstChildByTag(el, XS, 'complexType');
  if (complexType) {
    return parseRecord(el, complexType, name, ns, minOccurs, maxOccurs, schemaInfo);
  }

  // Check for type reference that resolves to a named complex type
  const typeName = el.getAttribute('type');
  if (typeName) {
    const schema = el.ownerDocument.documentElement;
    const namedType = findNamedComplexType(schema, typeName);
    if (namedType) {
      return parseRecord(el, namedType, name, ns, minOccurs, maxOccurs, schemaInfo);
    }
  }

  // Simple type → field element
  const fieldInfo = parseFieldInfo(el) ?? createDefaultFieldInfo();
  inheritFieldDefaults(fieldInfo, schemaInfo);
  const dataType = resolveSimpleType(el);

  const node: FFElementNode = {
    id: uid(),
    kind: 'element',
    name,
    namespace: ns,
    dataType,
    minOccurs,
    maxOccurs,
    fieldInfo,
    children: [],
  };

  return node;
}

function parseRecord(
  el: Element,
  complexType: Element,
  name: string,
  ns: string,
  minOccurs: number,
  maxOccurs: number,
  schemaInfo: SchemaInfo,
): FFRecordNode {
  const recordInfo = parseRecordInfo(el) ?? parseRecordInfo(complexType) ?? createDefaultRecordInfo();
  inheritRecordDefaults(recordInfo, schemaInfo);

  const node: FFRecordNode = {
    id: uid(),
    kind: 'record',
    name,
    namespace: ns,
    minOccurs,
    maxOccurs,
    recordInfo,
    children: [],
  };

  // Parse attributes from complexType
  for (const attrEl of childrenByTag(complexType, XS, 'attribute')) {
    const attrNode = parseAttribute(attrEl, schemaInfo);
    if (attrNode) {
      node.children.push(attrNode);
    }
  }

  // Parse sequence / choice — always wrap as a group node
  const seq = firstChildByTag(complexType, XS, 'sequence');
  if (seq) {
    const groupInfo = parseGroupInfo(seq) ?? createDefaultGroupInfo();
    const seqNode: FFSequenceNode = {
      id: uid(),
      kind: 'sequence',
      minOccurs: intAttr(seq, 'minOccurs', 1),
      maxOccurs: maxOccursAttr(seq),
      groupInfo,
      children: [],
    };
    parseSequenceChildren(seq, seqNode, schemaInfo);
    node.children.push(seqNode);
  }

  const choice = firstChildByTag(complexType, XS, 'choice');
  if (choice) {
    const groupInfo = parseGroupInfo(choice) ?? createDefaultGroupInfo();
    const choiceNode: FFChoiceNode = {
      id: uid(),
      kind: 'choice',
      minOccurs: intAttr(choice, 'minOccurs', 1),
      maxOccurs: maxOccursAttr(choice),
      groupInfo,
      children: [],
    };
    parseChoiceChildren(choice, choiceNode, schemaInfo);
    node.children.push(choiceNode);
  }

  return node;
}

function parseAttribute(el: Element, schemaInfo: SchemaInfo): FFAttributeNode | null {
  const name = el.getAttribute('name') ?? '';
  const ns = el.closest('schema')?.getAttribute('targetNamespace') ?? '';
  const useStr = el.getAttribute('use') ?? 'optional';
  const use =
    (
      {
        optional: XmlSchemaUse.Optional,
        required: XmlSchemaUse.Required,
        prohibited: XmlSchemaUse.Prohibited,
      } as Record<string, XmlSchemaUse>
    )[useStr] ?? XmlSchemaUse.None;

  const fieldInfo = parseFieldInfo(el) ?? createDefaultFieldInfo();
  inheritFieldDefaults(fieldInfo, schemaInfo);
  const dataType = resolveSimpleType(el);

  return {
    id: uid(),
    kind: 'attribute',
    name,
    namespace: ns,
    dataType,
    use,
    fieldInfo,
    children: [],
  };
}

function parseSequenceChildren(seqEl: Element, parent: FFRecordNode | FFSequenceNode, schemaInfo: SchemaInfo) {
  // If the sequence itself has groupInfo, wrap it as a sequence node
  // Otherwise, parse children directly into parent
  for (const child of xsChildren(seqEl)) {
    if (child.localName === 'element' && child.namespaceURI === XS) {
      const parsed = parseElement(child, schemaInfo);
      if (parsed) {
        parent.children.push(parsed);
      }
    } else if (child.localName === 'sequence' && child.namespaceURI === XS) {
      const groupInfo = parseGroupInfo(child) ?? createDefaultGroupInfo();
      const seqNode: FFSequenceNode = {
        id: uid(),
        kind: 'sequence',
        minOccurs: intAttr(child, 'minOccurs', 1),
        maxOccurs: maxOccursAttr(child),
        groupInfo,
        children: [],
      };
      parseSequenceChildren(child, seqNode, schemaInfo);
      parent.children.push(seqNode);
    } else if (child.localName === 'choice' && child.namespaceURI === XS) {
      const groupInfo = parseGroupInfo(child) ?? createDefaultGroupInfo();
      const choiceNode: FFChoiceNode = {
        id: uid(),
        kind: 'choice',
        minOccurs: intAttr(child, 'minOccurs', 1),
        maxOccurs: maxOccursAttr(child),
        groupInfo,
        children: [],
      };
      parseChoiceChildren(child, choiceNode, schemaInfo);
      parent.children.push(choiceNode);
    }
  }
}

function parseChoiceChildren(choiceEl: Element, parent: FFRecordNode | FFChoiceNode, schemaInfo: SchemaInfo) {
  for (const child of xsChildren(choiceEl)) {
    if (child.localName === 'element' && child.namespaceURI === XS) {
      const parsed = parseElement(child, schemaInfo);
      if (parsed) {
        parent.children.push(parsed);
      }
    } else if (child.localName === 'sequence' && child.namespaceURI === XS) {
      const groupInfo = parseGroupInfo(child) ?? createDefaultGroupInfo();
      const seqNode: FFSequenceNode = {
        id: uid(),
        kind: 'sequence',
        minOccurs: intAttr(child, 'minOccurs', 1),
        maxOccurs: maxOccursAttr(child),
        groupInfo,
        children: [],
      };
      parseSequenceChildren(child, seqNode, schemaInfo);
      parent.children.push(seqNode);
    } else if (child.localName === 'choice' && child.namespaceURI === XS) {
      const groupInfo = parseGroupInfo(child) ?? createDefaultGroupInfo();
      const choiceNode: FFChoiceNode = {
        id: uid(),
        kind: 'choice',
        minOccurs: intAttr(child, 'minOccurs', 1),
        maxOccurs: maxOccursAttr(child),
        groupInfo,
        children: [],
      };
      parseChoiceChildren(child, choiceNode, schemaInfo);
      parent.children.push(choiceNode);
    }
  }
}

// ─── Annotation Parsing ─────────────────────────────────────────────────────

function getAppInfoElement(el: Element, localName: string): Element | null {
  const annotation = firstChildByTag(el, XS, 'annotation');
  if (!annotation) {
    return null;
  }
  const appinfo = firstChildByTag(annotation, XS, 'appinfo');
  if (!appinfo) {
    return null;
  }
  for (const child of Array.from(appinfo.children)) {
    if (child.localName === localName && child.namespaceURI === BTS) {
      return child;
    }
  }
  return null;
}

function parseSchemaInfo(schemaEl: Element): SchemaInfo {
  const info = createDefaultSchemaInfo();
  const el = getAppInfoElement(schemaEl, 'schemaInfo');
  if (!el) {
    return info;
  }

  info.standard = strAttr(el, 'standard', info.standard);
  info.rootReference = strAttr(el, 'root_reference', info.rootReference ?? '') || null;
  info.allowEarlyTermination = boolAttr(el, 'allow_early_termination', info.allowEarlyTermination);
  info.allowMessageBreakupAtInfixRoot = boolAttr(
    el,
    'allow_message_breakup_at_infix_root',
    info.allowMessageBreakupAtInfixRoot,
  );
  info.case = enumAttr(el, 'case', Case, info.case);
  info.codePage = intAttr(el, 'codepage', info.codePage);
  info.countPositionsInBytes = boolAttr(el, 'count_positions_by_byte', info.countPositionsInBytes);
  info.cultureName = strAttr(el, 'culture', '') || null;
  info.defaultChildDelimiter = strAttr(el, 'default_child_delimiter', info.defaultChildDelimiter);
  info.defaultChildDelimiterType = enumAttr(el, 'child_delimiter_type', CharacterType, info.defaultChildDelimiterType);
  info.defaultChildOrder = enumAttr(el, 'default_child_order', ChildOrder, info.defaultChildOrder);
  info.defaultEscapeCharacter = strAttr(el, 'default_escape_char', info.defaultEscapeCharacter);
  info.defaultEscapeCharacterType = enumAttr(el, 'escape_char_type', CharacterType, info.defaultEscapeCharacterType);
  info.defaultPadCharacter = strAttr(el, 'default_pad_char', info.defaultPadCharacter);
  info.defaultPadCharacterType = enumAttr(el, 'pad_char_type', CharacterType, info.defaultPadCharacterType);
  info.defaultRepeatingDelimiter = strAttr(el, 'default_repeating_delimiter', info.defaultRepeatingDelimiter);
  info.defaultRepeatingDelimiterType = enumAttr(
    el,
    'repeating_delimiter_type',
    CharacterType,
    info.defaultRepeatingDelimiterType,
  );
  info.defaultWrapCharacter = strAttr(el, 'default_wrap_char', info.defaultWrapCharacter);
  info.defaultWrapCharacterType = enumAttr(el, 'wrap_char_type', CharacterType, info.defaultWrapCharacterType);
  info.earlyTerminateOptionalFields = boolAttr(
    el,
    'early_terminate_optional_fields',
    info.earlyTerminateOptionalFields,
  );
  info.generateEmptyNodes = boolAttr(el, 'generate_empty_nodes', info.generateEmptyNodes);
  info.lookaheadDepth = intAttr(el, 'lookahead_depth', info.lookaheadDepth);
  info.parserOptimization = enumAttr(el, 'parser_optimization', ParserOptimization, info.parserOptimization);
  info.suppressEmptyNodes = boolAttr(el, 'suppress_empty_nodes', info.suppressEmptyNodes);

  return info;
}

function parseRecordInfo(el: Element): RecordInfo | null {
  const infoEl = getAppInfoElement(el, 'recordInfo');
  if (!infoEl) {
    return null;
  }

  const info = createDefaultRecordInfo();
  info.structure = enumAttr(infoEl, 'structure', StructureType, info.structure);
  info.childDelimiter = strAttr(infoEl, 'child_delimiter', '') || null;
  info.childDelimiterType = enumAttr(infoEl, 'child_delimiter_type', CharacterType, info.childDelimiterType);
  info.childOrder = enumAttr(infoEl, 'child_order', ChildOrder, info.childOrder);
  info.escapeCharacter = strAttr(infoEl, 'escape_char', '') || null;
  info.escapeCharacterType = enumAttr(infoEl, 'escape_char_type', CharacterType, info.escapeCharacterType);
  info.preserveDelimiterForEmptyData = boolAttr(
    infoEl,
    'preserve_delimiter_for_empty_data',
    info.preserveDelimiterForEmptyData,
  );
  info.repeatingDelimiter = strAttr(infoEl, 'repeating_delimiter', '') || null;
  info.repeatingDelimiterType = enumAttr(
    infoEl,
    'repeating_delimiter_type',
    CharacterType,
    info.repeatingDelimiterType,
  );
  info.sequenceNumber = intAttr(infoEl, 'sequence_number', info.sequenceNumber);
  info.suppressTrailingDelimiters = boolAttr(infoEl, 'suppress_trailing_delimiters', info.suppressTrailingDelimiters);
  info.tagIdentifier = strAttr(infoEl, 'tag_name', '') || null;
  info.tagOffset = intAttr(infoEl, 'tag_offset', info.tagOffset);

  return info;
}

function parseFieldInfo(el: Element): FieldInfo | null {
  const infoEl = getAppInfoElement(el, 'fieldInfo');
  if (!infoEl) {
    return null;
  }

  const info = createDefaultFieldInfo();
  info.dateTimeFormat = strAttr(infoEl, 'datetime_format', info.dateTimeFormat);
  info.justification = enumAttr(infoEl, 'justification', Justification, info.justification);
  info.minimumLengthWithPadCharacter = intAttr(infoEl, 'min_length_with_pad_char', info.minimumLengthWithPadCharacter);
  info.positionalLength = intAttr(infoEl, 'pos_length', info.positionalLength);
  info.positionalOffset = intAttr(infoEl, 'pos_offset', info.positionalOffset);
  info.padCharacter = strAttr(infoEl, 'pad_char', info.padCharacter);
  info.padCharacterType = enumAttr(infoEl, 'pad_char_type', CharacterType, info.padCharacterType);
  info.sequenceNumber = intAttr(infoEl, 'sequence_number', info.sequenceNumber);
  info.wrapCharacter = strAttr(infoEl, 'wrap_char', info.wrapCharacter);
  info.wrapCharacterType = enumAttr(infoEl, 'wrap_char_type', CharacterType, info.wrapCharacterType);

  return info;
}

function parseGroupInfo(el: Element): GroupInfo | null {
  const infoEl = getAppInfoElement(el, 'groupInfo');
  if (!infoEl) {
    return null;
  }

  return {
    sequenceNumber: intAttr(infoEl, 'sequence_number', 0),
  };
}

// ─── Default Inheritance ────────────────────────────────────────────────────

function inheritRecordDefaults(info: RecordInfo, schema: SchemaInfo) {
  if (!info.childDelimiter && schema.defaultChildDelimiter) {
    info.childDelimiter = schema.defaultChildDelimiter;
    info.childDelimiterType = schema.defaultChildDelimiterType;
  }
  if (!info.escapeCharacter && schema.defaultEscapeCharacter) {
    info.escapeCharacter = schema.defaultEscapeCharacter;
    info.escapeCharacterType = schema.defaultEscapeCharacterType;
  }
  if (!info.repeatingDelimiter && schema.defaultRepeatingDelimiter) {
    info.repeatingDelimiter = schema.defaultRepeatingDelimiter;
    info.repeatingDelimiterType = schema.defaultRepeatingDelimiterType;
  }
  if (info.childOrder === ChildOrder.ConditionalDefault) {
    info.childOrder = schema.defaultChildOrder;
  }
}

function inheritFieldDefaults(info: FieldInfo, schema: SchemaInfo) {
  if (!info.padCharacter && schema.defaultPadCharacter) {
    info.padCharacter = schema.defaultPadCharacter;
    info.padCharacterType = schema.defaultPadCharacterType;
  }
  if (!info.wrapCharacter && schema.defaultWrapCharacter) {
    info.wrapCharacter = schema.defaultWrapCharacter;
    info.wrapCharacterType = schema.defaultWrapCharacterType;
  }
}

// ─── XML Helpers ────────────────────────────────────────────────────────────

function childrenByTag(parent: Element, ns: string, localName: string): Element[] {
  return Array.from(parent.children).filter(c => c.localName === localName && c.namespaceURI === ns);
}

function firstChildByTag(parent: Element, ns: string, localName: string): Element | null {
  return Array.from(parent.children).find(c => c.localName === localName && c.namespaceURI === ns) ?? null;
}

function xsChildren(parent: Element): Element[] {
  return Array.from(parent.children).filter(c => c.namespaceURI === XS);
}

function findNamedComplexType(schema: Element, typeName: string): Element | null {
  // Strip namespace prefix if present
  const local = typeName.includes(':') ? typeName.split(':')[1] : typeName;
  for (const ct of childrenByTag(schema, XS, 'complexType')) {
    if (ct.getAttribute('name') === local) {
      return ct;
    }
  }
  return null;
}

function strAttr(el: Element, name: string, fallback: string): string {
  return el.getAttribute(name) ?? fallback;
}

function intAttr(el: Element, name: string, fallback: number): number {
  const v = el.getAttribute(name);
  if (v == null) {
    return fallback;
  }
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

function boolAttr(el: Element, name: string, fallback: boolean): boolean {
  const v = el.getAttribute(name);
  if (v == null) {
    return fallback;
  }
  return v === 'true' || v === 'yes' || v === '1';
}

function enumAttr<T extends string>(el: Element, name: string, enumObj: Record<string, T>, fallback: T): T {
  const v = el.getAttribute(name);
  if (v == null) {
    return fallback;
  }
  const values = Object.values(enumObj) as string[];
  if (values.includes(v)) {
    return v as T;
  }
  return fallback;
}

function maxOccursAttr(el: Element): number {
  const v = el.getAttribute('maxOccurs');
  if (!v || v === 'unbounded') {
    return v === 'unbounded' ? Number.MAX_SAFE_INTEGER : 1;
  }
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? 1 : n;
}

function resolveSimpleType(el: Element): string {
  const type = el.getAttribute('type');
  if (type) {
    return type.includes(':') ? type.split(':')[1] : type;
  }
  return 'string';
}
