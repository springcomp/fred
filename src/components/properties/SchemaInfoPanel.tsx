import type { SchemaInfo } from '@/model/types';
import {
  caseOptions,
  characterTypeOptions,
  childOrderOptions,
  elementFormDefaultOptions,
  parserOptimizationOptions,
} from './enumMaps';
import {
  BoolField,
  CharacterPairField,
  EnumField,
  NumberField,
  SectionHeader,
  TextField,
} from './PropertyFields';

interface SchemaInfoPanelProps {
  info: SchemaInfo;
  elementFormDefault: string;
  onChange: (property: string, value: unknown) => void;
  onDirectChange: (property: string, value: unknown) => void;
  isDirty: (property: string) => boolean;
  isDirectDirty: (property: string) => boolean;
}

export function SchemaInfoPanel({
  info,
  elementFormDefault,
  onChange,
  onDirectChange,
  isDirty,
  isDirectDirty,
}: SchemaInfoPanelProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <SectionHeader title="General" />
      <TextField
        label="Standard"
        value={info.standard}
        onChange={v => onChange('standard', v)}
        dirty={isDirty('standard')}
      />
      <TextField
        label="Root Reference"
        value={info.rootReference ?? ''}
        onChange={v => onChange('rootReference', v || null)}
        dirty={isDirty('rootReference')}
      />
      <EnumField
        label="Element Form Default"
        value={elementFormDefault}
        options={elementFormDefaultOptions}
        onChange={v => onDirectChange('elementFormDefault', v)}
        dirty={isDirectDirty('elementFormDefault')}
      />
      <EnumField
        label="Case"
        value={info.case}
        options={caseOptions}
        onChange={v => onChange('case', v)}
        dirty={isDirty('case')}
      />
      <NumberField
        label="Code Page"
        value={info.codePage}
        onChange={v => onChange('codePage', v)}
        dirty={isDirty('codePage')}
      />
      <TextField
        label="Culture"
        value={info.cultureName ?? ''}
        onChange={v => onChange('cultureName', v || null)}
        placeholder="invariant"
        dirty={isDirty('cultureName')}
      />
      <EnumField
        label="Parser Optimization"
        value={info.parserOptimization}
        options={parserOptimizationOptions}
        onChange={v => onChange('parserOptimization', v)}
        dirty={isDirty('parserOptimization')}
      />
      <NumberField
        label="Lookahead Depth"
        value={info.lookaheadDepth}
        min={0}
        onChange={v => onChange('lookaheadDepth', v)}
        dirty={isDirty('lookaheadDepth')}
      />

      <SectionHeader title="Default Delimiters" />
      <CharacterPairField
        label="Child Delimiter"
        charValue={info.defaultChildDelimiter}
        charTypeValue={info.defaultChildDelimiterType}
        charTypeOptions={characterTypeOptions}
        onCharChange={v => onChange('defaultChildDelimiter', v)}
        onCharTypeChange={v => onChange('defaultChildDelimiterType', v)}
        dirtyChar={isDirty('defaultChildDelimiter')}
        dirtyCharType={isDirty('defaultChildDelimiterType')}
      />
      <EnumField
        label="Child Order"
        value={info.defaultChildOrder}
        options={childOrderOptions}
        onChange={v => onChange('defaultChildOrder', v)}
        dirty={isDirty('defaultChildOrder')}
      />
      <CharacterPairField
        label="Escape Character"
        charValue={info.defaultEscapeCharacter}
        charTypeValue={info.defaultEscapeCharacterType}
        charTypeOptions={characterTypeOptions}
        onCharChange={v => onChange('defaultEscapeCharacter', v)}
        onCharTypeChange={v => onChange('defaultEscapeCharacterType', v)}
        dirtyChar={isDirty('defaultEscapeCharacter')}
        dirtyCharType={isDirty('defaultEscapeCharacterType')}
      />
      <CharacterPairField
        label="Repeating Delimiter"
        charValue={info.defaultRepeatingDelimiter}
        charTypeValue={info.defaultRepeatingDelimiterType}
        charTypeOptions={characterTypeOptions}
        onCharChange={v => onChange('defaultRepeatingDelimiter', v)}
        onCharTypeChange={v => onChange('defaultRepeatingDelimiterType', v)}
        dirtyChar={isDirty('defaultRepeatingDelimiter')}
        dirtyCharType={isDirty('defaultRepeatingDelimiterType')}
      />

      <SectionHeader title="Default Characters" />
      <CharacterPairField
        label="Pad Character"
        charValue={info.defaultPadCharacter}
        charTypeValue={info.defaultPadCharacterType}
        charTypeOptions={characterTypeOptions}
        onCharChange={v => onChange('defaultPadCharacter', v)}
        onCharTypeChange={v => onChange('defaultPadCharacterType', v)}
        dirtyChar={isDirty('defaultPadCharacter')}
        dirtyCharType={isDirty('defaultPadCharacterType')}
      />
      <CharacterPairField
        label="Wrap Character"
        charValue={info.defaultWrapCharacter}
        charTypeValue={info.defaultWrapCharacterType}
        charTypeOptions={characterTypeOptions}
        onCharChange={v => onChange('defaultWrapCharacter', v)}
        onCharTypeChange={v => onChange('defaultWrapCharacterType', v)}
        dirtyChar={isDirty('defaultWrapCharacter')}
        dirtyCharType={isDirty('defaultWrapCharacterType')}
      />

      <SectionHeader title="Flags" />
      <BoolField
        label="Allow Early Termination"
        value={info.allowEarlyTermination}
        onChange={v => onChange('allowEarlyTermination', v)}
        dirty={isDirty('allowEarlyTermination')}
      />
      <BoolField
        label="Allow Message Breakup at Infix Root"
        value={info.allowMessageBreakupAtInfixRoot}
        onChange={v => onChange('allowMessageBreakupAtInfixRoot', v)}
        dirty={isDirty('allowMessageBreakupAtInfixRoot')}
      />
      <BoolField
        label="Count Positions in Bytes"
        value={info.countPositionsInBytes}
        onChange={v => onChange('countPositionsInBytes', v)}
        dirty={isDirty('countPositionsInBytes')}
      />
      <BoolField
        label="Early Terminate Optional Fields"
        value={info.earlyTerminateOptionalFields}
        onChange={v => onChange('earlyTerminateOptionalFields', v)}
        dirty={isDirty('earlyTerminateOptionalFields')}
      />
      <BoolField
        label="Generate Empty Nodes"
        value={info.generateEmptyNodes}
        onChange={v => onChange('generateEmptyNodes', v)}
        dirty={isDirty('generateEmptyNodes')}
      />
      <BoolField
        label="Suppress Empty Nodes"
        value={info.suppressEmptyNodes}
        onChange={v => onChange('suppressEmptyNodes', v)}
        dirty={isDirty('suppressEmptyNodes')}
      />
    </div>
  );
}
