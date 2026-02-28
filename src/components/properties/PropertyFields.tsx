import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { CharacterType } from '@/model/types';

// ─── Generic Property Field Components ──────────────────────────────────────

interface BoolFieldProps {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  dirty?: boolean;
}

export function BoolField({ label, value, onChange, dirty }: BoolFieldProps) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <Label className={dirty ? 'font-bold' : ''}>{label}</Label>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  dirty?: boolean;
}

export function TextField({ label, value, onChange, placeholder, readOnly, dirty }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1 py-1">
      <Label className={dirty ? 'font-bold' : ''}>{label}</Label>
      <Input
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={readOnly}
        className={readOnly ? 'opacity-50 cursor-not-allowed' : ''}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  readOnly?: boolean;
  dirty?: boolean;
}

export function NumberField({ label, value, onChange, min, max, readOnly, dirty }: NumberFieldProps) {
  return (
    <div className="flex flex-col gap-1 py-1">
      <Label className={dirty ? 'font-bold' : ''}>{label}</Label>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        readOnly={readOnly}
        disabled={readOnly}
        className={readOnly ? 'opacity-50 cursor-not-allowed' : ''}
        onChange={e => {
          const n = Number.parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) {
            onChange(n);
          }
        }}
      />
    </div>
  );
}

interface EnumFieldProps<T extends string> {
  label: string;
  value: T;
  options: Record<string, T>;
  onChange: (v: T) => void;
  dirty?: boolean;
}

export function EnumField<T extends string>({ label, value, options, onChange, dirty }: EnumFieldProps<T>) {
  return (
    <div className="flex flex-col gap-1 py-1">
      <Label className={dirty ? 'font-bold' : ''}>{label}</Label>
      <Select value={value} onChange={e => onChange(e.target.value as T)}>
        {Object.entries(options).map(([display, val]) => (
          <option key={val} value={val}>
            {display}
          </option>
        ))}
      </Select>
    </div>
  );
}

interface CharacterPairFieldProps {
  label: string;
  charValue: string;
  charTypeValue: string;
  charTypeOptions: Record<string, string>;
  onCharChange: (v: string) => void;
  onCharTypeChange: (v: string) => void;
  dirtyChar?: boolean;
  dirtyCharType?: boolean;
}

export function CharacterPairField({
  label,
  charValue,
  charTypeValue,
  charTypeOptions,
  onCharChange,
  onCharTypeChange,
  dirtyChar,
  dirtyCharType,
}: CharacterPairFieldProps) {
  const dirty = dirtyChar || dirtyCharType;
  const charReadOnly = charTypeValue === CharacterType.None || charTypeValue === CharacterType.Default;
  return (
    <div className="flex flex-col gap-1 py-1">
      <Label className={dirty ? 'font-bold' : ''}>{label}</Label>
      <Select value={charTypeValue} onChange={e => onCharTypeChange(e.target.value)}>
        {Object.entries(charTypeOptions).map(([display, val]) => (
          <option key={val} value={val}>
            {display}
          </option>
        ))}
      </Select>
      <Input
        className={charReadOnly ? 'opacity-50 cursor-not-allowed' : ''}
        value={charValue}
        readOnly={charReadOnly}
        disabled={charReadOnly}
        onChange={e => onCharChange(e.target.value)}
        placeholder="value"
      />
    </div>
  );
}

// ─── Section Header ─────────────────────────────────────────────────────────

export function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-3 pb-1 border-b border-border">
      {title}
    </h3>
  );
}

// ─── MaxOccurs Field ────────────────────────────────────────────────────────

const UNBOUNDED = Number.MAX_SAFE_INTEGER;

interface MaxOccursFieldProps {
  label: string;
  value: number;
  minOccurs: number;
  onChange: (v: number) => void;
  dirty?: boolean;
}

/**
 * A specialised field for maxOccurs.
 * Displays `minOccurs - 1` for unbounded so the native spinner
 * naturally cycles: minOccurs ↔ unbounded.
 */
export function MaxOccursField({ label, value, minOccurs, onChange, dirty }: MaxOccursFieldProps) {
  const isUnbounded = value === UNBOUNDED;
  const unboundedDisplay = minOccurs - 1;
  const displayValue = isUnbounded ? unboundedDisplay : value;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.trim();
    if (raw === '') {
      return;
    }
    const n = Number.parseInt(raw, 10);
    if (!Number.isNaN(n)) {
      onChange(n < minOccurs ? UNBOUNDED : n);
    }
  };

  return (
    <div className="flex flex-col gap-1 py-1">
      <div className="flex items-center gap-2">
        <Label className={dirty ? 'font-bold' : ''}>{label}</Label>
        {isUnbounded && <span className="text-xs text-muted-foreground italic">unbounded</span>}
      </div>
      <Input type="number" value={displayValue} min={unboundedDisplay} onChange={handleChange} />
    </div>
  );
}
