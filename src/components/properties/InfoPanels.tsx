import { CharacterType, ChildOrder, StructureType, Case, Justification, ParserOptimization } from "@/model/types";
import type { SchemaInfo, RecordInfo, FieldInfo, GroupInfo } from "@/model/types";
import {
  BoolField,
  TextField,
  NumberField,
  EnumField,
  CharacterPairField,
  SectionHeader,
} from "./PropertyFields";

// ─── Enum display maps ──────────────────────────────────────────────────────

const characterTypeOptions: Record<string, CharacterType> = {
  None: CharacterType.None,
  Character: CharacterType.Character,
  Hexadecimal: CharacterType.Hexadecimal,
  Default: CharacterType.Default,
};

const childOrderOptions: Record<string, ChildOrder> = {
  "Conditional Default": ChildOrder.ConditionalDefault,
  Prefix: ChildOrder.Prefix,
  Infix: ChildOrder.Infix,
  Postfix: ChildOrder.Postfix,
};

const structureTypeOptions: Record<string, StructureType> = {
  Delimited: StructureType.Delimited,
  Positional: StructureType.Positional,
};

const caseOptions: Record<string, Case> = {
  Default: Case.Default,
  Lowercase: Case.Lowercase,
  Uppercase: Case.Uppercase,
};

const justificationOptions: Record<string, Justification> = {
  Left: Justification.Left,
  Right: Justification.Right,
};

const parserOptimizationOptions: Record<string, ParserOptimization> = {
  Speed: ParserOptimization.Speed,
  Complexity: ParserOptimization.Complexity,
};

/** XSD built-in simple types (xs: prefix is added during serialization). */
const xsdBuiltInTypes: Record<string, string> = {
  "xs:string": "xs:string",
  "xs:boolean": "xs:boolean",
  "xs:decimal": "xs:decimal",
  "xs:float": "xs:float",
  "xs:double": "xs:double",
  "xs:integer": "xs:integer",
  "xs:long": "xs:long",
  "xs:int": "xs:int",
  "xs:short": "xs:short",
  "xs:byte": "xs:byte",
  "xs:unsignedLong": "xs:unsignedLong",
  "xs:unsignedInt": "xs:unsignedInt",
  "xs:unsignedShort": "xs:unsignedShort",
  "xs:unsignedByte": "xs:unsignedByte",
  "xs:positiveInteger": "xs:positiveInteger",
  "xs:negativeInteger": "xs:negativeInteger",
  "xs:nonPositiveInteger": "xs:nonPositiveInteger",
  "xs:nonNegativeInteger": "xs:nonNegativeInteger",
  "xs:date": "xs:date",
  "xs:dateTime": "xs:dateTime",
  "xs:time": "xs:time",
  "xs:duration": "xs:duration",
  "xs:gYear": "xs:gYear",
  "xs:gYearMonth": "xs:gYearMonth",
  "xs:gMonth": "xs:gMonth",
  "xs:gMonthDay": "xs:gMonthDay",
  "xs:gDay": "xs:gDay",
  "xs:hexBinary": "xs:hexBinary",
  "xs:base64Binary": "xs:base64Binary",
  "xs:anyURI": "xs:anyURI",
  "xs:QName": "xs:QName",
  "xs:NOTATION": "xs:NOTATION",
  "xs:normalizedString": "xs:normalizedString",
  "xs:token": "xs:token",
  "xs:language": "xs:language",
  "xs:Name": "xs:Name",
  "xs:NCName": "xs:NCName",
  "xs:ID": "xs:ID",
  "xs:IDREF": "xs:IDREF",
  "xs:IDREFS": "xs:IDREFS",
  "xs:ENTITY": "xs:ENTITY",
  "xs:ENTITIES": "xs:ENTITIES",
  "xs:NMTOKEN": "xs:NMTOKEN",
  "xs:NMTOKENS": "xs:NMTOKENS",
};

// ─── SchemaInfo Panel ───────────────────────────────────────────────────────

interface SchemaInfoPanelProps {
  info: SchemaInfo;
  onChange: (property: string, value: unknown) => void;
  isDirty: (property: string) => boolean;
}

export function SchemaInfoPanel({ info, onChange, isDirty }: SchemaInfoPanelProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <SectionHeader title="General" />
      <TextField label="Standard" value={info.standard} onChange={(v) => onChange("standard", v)} dirty={isDirty("standard")} />
      <TextField label="Root Reference" value={info.rootReference ?? ""} onChange={(v) => onChange("rootReference", v || null)} dirty={isDirty("rootReference")} />
      <EnumField label="Case" value={info.case} options={caseOptions} onChange={(v) => onChange("case", v)} dirty={isDirty("case")} />
      <NumberField label="Code Page" value={info.codePage} onChange={(v) => onChange("codePage", v)} dirty={isDirty("codePage")} />
      <TextField label="Culture" value={info.cultureName ?? ""} onChange={(v) => onChange("cultureName", v || null)} placeholder="invariant" dirty={isDirty("cultureName")} />
      <EnumField label="Parser Optimization" value={info.parserOptimization} options={parserOptimizationOptions} onChange={(v) => onChange("parserOptimization", v)} dirty={isDirty("parserOptimization")} />
      <NumberField label="Lookahead Depth" value={info.lookaheadDepth} min={0} onChange={(v) => onChange("lookaheadDepth", v)} dirty={isDirty("lookaheadDepth")} />

      <SectionHeader title="Default Delimiters" />
      <CharacterPairField
        label="Child Delimiter"
        charValue={info.defaultChildDelimiter}
        charTypeValue={info.defaultChildDelimiterType}
        charTypeOptions={characterTypeOptions}
        onCharChange={(v) => onChange("defaultChildDelimiter", v)}
        onCharTypeChange={(v) => onChange("defaultChildDelimiterType", v)}
        dirtyChar={isDirty("defaultChildDelimiter")}
        dirtyCharType={isDirty("defaultChildDelimiterType")}
      />
      <EnumField label="Child Order" value={info.defaultChildOrder} options={childOrderOptions} onChange={(v) => onChange("defaultChildOrder", v)} dirty={isDirty("defaultChildOrder")} />
      <CharacterPairField
        label="Escape Character"
        charValue={info.defaultEscapeCharacter}
        charTypeValue={info.defaultEscapeCharacterType}
        charTypeOptions={characterTypeOptions}
        onCharChange={(v) => onChange("defaultEscapeCharacter", v)}
        onCharTypeChange={(v) => onChange("defaultEscapeCharacterType", v)}
        dirtyChar={isDirty("defaultEscapeCharacter")}
        dirtyCharType={isDirty("defaultEscapeCharacterType")}
      />
      <CharacterPairField
        label="Repeating Delimiter"
        charValue={info.defaultRepeatingDelimiter}
        charTypeValue={info.defaultRepeatingDelimiterType}
        charTypeOptions={characterTypeOptions}
        onCharChange={(v) => onChange("defaultRepeatingDelimiter", v)}
        onCharTypeChange={(v) => onChange("defaultRepeatingDelimiterType", v)}
        dirtyChar={isDirty("defaultRepeatingDelimiter")}
        dirtyCharType={isDirty("defaultRepeatingDelimiterType")}
      />

      <SectionHeader title="Default Characters" />
      <CharacterPairField
        label="Pad Character"
        charValue={info.defaultPadCharacter}
        charTypeValue={info.defaultPadCharacterType}
        charTypeOptions={characterTypeOptions}
        onCharChange={(v) => onChange("defaultPadCharacter", v)}
        onCharTypeChange={(v) => onChange("defaultPadCharacterType", v)}
        dirtyChar={isDirty("defaultPadCharacter")}
        dirtyCharType={isDirty("defaultPadCharacterType")}
      />
      <CharacterPairField
        label="Wrap Character"
        charValue={info.defaultWrapCharacter}
        charTypeValue={info.defaultWrapCharacterType}
        charTypeOptions={characterTypeOptions}
        onCharChange={(v) => onChange("defaultWrapCharacter", v)}
        onCharTypeChange={(v) => onChange("defaultWrapCharacterType", v)}
        dirtyChar={isDirty("defaultWrapCharacter")}
        dirtyCharType={isDirty("defaultWrapCharacterType")}
      />

      <SectionHeader title="Flags" />
      <BoolField label="Allow Early Termination" value={info.allowEarlyTermination} onChange={(v) => onChange("allowEarlyTermination", v)} dirty={isDirty("allowEarlyTermination")} />
      <BoolField label="Allow Message Breakup at Infix Root" value={info.allowMessageBreakupAtInfixRoot} onChange={(v) => onChange("allowMessageBreakupAtInfixRoot", v)} dirty={isDirty("allowMessageBreakupAtInfixRoot")} />
      <BoolField label="Count Positions in Bytes" value={info.countPositionsInBytes} onChange={(v) => onChange("countPositionsInBytes", v)} dirty={isDirty("countPositionsInBytes")} />
      <BoolField label="Early Terminate Optional Fields" value={info.earlyTerminateOptionalFields} onChange={(v) => onChange("earlyTerminateOptionalFields", v)} dirty={isDirty("earlyTerminateOptionalFields")} />
      <BoolField label="Generate Empty Nodes" value={info.generateEmptyNodes} onChange={(v) => onChange("generateEmptyNodes", v)} dirty={isDirty("generateEmptyNodes")} />
      <BoolField label="Suppress Empty Nodes" value={info.suppressEmptyNodes} onChange={(v) => onChange("suppressEmptyNodes", v)} dirty={isDirty("suppressEmptyNodes")} />
    </div>
  );
}

// ─── RecordInfo Panel ───────────────────────────────────────────────────────

interface RecordInfoPanelProps {
  info: RecordInfo;
  name: string;
  minOccurs: number;
  maxOccurs: number;
  onChange: (property: string, value: unknown) => void;
  onDirectChange: (property: string, value: unknown) => void;
  isDirty: (property: string) => boolean;
  isDirectDirty: (property: string) => boolean;
}

export function RecordInfoPanel({ info, name, minOccurs, maxOccurs, onChange, onDirectChange, isDirty, isDirectDirty }: RecordInfoPanelProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <SectionHeader title="Record" />
      <TextField label="Name" value={name} readOnly onChange={() => {}} />
      <NumberField label="Min Occurs" value={minOccurs} min={0} onChange={(v) => onDirectChange("minOccurs", v)} dirty={isDirectDirty("minOccurs")} />
      <NumberField label="Max Occurs" value={maxOccurs} min={0} onChange={(v) => onDirectChange("maxOccurs", v)} dirty={isDirectDirty("maxOccurs")} />
      <EnumField label="Structure" value={info.structure} options={structureTypeOptions} onChange={(v) => onChange("structure", v)} dirty={isDirty("structure")} />

      <SectionHeader title="Delimiters" />
      <CharacterPairField
        label="Child Delimiter"
        charValue={info.childDelimiter ?? ""}
        charTypeValue={info.childDelimiterType}
        charTypeOptions={characterTypeOptions}
        onCharChange={(v) => onChange("childDelimiter", v || null)}
        onCharTypeChange={(v) => onChange("childDelimiterType", v)}
        dirtyChar={isDirty("childDelimiter")}
        dirtyCharType={isDirty("childDelimiterType")}
      />
      <EnumField label="Child Order" value={info.childOrder} options={childOrderOptions} onChange={(v) => onChange("childOrder", v)} dirty={isDirty("childOrder")} />
      <CharacterPairField
        label="Escape Character"
        charValue={info.escapeCharacter ?? ""}
        charTypeValue={info.escapeCharacterType}
        charTypeOptions={characterTypeOptions}
        onCharChange={(v) => onChange("escapeCharacter", v || null)}
        onCharTypeChange={(v) => onChange("escapeCharacterType", v)}
        dirtyChar={isDirty("escapeCharacter")}
        dirtyCharType={isDirty("escapeCharacterType")}
      />
      <CharacterPairField
        label="Repeating Delimiter"
        charValue={info.repeatingDelimiter ?? ""}
        charTypeValue={info.repeatingDelimiterType}
        charTypeOptions={characterTypeOptions}
        onCharChange={(v) => onChange("repeatingDelimiter", v || null)}
        onCharTypeChange={(v) => onChange("repeatingDelimiterType", v)}
        dirtyChar={isDirty("repeatingDelimiter")}
        dirtyCharType={isDirty("repeatingDelimiterType")}
      />

      <SectionHeader title="Tag" />
      <TextField label="Tag Identifier" value={info.tagIdentifier ?? ""} onChange={(v) => onChange("tagIdentifier", v || null)} dirty={isDirty("tagIdentifier")} />
      <NumberField label="Tag Offset" value={info.tagOffset} min={0} onChange={(v) => onChange("tagOffset", v)} dirty={isDirty("tagOffset")} />

      <SectionHeader title="Flags" />
      <BoolField label="Preserve Delimiter for Empty Data" value={info.preserveDelimiterForEmptyData} onChange={(v) => onChange("preserveDelimiterForEmptyData", v)} dirty={isDirty("preserveDelimiterForEmptyData")} />
      <BoolField label="Suppress Trailing Delimiters" value={info.suppressTrailingDelimiters} onChange={(v) => onChange("suppressTrailingDelimiters", v)} dirty={isDirty("suppressTrailingDelimiters")} />
    </div>
  );
}

// ─── FieldInfo Panel ────────────────────────────────────────────────────────

interface FieldInfoPanelProps {
  info: FieldInfo;
  name: string;
  dataType: string;
  isAttribute?: boolean;
  onChange: (property: string, value: unknown) => void;
  onDirectChange: (property: string, value: unknown) => void;
  isDirty: (property: string) => boolean;
  isDirectDirty: (property: string) => boolean;
}

export function FieldInfoPanel({ info, name, dataType, isAttribute, onChange, onDirectChange, isDirty, isDirectDirty }: FieldInfoPanelProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <SectionHeader title={isAttribute ? "Attribute" : "Element"} />
      <TextField label="Name" value={name} readOnly onChange={() => {}} />
      <EnumField label="Data Type" value={dataType} options={xsdBuiltInTypes} onChange={(v) => onDirectChange("dataType", v)} dirty={isDirectDirty("dataType")} />
      <EnumField label="Justification" value={info.justification} options={justificationOptions} onChange={(v) => onChange("justification", v)} dirty={isDirty("justification")} />
      <TextField label="DateTime Format" value={info.dateTimeFormat} onChange={(v) => onChange("dateTimeFormat", v)} placeholder=".NET format string" dirty={isDirty("dateTimeFormat")} />

      <SectionHeader title="Positional" />
      <NumberField label="Positional Offset" value={info.positionalOffset} min={0} onChange={(v) => onChange("positionalOffset", v)} dirty={isDirty("positionalOffset")} />
      <NumberField label="Positional Length" value={info.positionalLength} min={0} onChange={(v) => onChange("positionalLength", v)} dirty={isDirty("positionalLength")} />

      <SectionHeader title="Characters" />
      <CharacterPairField
        label="Pad Character"
        charValue={info.padCharacter}
        charTypeValue={info.padCharacterType}
        charTypeOptions={characterTypeOptions}
        onCharChange={(v) => onChange("padCharacter", v)}
        onCharTypeChange={(v) => onChange("padCharacterType", v)}
        dirtyChar={isDirty("padCharacter")}
        dirtyCharType={isDirty("padCharacterType")}
      />
      <NumberField label="Min Length with Pad" value={info.minimumLengthWithPadCharacter} min={0} onChange={(v) => onChange("minimumLengthWithPadCharacter", v)} dirty={isDirty("minimumLengthWithPadCharacter")} />
      <CharacterPairField
        label="Wrap Character"
        charValue={info.wrapCharacter}
        charTypeValue={info.wrapCharacterType}
        charTypeOptions={characterTypeOptions}
        onCharChange={(v) => onChange("wrapCharacter", v)}
        onCharTypeChange={(v) => onChange("wrapCharacterType", v)}
        dirtyChar={isDirty("wrapCharacter")}
        dirtyCharType={isDirty("wrapCharacterType")}
      />
    </div>
  );
}

// ─── GroupInfo Panel ────────────────────────────────────────────────────────

const groupKindOptions: Record<string, "sequence" | "choice"> = {
  Sequence: "sequence",
  Choice: "choice",
};

interface GroupInfoPanelProps {
  info: GroupInfo;
  kind: "sequence" | "choice";
  minOccurs: number;
  maxOccurs: number;
  onChange: (property: string, value: unknown) => void;
  onDirectChange: (property: string, value: unknown) => void;
  isDirty: (property: string) => boolean;
  isDirectDirty: (property: string) => boolean;
}

export function GroupInfoPanel({ info, kind, minOccurs, maxOccurs, onChange, onDirectChange, isDirty, isDirectDirty }: GroupInfoPanelProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <SectionHeader title="Group" />
      <EnumField label="Type" value={kind} options={groupKindOptions} onChange={(v) => onDirectChange("kind", v)} dirty={isDirectDirty("kind")} />
      <NumberField label="Min Occurs" value={minOccurs} min={0} onChange={(v) => onDirectChange("minOccurs", v)} dirty={isDirectDirty("minOccurs")} />
      <NumberField label="Max Occurs" value={maxOccurs} min={0} onChange={(v) => onDirectChange("maxOccurs", v)} dirty={isDirectDirty("maxOccurs")} />
    </div>
  );
}
