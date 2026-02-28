import type { GroupInfo } from '@/model/types';
import { createMinOccursHandler } from './enumMaps';
import {
  EnumField,
  MaxOccursField,
  NumberField,
  SectionHeader,
} from './PropertyFields';

const groupKindOptions: Record<string, 'sequence' | 'choice'> = {
  Sequence: 'sequence',
  Choice: 'choice',
};

interface GroupInfoPanelProps {
  info: GroupInfo;
  kind: 'sequence' | 'choice';
  minOccurs: number;
  maxOccurs: number;
  onChange: (property: string, value: unknown) => void;
  onDirectChange: (property: string, value: unknown) => void;
  isDirty: (property: string) => boolean;
  isDirectDirty: (property: string) => boolean;
}

export function GroupInfoPanel({ kind, minOccurs, maxOccurs, onDirectChange, isDirectDirty }: GroupInfoPanelProps) {
  const handleMinOccursChange = createMinOccursHandler(maxOccurs, onDirectChange);
  return (
    <div className="flex flex-col gap-0.5">
      <SectionHeader title="Group" />
      <EnumField
        label="Type"
        value={kind}
        options={groupKindOptions}
        onChange={v => onDirectChange('kind', v)}
        dirty={isDirectDirty('kind')}
      />
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
    </div>
  );
}
