import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import { cn } from '@/lib/utils';
import {
  GUEST_LANGUAGES,
  STAGES,
  lastStayRule,
  listRule,
  readLastStay,
  readList,
  readSpend,
  readStays,
  spendRule,
  staysRule,
  type ConditionRule,
  type FilterKind,
  type LastStayMode,
  type ListFieldId,
  type SpendMode,
  type StaysMode,
} from './segment-rules';

export interface EditorProperty {
  id: string;
  name: string;
}

interface EditorProps {
  initial?: ConditionRule;
  properties: readonly EditorProperty[];
  onSave: (rule: ConditionRule) => void;
  onCancel: () => void;
}

function ToggleChip({ pressed, onToggle, children }: { pressed: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={cn(
        'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium ring-1 ring-inset transition-colors pointer-coarse:min-h-11',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        pressed ? 'bg-foreground text-background ring-foreground' : 'bg-card ring-border hover:bg-muted',
      )}
    >
      {pressed ? <Check aria-hidden="true" className="size-4" /> : null}
      {children}
    </button>
  );
}

function Frame({
  title,
  canSave,
  onSave,
  onCancel,
  children,
}: {
  title: string;
  canSave: boolean;
  onSave: () => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="group"
      aria-label={title}
      data-testid="rule-editor"
      className="space-y-4 rounded-2xl bg-muted/50 p-4 ring-1 ring-inset ring-border"
      onKeyDown={(event) => {
        if (event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target.type !== 'text') {
          event.preventDefault();
          if (canSave) onSave();
        }
      }}
    >
      <p className="font-semibold">{title}</p>
      {children}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={!canSave} onClick={onSave} data-testid="rule-editor-apply">
          {t('marketingHub.editor.apply')}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          {t('marketingHub.editor.cancel')}
        </Button>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, min = 1, suffix }: { label: string; value: string; onChange: (value: string) => void; min?: number; suffix?: string }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input id={id} type="number" inputMode="numeric" min={min} value={value} onChange={(event) => onChange(event.target.value)} className="max-w-28" />
        {suffix ? <span className="text-sm text-foreground/70">{suffix}</span> : null}
      </div>
    </div>
  );
}

const wholeNumber = (value: string, min: number) => /^\d+$/.test(value) && Number(value) >= min;

function StaysEditor({ initial, onSave, onCancel }: EditorProps) {
  const { t } = useTranslation();
  const current = initial ? readStays(initial) : null;
  const [mode, setMode] = useState<StaysMode>(current?.mode ?? 'atLeast');
  const [count, setCount] = useState(String(current?.count ?? 2));
  return (
    <Frame title={t('marketingHub.editor.stays.title')} canSave={wholeNumber(count, 1)} onSave={() => onSave(staysRule(mode, Number(count)))} onCancel={onCancel}>
      <Segmented
        label={t('marketingHub.editor.stays.title')}
        value={mode}
        onValueChange={setMode}
        options={[
          { value: 'atLeast', label: t('marketingHub.editor.stays.atLeast') },
          { value: 'exactly', label: t('marketingHub.editor.stays.exactly') },
          { value: 'lessThan', label: t('marketingHub.editor.stays.lessThan') },
        ]}
      />
      <NumberField label={t('marketingHub.editor.stays.count')} value={count} onChange={setCount} suffix={t('marketingHub.editor.stays.unit')} />
    </Frame>
  );
}

const RECENT_DAYS = [30, 60, 90, 180, 365] as const;

function LastStayEditor({ initial, onSave, onCancel }: EditorProps) {
  const { t } = useTranslation();
  const dateId = useId();
  const current = initial ? readLastStay(initial) : null;
  const [mode, setMode] = useState<LastStayMode>(current?.mode ?? 'inLast');
  const [days, setDays] = useState(current?.mode === 'inLast' ? current.value : '60');
  const [date, setDate] = useState(current && current.mode !== 'inLast' ? current.value.slice(0, 10) : '');
  const canSave = mode === 'inLast' ? wholeNumber(days, 1) : /^\d{4}-\d{2}-\d{2}$/.test(date);
  return (
    <Frame
      title={t('marketingHub.editor.lastStay.title')}
      canSave={canSave}
      onSave={() => onSave(lastStayRule(mode, mode === 'inLast' ? Number(days) : date))}
      onCancel={onCancel}
    >
      <Segmented
        label={t('marketingHub.editor.lastStay.title')}
        value={mode}
        onValueChange={setMode}
        options={[
          { value: 'inLast', label: t('marketingHub.editor.lastStay.inLast') },
          { value: 'before', label: t('marketingHub.editor.lastStay.before') },
          { value: 'after', label: t('marketingHub.editor.lastStay.after') },
        ]}
      />
      {mode === 'inLast' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {RECENT_DAYS.map((value) => (
              <ToggleChip key={value} pressed={days === String(value)} onToggle={() => setDays(String(value))}>
                {t('marketingHub.editor.lastStay.days', { count: value })}
              </ToggleChip>
            ))}
          </div>
          <NumberField label={t('marketingHub.editor.lastStay.dayCount')} value={days} onChange={setDays} suffix={t('marketingHub.editor.lastStay.dayUnit')} />
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor={dateId}>{t('marketingHub.editor.lastStay.date')}</Label>
          <Input id={dateId} type="date" value={date} onChange={(event) => setDate(event.target.value)} className="max-w-48" />
        </div>
      )}
    </Frame>
  );
}

function SpendEditor({ initial, onSave, onCancel }: EditorProps) {
  const { t } = useTranslation();
  const current = initial ? readSpend(initial) : null;
  const [mode, setMode] = useState<SpendMode>(current?.mode ?? 'moreThan');
  const [amount, setAmount] = useState(String(current?.amount ?? 500));
  return (
    <Frame title={t('marketingHub.editor.spend.title')} canSave={wholeNumber(amount, 1)} onSave={() => onSave(spendRule(mode, Number(amount)))} onCancel={onCancel}>
      <Segmented
        label={t('marketingHub.editor.spend.title')}
        value={mode}
        onValueChange={setMode}
        options={[
          { value: 'moreThan', label: t('marketingHub.editor.spend.moreThan') },
          { value: 'lessThan', label: t('marketingHub.editor.spend.lessThan') },
        ]}
      />
      <NumberField label={t('marketingHub.editor.spend.amount')} value={amount} onChange={setAmount} suffix="€" />
    </Frame>
  );
}

function IncludeToggle({ include, onChange }: { include: boolean; onChange: (include: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <Segmented
      label={t('marketingHub.editor.includeLabel')}
      value={include ? 'in' : 'out'}
      onValueChange={(value) => onChange(value === 'in')}
      options={[
        { value: 'in', label: t('marketingHub.editor.include') },
        { value: 'out', label: t('marketingHub.editor.exclude') },
      ]}
    />
  );
}

function ChoiceListEditor({
  fieldId,
  title,
  options,
  initial,
  onSave,
  onCancel,
}: {
  fieldId: ListFieldId;
  title: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  initial?: ConditionRule;
  onSave: (rule: ConditionRule) => void;
  onCancel: () => void;
}) {
  const current = initial ? readList(initial) : null;
  const [include, setInclude] = useState(current?.include ?? true);
  const [values, setValues] = useState<string[]>(current?.values ?? []);
  const toggle = (value: string) => setValues((items) => (items.includes(value) ? items.filter((item) => item !== value) : [...items, value]));
  return (
    <Frame title={title} canSave={values.length > 0} onSave={() => onSave(listRule(fieldId, include, values))} onCancel={onCancel}>
      <IncludeToggle include={include} onChange={setInclude} />
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <ToggleChip key={option.value} pressed={values.includes(option.value)} onToggle={() => toggle(option.value)}>
            {option.label}
          </ToggleChip>
        ))}
      </div>
    </Frame>
  );
}

function TextListEditor({
  fieldId,
  title,
  placeholder,
  initial,
  onSave,
  onCancel,
}: {
  fieldId: ListFieldId;
  title: string;
  placeholder: string;
  initial?: ConditionRule;
  onSave: (rule: ConditionRule) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const inputId = useId();
  const current = initial ? readList(initial) : null;
  const [include, setInclude] = useState(current?.include ?? true);
  const [values, setValues] = useState<string[]>(current?.values ?? []);
  const [text, setText] = useState('');
  const add = () => {
    const value = text.trim();
    if (value && !values.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) setValues([...values, value]);
    setText('');
  };
  return (
    <Frame title={title} canSave={values.length > 0} onSave={() => onSave(listRule(fieldId, include, values))} onCancel={onCancel}>
      <IncludeToggle include={include} onChange={setInclude} />
      <div className="space-y-1.5">
        <Label htmlFor={inputId}>{title}</Label>
        <div className="flex gap-2">
          <Input
            id={inputId}
            value={text}
            placeholder={placeholder}
            maxLength={60}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                add();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={add} disabled={!text.trim()}>
            <Plus aria-hidden="true" className="size-4" />
            {t('marketingHub.editor.add')}
          </Button>
        </div>
      </div>
      {values.length > 0 ? (
        <ul role="list" className="flex flex-wrap gap-2">
          {values.map((value) => (
            <li key={value}>
              <button
                type="button"
                onClick={() => setValues(values.filter((item) => item !== value))}
                aria-label={t('marketingHub.editor.removeValue', { value })}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-foreground px-3.5 text-sm font-medium text-background pointer-coarse:min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {value}
                <X aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Frame>
  );
}

export function RuleEditor({ kind, ...props }: EditorProps & { kind: FilterKind }) {
  const { t } = useTranslation();
  switch (kind) {
    case 'stays':
      return <StaysEditor {...props} />;
    case 'lastStay':
      return <LastStayEditor {...props} />;
    case 'spend':
      return <SpendEditor {...props} />;
    case 'stage':
      return (
        <ChoiceListEditor
          fieldId="stage"
          title={t('marketingHub.editor.stage.title')}
          options={STAGES.map((stage) => ({ value: stage, label: t(`marketingHub.stage.${stage}`) }))}
          initial={props.initial}
          onSave={props.onSave}
          onCancel={props.onCancel}
        />
      );
    case 'language':
      return (
        <ChoiceListEditor
          fieldId="language"
          title={t('marketingHub.editor.language.title')}
          options={GUEST_LANGUAGES.map((code) => ({ value: code, label: t(`marketingHub.language.${code}`) }))}
          initial={props.initial}
          onSave={props.onSave}
          onCancel={props.onCancel}
        />
      );
    case 'properties':
      return (
        <ChoiceListEditor
          fieldId="propertyHistory"
          title={t('marketingHub.editor.properties.title')}
          options={props.properties.map((property) => ({ value: property.id, label: property.name }))}
          initial={props.initial}
          onSave={props.onSave}
          onCancel={props.onCancel}
        />
      );
    case 'country':
      return (
        <TextListEditor
          fieldId="country"
          title={t('marketingHub.editor.country.title')}
          placeholder={t('marketingHub.editor.country.placeholder')}
          initial={props.initial}
          onSave={props.onSave}
          onCancel={props.onCancel}
        />
      );
    case 'tag':
      return (
        <TextListEditor
          fieldId="tag"
          title={t('marketingHub.editor.tag.title')}
          placeholder={t('marketingHub.editor.tag.placeholder')}
          initial={props.initial}
          onSave={props.onSave}
          onCancel={props.onCancel}
        />
      );
  }
}
