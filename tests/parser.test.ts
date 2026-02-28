import { beforeEach, describe, expect, it } from 'vitest';
import { parseXsd, resetIds } from '@/model/parser';
import {
  Case,
  CharacterType,
  ChildOrder,
  type FFAttributeNode,
  type FFChoiceNode,
  type FFElementNode,
  type FFRecordNode,
  type FFSequenceNode,
  Justification,
  ParserOptimization,
  StructureType,
  XmlSchemaUse,
} from '@/model/types';

beforeEach(() => {
  resetIds();
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Minimal valid XSD wrapper with BizTalk namespace. */
function wrapXsd(body: string, schemaAttrs = ''): string {
  return `<?xml version="1.0" encoding="utf-8" ?>
<xs:schema xmlns="http://example.com/ns"
  xmlns:b="http://schemas.microsoft.com/BizTalk/2003"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  targetNamespace="http://example.com/ns"
  elementFormDefault="qualified"
  ${schemaAttrs}>
  ${body}
</xs:schema>`;
}

// ─── Basic Schema Parsing ───────────────────────────────────────────────────

describe('parseXsd – schema node', () => {
  it('parses a minimal valid schema', () => {
    const xsd = wrapXsd(`
      <xs:element name="Root">
        <xs:complexType>
          <xs:sequence />
        </xs:complexType>
      </xs:element>
    `);
    const schema = parseXsd(xsd);
    expect(schema.kind).toBe('schema');
    expect(schema.targetNamespace).toBe('http://example.com/ns');
    expect(schema.elementFormDefault).toBe('qualified');
    expect(schema.children).toHaveLength(1);
  });

  it('throws on non-XSD input', () => {
    expect(() => parseXsd('<html></html>')).toThrow('Not a valid XSD schema');
  });

  it('returns default schemaInfo when no annotation is present', () => {
    const xsd = wrapXsd(`
      <xs:element name="Root">
        <xs:complexType><xs:sequence /></xs:complexType>
      </xs:element>
    `);
    const schema = parseXsd(xsd);
    expect(schema.schemaInfo.standard).toBe('Flat File');
    expect(schema.schemaInfo.codePage).toBe(65001);
    expect(schema.schemaInfo.parserOptimization).toBe(ParserOptimization.Speed);
    expect(schema.schemaInfo.generateEmptyNodes).toBe(true);
    expect(schema.schemaInfo.suppressEmptyNodes).toBe(false);
    expect(schema.schemaInfo.rootReference).toBeNull();
  });
});

// ─── SchemaInfo Annotation Parsing ──────────────────────────────────────────

describe('parseXsd – schemaInfo annotation', () => {
  it('parses all schemaInfo attributes', () => {
    const xsd = wrapXsd(`
      <xs:annotation><xs:appinfo>
        <b:schemaInfo
          standard="Flat File"
          root_reference="Root"
          default_child_delimiter=","
          child_delimiter_type="char"
          default_child_order="infix"
          codepage="1252"
          parser_optimization="complexity"
          lookahead_depth="5"
          allow_early_termination="true"
          allow_message_breakup_at_infix_root="true"
          count_positions_by_byte="true"
          early_terminate_optional_fields="true"
          generate_empty_nodes="false"
          suppress_empty_nodes="true"
          case="upper"
          default_escape_char="\\"
          escape_char_type="char"
          default_pad_char=" "
          pad_char_type="char"
          default_wrap_char="&quot;"
          wrap_char_type="char"
          default_repeating_delimiter="|"
          repeating_delimiter_type="char"
        />
      </xs:appinfo></xs:annotation>
      <xs:element name="Root">
        <xs:complexType><xs:sequence /></xs:complexType>
      </xs:element>
    `);

    const si = parseXsd(xsd).schemaInfo;
    expect(si.standard).toBe('Flat File');
    expect(si.rootReference).toBe('Root');
    expect(si.defaultChildDelimiter).toBe(',');
    expect(si.defaultChildDelimiterType).toBe(CharacterType.Character);
    expect(si.defaultChildOrder).toBe(ChildOrder.Infix);
    expect(si.codePage).toBe(1252);
    expect(si.parserOptimization).toBe(ParserOptimization.Complexity);
    expect(si.lookaheadDepth).toBe(5);
    expect(si.allowEarlyTermination).toBe(true);
    expect(si.allowMessageBreakupAtInfixRoot).toBe(true);
    expect(si.countPositionsInBytes).toBe(true);
    expect(si.earlyTerminateOptionalFields).toBe(true);
    expect(si.generateEmptyNodes).toBe(false);
    expect(si.suppressEmptyNodes).toBe(true);
    expect(si.case).toBe(Case.Uppercase);
    expect(si.defaultEscapeCharacter).toBe('\\');
    expect(si.defaultEscapeCharacterType).toBe(CharacterType.Character);
    expect(si.defaultPadCharacter).toBe(' ');
    expect(si.defaultPadCharacterType).toBe(CharacterType.Character);
    expect(si.defaultWrapCharacter).toBe('"');
    expect(si.defaultWrapCharacterType).toBe(CharacterType.Character);
    expect(si.defaultRepeatingDelimiter).toBe('|');
    expect(si.defaultRepeatingDelimiterType).toBe(CharacterType.Character);
  });

  it('uses root_reference to select the root element', () => {
    const xsd = wrapXsd(`
      <xs:annotation><xs:appinfo>
        <b:schemaInfo standard="Flat File" root_reference="Second" />
      </xs:appinfo></xs:annotation>
      <xs:element name="First">
        <xs:complexType><xs:sequence /></xs:complexType>
      </xs:element>
      <xs:element name="Second">
        <xs:complexType><xs:sequence /></xs:complexType>
      </xs:element>
    `);
    const schema = parseXsd(xsd);
    expect(schema.children).toHaveLength(1);
    const root = schema.children[0] as FFRecordNode;
    expect(root.name).toBe('Second');
  });
});

// ─── Record Parsing ─────────────────────────────────────────────────────────

describe('parseXsd – records', () => {
  it('parses a record with recordInfo annotation', () => {
    const xsd = wrapXsd(`
      <xs:element name="Rec">
        <xs:annotation><xs:appinfo>
          <b:recordInfo
            structure="delimited"
            child_delimiter=","
            child_delimiter_type="char"
            child_order="infix"
            preserve_delimiter_for_empty_data="false"
            suppress_trailing_delimiters="true"
            tag_name="TAG"
            tag_offset="3"
            escape_char="\\"
            escape_char_type="char"
          />
        </xs:appinfo></xs:annotation>
        <xs:complexType><xs:sequence /></xs:complexType>
      </xs:element>
    `);
    const schema = parseXsd(xsd);
    const rec = schema.children[0] as FFRecordNode;
    expect(rec.kind).toBe('record');
    expect(rec.name).toBe('Rec');
    expect(rec.recordInfo.structure).toBe(StructureType.Delimited);
    expect(rec.recordInfo.childDelimiter).toBe(',');
    expect(rec.recordInfo.childDelimiterType).toBe(CharacterType.Character);
    expect(rec.recordInfo.childOrder).toBe(ChildOrder.Infix);
    expect(rec.recordInfo.preserveDelimiterForEmptyData).toBe(false);
    expect(rec.recordInfo.suppressTrailingDelimiters).toBe(true);
    expect(rec.recordInfo.tagIdentifier).toBe('TAG');
    expect(rec.recordInfo.tagOffset).toBe(3);
    expect(rec.recordInfo.escapeCharacter).toBe('\\');
    expect(rec.recordInfo.escapeCharacterType).toBe(CharacterType.Character);
  });

  it('parses minOccurs and maxOccurs on records', () => {
    const xsd = wrapXsd(`
      <xs:element name="Outer">
        <xs:complexType><xs:sequence>
          <xs:element name="Inner" minOccurs="0" maxOccurs="unbounded">
            <xs:complexType><xs:sequence /></xs:complexType>
          </xs:element>
        </xs:sequence></xs:complexType>
      </xs:element>
    `);
    const schema = parseXsd(xsd);
    const outer = schema.children[0] as FFRecordNode;
    const seq = outer.children.find(c => c.kind === 'sequence') as FFSequenceNode;
    const inner = seq.children[0] as FFRecordNode;
    expect(inner.minOccurs).toBe(0);
    expect(inner.maxOccurs).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('inherits schema-level record defaults', () => {
    const xsd = wrapXsd(`
      <xs:annotation><xs:appinfo>
        <b:schemaInfo standard="Flat File" default_child_delimiter="|" child_delimiter_type="char" default_child_order="prefix"
          default_escape_char="~" escape_char_type="char"
          default_repeating_delimiter="#" repeating_delimiter_type="char"
        />
      </xs:appinfo></xs:annotation>
      <xs:element name="Rec">
        <xs:complexType><xs:sequence /></xs:complexType>
      </xs:element>
    `);
    const schema = parseXsd(xsd);
    const rec = schema.children[0] as FFRecordNode;
    // Record should inherit schema defaults when its own values are empty
    expect(rec.recordInfo.childDelimiter).toBe('|');
    expect(rec.recordInfo.childDelimiterType).toBe(CharacterType.Character);
    expect(rec.recordInfo.childOrder).toBe(ChildOrder.Prefix);
    expect(rec.recordInfo.escapeCharacter).toBe('~');
    expect(rec.recordInfo.escapeCharacterType).toBe(CharacterType.Character);
    expect(rec.recordInfo.repeatingDelimiter).toBe('#');
    expect(rec.recordInfo.repeatingDelimiterType).toBe(CharacterType.Character);
  });
});

// ─── Element / Field Parsing ────────────────────────────────────────────────

describe('parseXsd – elements (fields)', () => {
  it('parses a simple element with fieldInfo', () => {
    const xsd = wrapXsd(`
      <xs:element name="Rec">
        <xs:complexType><xs:sequence>
          <xs:element name="Field1" type="xs:string">
            <xs:annotation><xs:appinfo>
              <b:fieldInfo sequence_number="1" justification="right"
                pos_length="10" pos_offset="5"
                pad_char=" " pad_char_type="char"
                min_length_with_pad_char="8"
                wrap_char="&quot;" wrap_char_type="char"
                datetime_format="yyyy-MM-dd"
              />
            </xs:appinfo></xs:annotation>
          </xs:element>
        </xs:sequence></xs:complexType>
      </xs:element>
    `);
    const schema = parseXsd(xsd);
    const rec = schema.children[0] as FFRecordNode;
    const seq = rec.children.find(c => c.kind === 'sequence') as FFSequenceNode;
    const field = seq.children[0] as FFElementNode;
    expect(field.kind).toBe('element');
    expect(field.name).toBe('Field1');
    expect(field.dataType).toBe('string');
    expect(field.fieldInfo.justification).toBe(Justification.Right);
    expect(field.fieldInfo.positionalLength).toBe(10);
    expect(field.fieldInfo.positionalOffset).toBe(5);
    expect(field.fieldInfo.padCharacter).toBe(' ');
    expect(field.fieldInfo.padCharacterType).toBe(CharacterType.Character);
    expect(field.fieldInfo.minimumLengthWithPadCharacter).toBe(8);
    expect(field.fieldInfo.wrapCharacter).toBe('"');
    expect(field.fieldInfo.wrapCharacterType).toBe(CharacterType.Character);
    expect(field.fieldInfo.dateTimeFormat).toBe('yyyy-MM-dd');
  });

  it('resolves the data type when xs: prefix is used', () => {
    const xsd = wrapXsd(`
      <xs:element name="Rec">
        <xs:complexType><xs:sequence>
          <xs:element name="Num" type="xs:int" />
        </xs:sequence></xs:complexType>
      </xs:element>
    `);
    const schema = parseXsd(xsd);
    const rec = schema.children[0] as FFRecordNode;
    const seq = rec.children.find(c => c.kind === 'sequence') as FFSequenceNode;
    const field = seq.children[0] as FFElementNode;
    expect(field.dataType).toBe('int');
  });

  it('defaults data type to "string" when no type attribute', () => {
    const xsd = wrapXsd(`
      <xs:element name="Rec">
        <xs:complexType><xs:sequence>
          <xs:element name="Bare" />
        </xs:sequence></xs:complexType>
      </xs:element>
    `);
    const schema = parseXsd(xsd);
    const rec = schema.children[0] as FFRecordNode;
    const seq = rec.children.find(c => c.kind === 'sequence') as FFSequenceNode;
    const field = seq.children[0] as FFElementNode;
    expect(field.dataType).toBe('string');
  });

  it('inherits schema-level field defaults (pad/wrap)', () => {
    const xsd = wrapXsd(`
      <xs:annotation><xs:appinfo>
        <b:schemaInfo standard="Flat File" default_pad_char="0" pad_char_type="char" default_wrap_char="'" wrap_char_type="char" />
      </xs:appinfo></xs:annotation>
      <xs:element name="Rec">
        <xs:complexType><xs:sequence>
          <xs:element name="F" type="xs:string" />
        </xs:sequence></xs:complexType>
      </xs:element>
    `);
    const schema = parseXsd(xsd);
    const rec = schema.children[0] as FFRecordNode;
    const seq = rec.children.find(c => c.kind === 'sequence') as FFSequenceNode;
    const field = seq.children[0] as FFElementNode;
    expect(field.fieldInfo.padCharacter).toBe('0');
    expect(field.fieldInfo.padCharacterType).toBe(CharacterType.Character);
    expect(field.fieldInfo.wrapCharacter).toBe("'");
    expect(field.fieldInfo.wrapCharacterType).toBe(CharacterType.Character);
  });
});

// ─── Attribute Parsing ──────────────────────────────────────────────────────

describe('parseXsd – attributes', () => {
  it('parses xs:attribute nodes', () => {
    const xsd = wrapXsd(`
      <xs:element name="Rec">
        <xs:complexType>
          <xs:sequence />
          <xs:attribute name="ver" type="xs:string" use="required">
            <xs:annotation><xs:appinfo>
              <b:fieldInfo sequence_number="1" />
            </xs:appinfo></xs:annotation>
          </xs:attribute>
        </xs:complexType>
      </xs:element>
    `);
    const schema = parseXsd(xsd);
    const rec = schema.children[0] as FFRecordNode;
    const attr = rec.children.find(c => c.kind === 'attribute') as FFAttributeNode;
    expect(attr).toBeDefined();
    expect(attr.name).toBe('ver');
    expect(attr.use).toBe(XmlSchemaUse.Required);
    expect(attr.dataType).toBe('string');
  });

  it('defaults attribute use to optional', () => {
    const xsd = wrapXsd(`
      <xs:element name="Rec">
        <xs:complexType>
          <xs:sequence />
          <xs:attribute name="opt" type="xs:string" />
        </xs:complexType>
      </xs:element>
    `);
    const schema = parseXsd(xsd);
    const rec = schema.children[0] as FFRecordNode;
    const attr = rec.children.find(c => c.kind === 'attribute') as FFAttributeNode;
    expect(attr.use).toBe(XmlSchemaUse.Optional);
  });
});

// ─── Sequence / Choice Group Parsing ────────────────────────────────────────

describe('parseXsd – groups', () => {
  it('parses xs:sequence with groupInfo', () => {
    const xsd = wrapXsd(`
      <xs:element name="Rec">
        <xs:complexType>
          <xs:sequence>
            <xs:annotation><xs:appinfo>
              <b:groupInfo sequence_number="42" />
            </xs:appinfo></xs:annotation>
            <xs:element name="F" type="xs:string" />
          </xs:sequence>
        </xs:complexType>
      </xs:element>
    `);
    const schema = parseXsd(xsd);
    const rec = schema.children[0] as FFRecordNode;
    const seq = rec.children.find(c => c.kind === 'sequence') as FFSequenceNode;
    expect(seq).toBeDefined();
    expect(seq.groupInfo.sequenceNumber).toBe(42);
    expect(seq.children).toHaveLength(1);
  });

  it('parses xs:choice groups', () => {
    const xsd = wrapXsd(`
      <xs:element name="Rec">
        <xs:complexType>
          <xs:choice>
            <xs:element name="A" type="xs:string" />
            <xs:element name="B" type="xs:int" />
          </xs:choice>
        </xs:complexType>
      </xs:element>
    `);
    const schema = parseXsd(xsd);
    const rec = schema.children[0] as FFRecordNode;
    const choice = rec.children.find(c => c.kind === 'choice') as FFChoiceNode;
    expect(choice).toBeDefined();
    expect(choice.children).toHaveLength(2);
  });

  it('parses nested sequences', () => {
    const xsd = wrapXsd(`
      <xs:element name="Rec">
        <xs:complexType>
          <xs:sequence>
            <xs:sequence>
              <xs:element name="Nested" type="xs:string" />
            </xs:sequence>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
    `);
    const schema = parseXsd(xsd);
    const rec = schema.children[0] as FFRecordNode;
    const outerSeq = rec.children.find(c => c.kind === 'sequence') as FFSequenceNode;
    expect(outerSeq.children).toHaveLength(1);
    const innerSeq = outerSeq.children[0] as FFSequenceNode;
    expect(innerSeq.kind).toBe('sequence');
    expect(innerSeq.children).toHaveLength(1);
  });

  it('parses nested choice inside sequence', () => {
    const xsd = wrapXsd(`
      <xs:element name="Rec">
        <xs:complexType>
          <xs:sequence>
            <xs:choice>
              <xs:element name="A" type="xs:string" />
            </xs:choice>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
    `);
    const schema = parseXsd(xsd);
    const rec = schema.children[0] as FFRecordNode;
    const seq = rec.children.find(c => c.kind === 'sequence') as FFSequenceNode;
    const choice = seq.children[0] as FFChoiceNode;
    expect(choice.kind).toBe('choice');
    expect(choice.children).toHaveLength(1);
  });
});

// ─── Complex Scenarios ──────────────────────────────────────────────────────

describe('parseXsd – complex schemas', () => {
  it('parses the sample invoice XSD', () => {
    const xsd = `<?xml version="1.0" encoding="utf-8" ?>
<xs:schema xmlns="http://example.com/flatfile"
  xmlns:b="http://schemas.microsoft.com/BizTalk/2003"
  xmlns:xs="http://www.w3.org/2001/XMLSchema" targetNamespace="http://example.com/flatfile" elementFormDefault="qualified">
  <xs:annotation>
    <xs:appinfo>
      <b:schemaInfo standard="Flat File" root_reference="Invoice" default_child_delimiter="," child_delimiter_type="char" default_child_order="infix" codepage="65001" />
    </xs:appinfo>
  </xs:annotation>
  <xs:element name="Invoice">
    <xs:annotation><xs:appinfo>
      <b:recordInfo structure="delimited" child_delimiter="&#xD;&#xA;" child_delimiter_type="char" child_order="postfix" tag_name="INV" tag_offset="0" />
    </xs:appinfo></xs:annotation>
    <xs:complexType>
      <xs:sequence>
        <xs:element name="Header">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="InvoiceNumber" type="xs:string" />
              <xs:element name="InvoiceDate" type="xs:dateTime" />
            </xs:sequence>
            <xs:attribute name="version" type="xs:string" use="optional" />
          </xs:complexType>
        </xs:element>
        <xs:element name="Footer">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="Total" type="xs:decimal" />
            </xs:sequence>
          </xs:complexType>
        </xs:element>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>`;

    const schema = parseXsd(xsd);
    expect(schema.schemaInfo.rootReference).toBe('Invoice');

    const invoice = schema.children[0] as FFRecordNode;
    expect(invoice.name).toBe('Invoice');
    expect(invoice.recordInfo.tagIdentifier).toBe('INV');

    const seq = invoice.children.find(c => c.kind === 'sequence') as FFSequenceNode;
    expect(seq.children).toHaveLength(2); // Header, Footer

    const header = seq.children[0] as FFRecordNode;
    expect(header.name).toBe('Header');
    // Header should have an attribute child
    const attr = header.children.find(c => c.kind === 'attribute') as FFAttributeNode;
    expect(attr).toBeDefined();
    expect(attr.name).toBe('version');

    const headerSeq = header.children.find(c => c.kind === 'sequence') as FFSequenceNode;
    expect(headerSeq.children).toHaveLength(2); // InvoiceNumber, InvoiceDate
  });

  it('assigns unique ids to every node', () => {
    const xsd = wrapXsd(`
      <xs:element name="Rec">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="A" type="xs:string" />
            <xs:element name="B" type="xs:string" />
          </xs:sequence>
        </xs:complexType>
      </xs:element>
    `);
    const schema = parseXsd(xsd);
    const ids = new Set<string>();
    function collectIds(node: import('@/model/types').FFNode) {
      expect(ids.has(node.id)).toBe(false);
      ids.add(node.id);
      for (const c of node.children) {
        collectIds(c);
      }
    }
    collectIds(schema);
    // schema + record + sequence + 2 elements = 5
    expect(ids.size).toBe(5);
  });

  it('parses a named complexType referenced by type attribute', () => {
    const xsd = `<?xml version="1.0" encoding="utf-8" ?>
<xs:schema xmlns="http://example.com/ns"
  xmlns:b="http://schemas.microsoft.com/BizTalk/2003"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  targetNamespace="http://example.com/ns"
  elementFormDefault="qualified">
  <xs:complexType name="MyType">
    <xs:sequence>
      <xs:element name="Inner" type="xs:string" />
    </xs:sequence>
  </xs:complexType>
  <xs:element name="Root" type="MyType" />
</xs:schema>`;

    const schema = parseXsd(xsd);
    const root = schema.children[0] as FFRecordNode;
    expect(root.kind).toBe('record');
    expect(root.name).toBe('Root');
    const seq = root.children.find(c => c.kind === 'sequence') as FFSequenceNode;
    expect(seq).toBeDefined();
    expect(seq.children).toHaveLength(1);
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────────────────

describe('parseXsd – edge cases', () => {
  it('handles schema with no elements', () => {
    const xsd = `<?xml version="1.0" encoding="utf-8" ?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" />`;
    const schema = parseXsd(xsd);
    expect(schema.kind).toBe('schema');
    expect(schema.children).toHaveLength(0);
  });

  it('handles element with no name gracefully', () => {
    const xsd = wrapXsd(`
      <xs:element>
        <xs:complexType><xs:sequence /></xs:complexType>
      </xs:element>
    `);
    const schema = parseXsd(xsd);
    const rec = schema.children[0] as FFRecordNode;
    expect(rec.name).toBe('');
  });

  it('resets ids between parse calls', () => {
    const xsd = wrapXsd(`
      <xs:element name="A">
        <xs:complexType><xs:sequence /></xs:complexType>
      </xs:element>
    `);
    const first = parseXsd(xsd);
    resetIds();
    const second = parseXsd(xsd);
    expect(first.id).toBe(second.id);
  });

  it('handles annotation with no appinfo child', () => {
    const xsd = wrapXsd(`
      <xs:element name="NoAppInfo">
        <xs:annotation>
          <!-- no xs:appinfo here -->
        </xs:annotation>
        <xs:complexType><xs:sequence /></xs:complexType>
      </xs:element>
    `);
    const schema = parseXsd(xsd);
    const rec = schema.children[0] as FFRecordNode;
    expect(rec.kind).toBe('record');
    // Should fall back to default recordInfo
    expect(rec.recordInfo.structure).toBe(StructureType.Delimited);
  });

  it('handles an unrecognised enum value by using the fallback', () => {
    const xsd = wrapXsd(`
      <xs:element name="Rec">
        <xs:annotation><xs:appinfo>
          <b:recordInfo structure="unknownValue" />
        </xs:appinfo></xs:annotation>
        <xs:complexType><xs:sequence /></xs:complexType>
      </xs:element>
    `);
    const schema = parseXsd(xsd);
    const rec = schema.children[0] as FFRecordNode;
    // Unknown enum value should fall back to the default
    expect(rec.recordInfo.structure).toBe(StructureType.Delimited);
  });

  it('parses a numeric (non-unbounded) maxOccurs', () => {
    const xsd = wrapXsd(`
      <xs:element name="Outer">
        <xs:complexType><xs:sequence>
          <xs:element name="Inner" type="xs:string" minOccurs="0" maxOccurs="5" />
        </xs:sequence></xs:complexType>
      </xs:element>
    `);
    const schema = parseXsd(xsd);
    const outer = schema.children[0] as FFRecordNode;
    const seq = outer.children.find(c => c.kind === 'sequence') as FFSequenceNode;
    const inner = seq.children[0] as FFElementNode;
    expect(inner.maxOccurs).toBe(5);
  });

  it('handles choice as a direct child of a choice (nested choice)', () => {
    const xsd = wrapXsd(`
      <xs:element name="Rec">
        <xs:complexType>
          <xs:choice>
            <xs:choice>
              <xs:element name="Deep" type="xs:string" />
            </xs:choice>
          </xs:choice>
        </xs:complexType>
      </xs:element>
    `);
    const schema = parseXsd(xsd);
    const rec = schema.children[0] as FFRecordNode;
    const outerChoice = rec.children.find(c => c.kind === 'choice') as FFChoiceNode;
    expect(outerChoice.children).toHaveLength(1);
    const innerChoice = outerChoice.children[0] as FFChoiceNode;
    expect(innerChoice.kind).toBe('choice');
    expect(innerChoice.children).toHaveLength(1);
  });

  it('handles sequence inside a choice', () => {
    const xsd = wrapXsd(`
      <xs:element name="Rec">
        <xs:complexType>
          <xs:choice>
            <xs:sequence>
              <xs:element name="SeqChild" type="xs:string" />
            </xs:sequence>
          </xs:choice>
        </xs:complexType>
      </xs:element>
    `);
    const schema = parseXsd(xsd);
    const rec = schema.children[0] as FFRecordNode;
    const choice = rec.children.find(c => c.kind === 'choice') as FFChoiceNode;
    const seq = choice.children[0] as FFSequenceNode;
    expect(seq.kind).toBe('sequence');
    expect(seq.children).toHaveLength(1);
  });
});
