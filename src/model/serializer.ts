/**
 * XSD Serializer — converts an FFSchemaNode tree back into XSD XML text.
 *
 * Produces well-formed XSD with BizTalk flat-file annotations in xs:appinfo.
 */

import {
  CharacterType,
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
} from './types';

const XS_NS = 'http://www.w3.org/2001/XMLSchema';
const BTS_NS = 'http://schemas.microsoft.com/BizTalk/2003';

// ─── Sequence Number Assignment ─────────────────────────────────────────────

/** Assign continuous depth-first sequence numbers to all nodes that carry one. */
function assignSequenceNumbers(root: FFSchemaNode) {
  let counter = 1;

  function walk(node: FFNode) {
    // Assign to the appropriate info object
    switch (node.kind) {
      case 'record':
        node.recordInfo.sequenceNumber = counter++;
        break;
      case 'element':
      case 'attribute':
        node.fieldInfo.sequenceNumber = counter++;
        break;
      case 'sequence':
      case 'choice':
        node.groupInfo.sequenceNumber = counter++;
        break;
      case 'schema':
        // Schema node has no sequence number — just walk children
        break;
    }
    for (const child of node.children) {
      walk(child);
    }
  }

  walk(root);
}

/** Serialize an FFSchemaNode tree to XSD XML string. */
export function serializeXsd(schema: FFSchemaNode): string {
  // Auto-assign sequence numbers depth-first before serializing
  assignSequenceNumbers(schema);

  const lines: string[] = [];
  const indent = (depth: number) => '  '.repeat(depth);

  lines.push('<?xml version="1.0" encoding="utf-8" ?>');

  // Schema element
  const nsAttrs = [
    schema.targetNamespace ? `xmlns="${escapeAttr(schema.targetNamespace)}"` : '',
    `xmlns:b="${BTS_NS}"`,
    `xmlns:xs="${XS_NS}"`,
    schema.targetNamespace ? `targetNamespace="${escapeAttr(schema.targetNamespace)}"` : '',
    'elementFormDefault="qualified"',
  ]
    .filter(Boolean)
    .join('\n    ');

  lines.push(`<xs:schema ${nsAttrs}>`);

  // Schema-level annotation
  const schemaInfoAttrs = serializeSchemaInfoAttrs(schema.schemaInfo);
  if (schemaInfoAttrs) {
    lines.push(`${indent(1)}<xs:annotation>`);
    lines.push(`${indent(2)}<xs:appinfo>`);
    lines.push(`${indent(3)}<b:schemaInfo ${schemaInfoAttrs} />`);
    lines.push(`${indent(2)}</xs:appinfo>`);
    lines.push(`${indent(1)}</xs:annotation>`);
  }

  // Children (root elements)
  for (const child of schema.children) {
    serializeNode(child, lines, 1);
  }

  lines.push('</xs:schema>');
  lines.push(''); // trailing newline

  return lines.join('\n');
}

// ─── Node Serialization ─────────────────────────────────────────────────────

function serializeNode(node: FFNode, lines: string[], depth: number) {
  switch (node.kind) {
    case 'record':
      serializeRecord(node, lines, depth);
      break;
    case 'element':
      serializeElement(node, lines, depth);
      break;
    case 'attribute':
      serializeAttribute(node, lines, depth);
      break;
    case 'sequence':
      serializeSequence(node, lines, depth);
      break;
    case 'choice':
      serializeChoice(node, lines, depth);
      break;
    case 'schema':
      // nested schema shouldn't happen, but handle gracefully
      break;
  }
}

function serializeRecord(node: FFRecordNode, lines: string[], depth: number) {
  const ind = '  '.repeat(depth);
  const occAttrs = occurrenceAttrs(node.minOccurs, node.maxOccurs);
  lines.push(`${ind}<xs:element name="${escapeAttr(node.name)}"${occAttrs}>`);

  // Annotation
  const recordAttrs = serializeRecordInfoAttrs(node.recordInfo);
  if (recordAttrs) {
    lines.push(`${ind}  <xs:annotation>`);
    lines.push(`${ind}    <xs:appinfo>`);
    lines.push(`${ind}      <b:recordInfo ${recordAttrs} />`);
    lines.push(`${ind}    </xs:appinfo>`);
    lines.push(`${ind}  </xs:annotation>`);
  }

  lines.push(`${ind}  <xs:complexType>`);

  // Separate attributes from non-attributes
  const attributes = node.children.filter(c => c.kind === 'attribute');
  const others = node.children.filter(c => c.kind !== 'attribute');

  if (others.length > 0) {
    // If the only non-attribute child is a sequence or choice group node,
    // serialize it directly (it already produces <xs:sequence> / <xs:choice>).
    // Otherwise wrap in a default <xs:sequence>.
    const isGroupOnly = others.length === 1 && (others[0].kind === 'sequence' || others[0].kind === 'choice');
    if (isGroupOnly) {
      serializeNode(others[0], lines, depth + 2);
    } else {
      lines.push(`${ind}    <xs:sequence>`);
      for (const child of others) {
        serializeNode(child, lines, depth + 3);
      }
      lines.push(`${ind}    </xs:sequence>`);
    }
  }

  for (const attr of attributes) {
    serializeNode(attr, lines, depth + 2);
  }

  lines.push(`${ind}  </xs:complexType>`);
  lines.push(`${ind}</xs:element>`);
}

function serializeElement(node: FFElementNode, lines: string[], depth: number) {
  const ind = '  '.repeat(depth);
  const occAttrs = occurrenceAttrs(node.minOccurs, node.maxOccurs);
  const typeAttr = ` type="xs:${escapeAttr(node.dataType)}"`;
  const fieldAttrs = serializeFieldInfoAttrs(node.fieldInfo);

  if (fieldAttrs) {
    lines.push(`${ind}<xs:element name="${escapeAttr(node.name)}"${typeAttr}${occAttrs}>`);
    lines.push(`${ind}  <xs:annotation>`);
    lines.push(`${ind}    <xs:appinfo>`);
    lines.push(`${ind}      <b:fieldInfo ${fieldAttrs} />`);
    lines.push(`${ind}    </xs:appinfo>`);
    lines.push(`${ind}  </xs:annotation>`);
    lines.push(`${ind}</xs:element>`);
  } else {
    lines.push(`${ind}<xs:element name="${escapeAttr(node.name)}"${typeAttr}${occAttrs} />`);
  }
}

function serializeAttribute(node: FFAttributeNode, lines: string[], depth: number) {
  const ind = '  '.repeat(depth);
  const useAttr = node.use !== XmlSchemaUse.None ? ` use="${node.use}"` : '';
  const typeAttr = ` type="xs:${escapeAttr(node.dataType)}"`;
  const fieldAttrs = serializeFieldInfoAttrs(node.fieldInfo);

  if (fieldAttrs) {
    lines.push(`${ind}<xs:attribute name="${escapeAttr(node.name)}"${typeAttr}${useAttr}>`);
    lines.push(`${ind}  <xs:annotation>`);
    lines.push(`${ind}    <xs:appinfo>`);
    lines.push(`${ind}      <b:fieldInfo ${fieldAttrs} />`);
    lines.push(`${ind}    </xs:appinfo>`);
    lines.push(`${ind}  </xs:annotation>`);
    lines.push(`${ind}</xs:attribute>`);
  } else {
    lines.push(`${ind}<xs:attribute name="${escapeAttr(node.name)}"${typeAttr}${useAttr} />`);
  }
}

function serializeSequence(node: FFSequenceNode, lines: string[], depth: number) {
  const ind = '  '.repeat(depth);
  const occAttrs = occurrenceAttrs(node.minOccurs, node.maxOccurs);
  const groupAttrs = serializeGroupInfoAttrs(node.groupInfo);

  lines.push(`${ind}<xs:sequence${occAttrs}>`);

  if (groupAttrs) {
    lines.push(`${ind}  <xs:annotation>`);
    lines.push(`${ind}    <xs:appinfo>`);
    lines.push(`${ind}      <b:groupInfo ${groupAttrs} />`);
    lines.push(`${ind}    </xs:appinfo>`);
    lines.push(`${ind}  </xs:annotation>`);
  }

  for (const child of node.children) {
    serializeNode(child, lines, depth + 1);
  }
  lines.push(`${ind}</xs:sequence>`);
}

function serializeChoice(node: FFChoiceNode, lines: string[], depth: number) {
  const ind = '  '.repeat(depth);
  const occAttrs = occurrenceAttrs(node.minOccurs, node.maxOccurs);
  const groupAttrs = serializeGroupInfoAttrs(node.groupInfo);

  lines.push(`${ind}<xs:choice${occAttrs}>`);

  if (groupAttrs) {
    lines.push(`${ind}  <xs:annotation>`);
    lines.push(`${ind}    <xs:appinfo>`);
    lines.push(`${ind}      <b:groupInfo ${groupAttrs} />`);
    lines.push(`${ind}    </xs:appinfo>`);
    lines.push(`${ind}  </xs:annotation>`);
  }

  for (const child of node.children) {
    serializeNode(child, lines, depth + 1);
  }
  lines.push(`${ind}</xs:choice>`);
}

// ─── Annotation Attribute Serialization ─────────────────────────────────────

function serializeSchemaInfoAttrs(info: SchemaInfo): string {
  const defaults = createDefaultSchemaInfo();
  const attrs: string[] = [];

  attrs.push(attr('standard', info.standard));
  if (info.rootReference) {
    attrs.push(attr('root_reference', info.rootReference));
  }
  if (info.case !== defaults.case) {
    attrs.push(attr('case', info.case));
  }
  if (info.codePage !== defaults.codePage) {
    attrs.push(attr('codepage', info.codePage));
  }
  if (info.cultureName) {
    attrs.push(attr('culture', info.cultureName));
  }
  if (info.defaultChildDelimiter) {
    attrs.push(attr('default_child_delimiter', info.defaultChildDelimiter));
  }
  if (info.defaultChildDelimiterType !== CharacterType.None) {
    attrs.push(attr('child_delimiter_type', info.defaultChildDelimiterType));
  }
  if (info.defaultChildOrder !== defaults.defaultChildOrder) {
    attrs.push(attr('default_child_order', info.defaultChildOrder));
  }
  if (info.defaultEscapeCharacter) {
    attrs.push(attr('default_escape_char', info.defaultEscapeCharacter));
  }
  if (info.defaultEscapeCharacterType !== CharacterType.None) {
    attrs.push(attr('escape_char_type', info.defaultEscapeCharacterType));
  }
  if (info.defaultPadCharacter) {
    attrs.push(attr('default_pad_char', info.defaultPadCharacter));
  }
  if (info.defaultPadCharacterType !== defaults.defaultPadCharacterType) {
    attrs.push(attr('pad_char_type', info.defaultPadCharacterType));
  }
  if (info.defaultRepeatingDelimiter) {
    attrs.push(attr('default_repeating_delimiter', info.defaultRepeatingDelimiter));
  }
  if (info.defaultRepeatingDelimiterType !== CharacterType.None) {
    attrs.push(attr('repeating_delimiter_type', info.defaultRepeatingDelimiterType));
  }
  if (info.defaultWrapCharacter) {
    attrs.push(attr('default_wrap_char', info.defaultWrapCharacter));
  }
  if (info.defaultWrapCharacterType !== CharacterType.None) {
    attrs.push(attr('wrap_char_type', info.defaultWrapCharacterType));
  }
  if (info.parserOptimization !== defaults.parserOptimization) {
    attrs.push(attr('parser_optimization', info.parserOptimization));
  }
  if (info.lookaheadDepth !== defaults.lookaheadDepth) {
    attrs.push(attr('lookahead_depth', info.lookaheadDepth));
  }
  if (info.allowEarlyTermination) {
    attrs.push(attr('allow_early_termination', 'true'));
  }
  if (info.allowMessageBreakupAtInfixRoot) {
    attrs.push(attr('allow_message_breakup_at_infix_root', 'true'));
  }
  if (info.countPositionsInBytes) {
    attrs.push(attr('count_positions_by_byte', 'true'));
  }
  if (info.earlyTerminateOptionalFields) {
    attrs.push(attr('early_terminate_optional_fields', 'true'));
  }
  if (!info.generateEmptyNodes) {
    attrs.push(attr('generate_empty_nodes', 'false'));
  }
  if (info.suppressEmptyNodes) {
    attrs.push(attr('suppress_empty_nodes', 'true'));
  }

  return attrs.join(' ');
}

function serializeRecordInfoAttrs(info: RecordInfo): string {
  const defaults = createDefaultRecordInfo();
  const attrs: string[] = [];

  if (info.structure !== defaults.structure) {
    attrs.push(attr('structure', info.structure));
  } else {
    attrs.push(attr('structure', info.structure));
  }
  if (info.childDelimiter) {
    attrs.push(attr('child_delimiter', info.childDelimiter));
  }
  if (info.childDelimiterType !== CharacterType.None) {
    attrs.push(attr('child_delimiter_type', info.childDelimiterType));
  }
  if (info.childOrder !== defaults.childOrder) {
    attrs.push(attr('child_order', info.childOrder));
  }
  if (info.escapeCharacter) {
    attrs.push(attr('escape_char', info.escapeCharacter));
  }
  if (info.escapeCharacterType !== CharacterType.None) {
    attrs.push(attr('escape_char_type', info.escapeCharacterType));
  }
  if (info.repeatingDelimiter) {
    attrs.push(attr('repeating_delimiter', info.repeatingDelimiter));
  }
  if (info.repeatingDelimiterType !== CharacterType.None) {
    attrs.push(attr('repeating_delimiter_type', info.repeatingDelimiterType));
  }
  if (info.sequenceNumber !== 0) {
    attrs.push(attr('sequence_number', info.sequenceNumber));
  }
  if (!info.preserveDelimiterForEmptyData) {
    attrs.push(attr('preserve_delimiter_for_empty_data', 'false'));
  }
  if (info.suppressTrailingDelimiters) {
    attrs.push(attr('suppress_trailing_delimiters', 'true'));
  }
  if (info.tagIdentifier) {
    attrs.push(attr('tag_name', info.tagIdentifier));
  }
  if (info.tagIdentifier && info.tagOffset !== 0) {
    attrs.push(attr('tag_offset', info.tagOffset));
  }

  return attrs.join(' ');
}

function serializeFieldInfoAttrs(info: FieldInfo): string {
  const defaults = createDefaultFieldInfo();
  const attrs: string[] = [];

  if (info.sequenceNumber !== 0) {
    attrs.push(attr('sequence_number', info.sequenceNumber));
  }
  if (info.justification !== defaults.justification) {
    attrs.push(attr('justification', info.justification));
  }
  if (info.dateTimeFormat) {
    attrs.push(attr('datetime_format', info.dateTimeFormat));
  }
  if (info.positionalOffset !== 0) {
    attrs.push(attr('pos_offset', info.positionalOffset));
  }
  if (info.positionalLength !== 0) {
    attrs.push(attr('pos_length', info.positionalLength));
  }
  if (info.padCharacter) {
    attrs.push(attr('pad_char', info.padCharacter));
  }
  if (info.padCharacterType !== CharacterType.None) {
    attrs.push(attr('pad_char_type', info.padCharacterType));
  }
  if (info.minimumLengthWithPadCharacter !== 0) {
    attrs.push(attr('min_length_with_pad_char', info.minimumLengthWithPadCharacter));
  }
  if (info.wrapCharacter) {
    attrs.push(attr('wrap_char', info.wrapCharacter));
  }
  if (info.wrapCharacterType !== CharacterType.None) {
    attrs.push(attr('wrap_char_type', info.wrapCharacterType));
  }

  return attrs.join(' ');
}

function serializeGroupInfoAttrs(info: GroupInfo): string {
  const attrs: string[] = [];
  if (info.sequenceNumber !== 0) {
    attrs.push(attr('sequence_number', info.sequenceNumber));
  }
  return attrs.join(' ');
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function attr(name: string, value: string | number | boolean): string {
  return `${name}="${escapeAttr(String(value))}"`;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r/g, '&#xD;')
    .replace(/\n/g, '&#xA;');
}

function occurrenceAttrs(minOccurs: number, maxOccurs: number): string {
  let s = '';
  if (minOccurs !== 1) {
    s += ` minOccurs="${minOccurs}"`;
  }
  if (maxOccurs === Number.MAX_SAFE_INTEGER) {
    s += ' maxOccurs="unbounded"';
  } else if (maxOccurs !== 1) {
    s += ` maxOccurs="${maxOccurs}"`;
  }
  return s;
}

/** Trigger a browser download of text content. */
export function downloadAsFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
