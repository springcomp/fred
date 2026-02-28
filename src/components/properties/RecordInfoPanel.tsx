import type { RecordInfo } from '@/model/types';
import {
  characterTypeOptions,
  childOrderOptions,
  createMinOccursHandler,
  structureTypeOptions,
} from './enumMaps';
import {
  BoolField,
  CharacterPairField,
  EnumField,
  MaxOccursField,
  NumberField,
  SectionHeader,
  TextField,
} from './PropertyFields';

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

export function RecordInfoPanel({
  info,
  name,
  minOccurs,
  maxOccurs,
  onChange,
  onDirectChange,
  isDirty,
  isDirectDirty,
}: RecordInfoPanelProps) {
  const handleMinOccursChange = createMinOccursHandler(maxOccurs, onDirectChange);
  return (
    <div className="flex flex-col gap-0.5">
      <SectionHeader title="Record" />
      <TextField label="Name" value={name} readOnly onChange={() => {}} />
      <NumberField
        label="Min Occurs"
        value={minOccurs}
        min={0}
        onChange={handleMinOccursChange}
        dirty={isDirectDirty('minOccurs')}
      />
      <MaxOccursField
        label="Max Occurs"
        value={maxOccurs}
        minOccurs={minOccurs}
        onChange={v => onDirectChange('maxOccurs', v)}
        dirty={isDirectDirty('maxOccurs')}
      />
      <EnumField
        label="Structure"
        value={info.structure}
        options={structureTypeOptions}
        onChange={v => onChange('structure', v)}
        dirty={isDirty('structure')}
      />

      <SectionHeader title="Delimiters" />
      <CharacterPairField
        label="Child Delimiter"
        charValue={info.childDelimiter ?? ''}
        charTypeValue={info.childDelimiterType}
        charTypeOptions={characterTypeOptions}
        onCharChange={v => onChange('childDelimiter', v || null)}
        onCharTypeChange={v => onChange('childDelimiterType', v)}
        dirtyChar={isDirty('childDelimiter')}
        dirtyCharType={isDirty('childDelimiterType')}
      />
      <EnumField
        label="Child Order"
        value={info.childOrder}
        options={childOrderOptions}
        onChange={v => onChange('childOrder', v)}
        dirty={isDirty('childOrder')}
      />
      <CharacterPairField
        label="Escape Character"
        charValue={info.escapeCharacter ?? ''}
        charTypeValue={info.escapeCharacterType}
        charTypeOptions={characterTypeOptions}
        onCharChange={v => onChange('escapeCharacter', v || null)}
        onCharTypeChange={v => onChange('escapeCharacterType', v)}
        dirtyChar={isDirty('escapeCharacter')}
        dirtyCharType={isDirty('escapeCharacterType')}
      />
      <CharacterPairField
        label="Repeating Delimiter"
        charValue={info.repeatingDelimiter ?? ''}
        charTypeValue={info.repeatingDelimiterType}
        charTypeOptions={characterTypeOptions}
        onCharChange={v => onChange('repeatingDelimiter', v || null)}
        onCharTypeChange={v => onChange('repeatingDelimiterType', v)}
        dirtyChar={isDirty('repeatingDelimiter')}
        dirtyCharType={isDirty('repeatingDelimiterType')}
      />

      <SectionHeader title="Tag" />
      <TextField
        label="Tag Identifier"
        value={info.tagIdentifier ?? ''}
        onChange={v => onChange('tagIdentifier', v || null)}
        dirty={isDirty('tagIdentifier')}
      />
      <NumberField
        label="Tag Offset"
        value={info.tagOffset}
        min={0}
        onChange={v => onChange('tagOffset', v)}
        dirty={isDirty('tagOffset')}
      />

      <SectionHeader title="Flags" />
      <BoolField
        label="Preserve Delimiter for Empty Data"
        value={info.preserveDelimiterForEmptyData}
        onChange={v => onChange('preserveDelimiterForEmptyData', v)}
        dirty={isDirty('preserveDelimiterForEmptyData')}
      />
      <BoolField
        label="Suppress Trailing Delimiters"
        value={info.suppressTrailingDelimiters}
        onChange={v => onChange('suppressTrailingDelimiters', v)}
        dirty={isDirty('suppressTrailingDelimiters')}
      />
    </div>
  );
}
