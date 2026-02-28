import {
  Case,
  CharacterType,
  ChildOrder,
  Justification,
  ParserOptimization,
  StructureType,
  UNBOUNDED,
} from '@/model/types';

// ─── Enum display maps ──────────────────────────────────────────────────────

export const characterTypeOptions: Record<string, CharacterType> = {
  None: CharacterType.None,
  Character: CharacterType.Character,
  Hexadecimal: CharacterType.Hexadecimal,
  Default: CharacterType.Default,
};

export const childOrderOptions: Record<string, ChildOrder> = {
  'Conditional Default': ChildOrder.ConditionalDefault,
  Prefix: ChildOrder.Prefix,
  Infix: ChildOrder.Infix,
  Postfix: ChildOrder.Postfix,
};

export const structureTypeOptions: Record<string, StructureType> = {
  Delimited: StructureType.Delimited,
  Positional: StructureType.Positional,
};

export const caseOptions: Record<string, Case> = {
  Default: Case.Default,
  Lowercase: Case.Lowercase,
  Uppercase: Case.Uppercase,
};

export const justificationOptions: Record<string, Justification> = {
  Left: Justification.Left,
  Right: Justification.Right,
};

export const parserOptimizationOptions: Record<string, ParserOptimization> = {
  Speed: ParserOptimization.Speed,
  Complexity: ParserOptimization.Complexity,
};

export const elementFormDefaultOptions: Record<string, string> = {
  Qualified: 'qualified',
  Unqualified: 'unqualified',
};

/** Shared handler factory for minOccurs changes that auto-bump maxOccurs. */
export function createMinOccursHandler(maxOccurs: number, onDirectChange: (property: string, value: unknown) => void) {
  return (v: number) => {
    onDirectChange('minOccurs', v);
    if (maxOccurs !== UNBOUNDED && v > maxOccurs) {
      onDirectChange('maxOccurs', v);
    }
  };
}

/** XSD built-in simple types (xs: prefix is added during serialization). */
export const xsdBuiltInTypes: Record<string, string> = {
  'xs:string': 'xs:string',
  'xs:boolean': 'xs:boolean',
  'xs:decimal': 'xs:decimal',
  'xs:float': 'xs:float',
  'xs:double': 'xs:double',
  'xs:integer': 'xs:integer',
  'xs:long': 'xs:long',
  'xs:int': 'xs:int',
  'xs:short': 'xs:short',
  'xs:byte': 'xs:byte',
  'xs:unsignedLong': 'xs:unsignedLong',
  'xs:unsignedInt': 'xs:unsignedInt',
  'xs:unsignedShort': 'xs:unsignedShort',
  'xs:unsignedByte': 'xs:unsignedByte',
  'xs:positiveInteger': 'xs:positiveInteger',
  'xs:negativeInteger': 'xs:negativeInteger',
  'xs:nonPositiveInteger': 'xs:nonPositiveInteger',
  'xs:nonNegativeInteger': 'xs:nonNegativeInteger',
  'xs:date': 'xs:date',
  'xs:dateTime': 'xs:dateTime',
  'xs:time': 'xs:time',
  'xs:duration': 'xs:duration',
  'xs:gYear': 'xs:gYear',
  'xs:gYearMonth': 'xs:gYearMonth',
  'xs:gMonth': 'xs:gMonth',
  'xs:gMonthDay': 'xs:gMonthDay',
  'xs:gDay': 'xs:gDay',
  'xs:hexBinary': 'xs:hexBinary',
  'xs:base64Binary': 'xs:base64Binary',
  'xs:anyURI': 'xs:anyURI',
  'xs:QName': 'xs:QName',
  'xs:NOTATION': 'xs:NOTATION',
  'xs:normalizedString': 'xs:normalizedString',
  'xs:token': 'xs:token',
  'xs:language': 'xs:language',
  'xs:Name': 'xs:Name',
  'xs:NCName': 'xs:NCName',
  'xs:ID': 'xs:ID',
  'xs:IDREF': 'xs:IDREF',
  'xs:IDREFS': 'xs:IDREFS',
  'xs:ENTITY': 'xs:ENTITY',
  'xs:ENTITIES': 'xs:ENTITIES',
  'xs:NMTOKEN': 'xs:NMTOKEN',
  'xs:NMTOKENS': 'xs:NMTOKENS',
};
