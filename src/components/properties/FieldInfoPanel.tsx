import type { FieldInfo } from '@/model/types';
import {
  characterTypeOptions,
  justificationOptions,
  xsdBuiltInTypes,
} from './enumMaps';
import {
  CharacterPairField,
  EnumField,
  NumberField,
  SectionHeader,
  TextField,
} from './PropertyFields';

const useOptions: Record<string, string> = {
  Optional: 'optional',
  Required: 'required',
};

interface FieldInfoPanelProps {
  info: FieldInfo;
  name: string;
  dataType: string;
  isAttribute?: boolean;
  use?: string;
  onChange: (property: string, value: unknown) => void;
  onDirectChange: (property: string, value: unknown) => void;
  isDirty: (property: string) => boolean;
  isDirectDirty: (property: string) => boolean;
}

export function FieldInfoPanel({
  info,
  name,
  dataType,
  isAttribute,
  use,
  onChange,
  onDirectChange,
  isDirty,
  isDirectDirty,
}: FieldInfoPanelProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <SectionHeader title={isAttribute ? 'Attribute' : 'Element'} />
      <TextField label="Name" value={name} readOnly onChange={() => {}} />
      <EnumField
        label="Data Type"
        value={dataType}
        options={xsdBuiltInTypes}
        onChange={v => onDirectChange('dataType', v)}
        dirty={isDirectDirty('dataType')}
      />
      {isAttribute && use != null && (
        <EnumField
          label="Use"
          value={use}
          options={useOptions}
          onChange={v => onDirectChange('use', v)}
          dirty={isDirectDirty('use')}
        />
      )}
      <EnumField
        label="Justification"
        value={info.justification}
        options={justificationOptions}
        onChange={v => onChange('justification', v)}
        dirty={isDirty('justification')}
      />
      <TextField
        label="DateTime Format"
        value={info.dateTimeFormat}
        onChange={v => onChange('dateTimeFormat', v)}
        placeholder=".NET format string"
        dirty={isDirty('dateTimeFormat')}
      />

      <SectionHeader title="Positional" />
      <NumberField
        label="Positional Offset"
        value={info.positionalOffset}
        min={0}
        onChange={v => onChange('positionalOffset', v)}
        dirty={isDirty('positionalOffset')}
      />
      <NumberField
        label="Positional Length"
        value={info.positionalLength}
        min={0}
        onChange={v => onChange('positionalLength', v)}
        dirty={isDirty('positionalLength')}
      />

      <SectionHeader title="Characters" />
      <CharacterPairField
        label="Pad Character"
        charValue={info.padCharacter}
        charTypeValue={info.padCharacterType}
        charTypeOptions={characterTypeOptions}
        onCharChange={v => onChange('padCharacter', v)}
        onCharTypeChange={v => onChange('padCharacterType', v)}
        dirtyChar={isDirty('padCharacter')}
        dirtyCharType={isDirty('padCharacterType')}
      />
      <NumberField
        label="Min Length with Pad"
        value={info.minimumLengthWithPadCharacter}
        min={0}
        onChange={v => onChange('minimumLengthWithPadCharacter', v)}
        dirty={isDirty('minimumLengthWithPadCharacter')}
      />
      <CharacterPairField
        label="Wrap Character"
        charValue={info.wrapCharacter}
        charTypeValue={info.wrapCharacterType}
        charTypeOptions={characterTypeOptions}
        onCharChange={v => onChange('wrapCharacter', v)}
        onCharTypeChange={v => onChange('wrapCharacterType', v)}
        dirtyChar={isDirty('wrapCharacter')}
        dirtyCharType={isDirty('wrapCharacterType')}
      />
    </div>
  );
}
