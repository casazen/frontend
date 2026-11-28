import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  CONDITION_CHANNELS,
  CONDITION_FIELDS,
  CONDITION_OPERATOR_KEYS,
  conditionFieldOf,
  newRuleDraft,
  nextKeyOf,
  ruleShape,
  withField,
  type RuleDraft,
} from '@/lib/routine-model';
import type { RoutineConditionField, RoutineConditionOperator } from '@/types';

export interface ConditionDraft {
  operator: 'AND' | 'OR';
  rules: RuleDraft[];
}

interface RoutineConditionEditorProps {
  value: ConditionDraft;
  onChange: (next: ConditionDraft) => void;
  properties: ReadonlyArray<{ id: string; name: string }>;
  propertiesStatus: 'idle' | 'loading' | 'error' | 'ready';
}

interface ChoiceListProps {
  legend: string;
  choices: ReadonlyArray<{ value: string; label: string }>;
  chosen: readonly string[];
  onChange: (chosen: string[]) => void;
  testId: string;
}

function ChoiceList({ legend, choices, chosen, onChange, testId }: ChoiceListProps) {
  const baseId = useId();
  const toggle = (value: string, on: boolean) => onChange(on ? [...chosen, value] : chosen.filter((item) => item !== value));

  return (
    <fieldset className="min-w-0 space-y-2" data-testid={testId}>
      <legend className="sr-only">{legend}</legend>
      <div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        {choices.map((choice, index) => {
          const id = `${baseId}-${index}`;
          return (
            <div key={choice.value} className="flex min-h-11 items-center gap-2">
              <Checkbox id={id} checked={chosen.includes(choice.value)} onCheckedChange={(state) => toggle(choice.value, state === true)} />
              <Label htmlFor={id} className="min-w-0 flex-1 break-words font-normal leading-snug">
                {choice.label}
              </Label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * The condition of a routine (ADR-014, ADR-022-R12): rules joined by «tutte» or «almeno una». It offers the five fields a routine reads (`CONDITION_FIELDS`) and, for each, the
 * operators it takes and a value of the kind the operator takes (properties and channels are chosen, counts are whole numbers), so that what is written is always a condition the
 * server accepts. Without a rule the routine runs for every booking.
 */
export function RoutineConditionEditor({ value, onChange, properties, propertiesStatus }: RoutineConditionEditorProps) {
  const { t } = useTranslation();
  const baseId = useId();

  const setRule = (key: number, change: (rule: RuleDraft) => RuleDraft) =>
    onChange({ ...value, rules: value.rules.map((rule) => (rule.key === key ? change(rule) : rule)) });

  const knownProperties = new Set(properties.map((property) => property.id));

  return (
    <div className="space-y-3" data-testid="condition-editor">
      {value.rules.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="condition-none">
          {t('routines.condition.none')}
        </p>
      ) : (
        <ul className="space-y-3">
          {value.rules.map((rule, index) => {
            const field = conditionFieldOf(rule.fieldId);
            const shape = ruleShape(rule);
            const id = `${baseId}-${rule.key}`;
            const position = index + 1;

            return (
              <li key={rule.key} className="space-y-3 rounded-md border p-3" data-testid={`condition-rule-${index}`}>
                <div className="flex items-start gap-2">
                  <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                    <Select
                      aria-label={t('routines.condition.fieldOf', { position })}
                      value={rule.fieldId}
                      onChange={(event) => setRule(rule.key, (current) => withField(current, event.target.value as RoutineConditionField))}
                      data-testid={`condition-field-${index}`}
                    >
                      {CONDITION_FIELDS.map((candidate) => (
                        <option key={candidate.fieldId} value={candidate.fieldId}>
                          {t(candidate.labelKey)}
                        </option>
                      ))}
                    </Select>
                    <Select
                      aria-label={t('routines.condition.operatorOf', { position })}
                      value={rule.operator}
                      onChange={(event) => setRule(rule.key, (current) => ({ ...current, operator: event.target.value as RoutineConditionOperator }))}
                      data-testid={`condition-operator-${index}`}
                    >
                      {field.operators.map((operator) => (
                        <option key={operator} value={operator}>
                          {t(CONDITION_OPERATOR_KEYS[operator])}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('routines.condition.removeRule', { position })}
                    onClick={() => onChange({ ...value, rules: value.rules.filter((candidate) => candidate.key !== rule.key) })}
                    data-testid={`condition-remove-${index}`}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>

                {field.kind === 'properties' && (
                  <>
                    {propertiesStatus === 'loading' && <p className="text-sm text-muted-foreground">{t('routines.condition.propertiesLoading')}</p>}
                    {propertiesStatus === 'error' && <p className="text-sm text-destructive">{t('routines.condition.propertiesError')}</p>}
                    <ChoiceList
                      legend={t('routines.condition.valueOf', { position })}
                      testId={`condition-value-${index}`}
                      choices={[
                        ...properties.map((property) => ({ value: property.id, label: property.name })),
                        // A property the rule names that the host no longer has stays in the list so that it can be unticked.
                        ...rule.list
                          .filter((propertyId) => propertiesStatus === 'ready' && !knownProperties.has(propertyId))
                          .map((propertyId) => ({ value: propertyId, label: t('routines.condition.unknownProperty') })),
                      ]}
                      chosen={rule.list}
                      onChange={(list) => setRule(rule.key, (current) => ({ ...current, list }))}
                    />
                  </>
                )}

                {field.kind === 'channel' && shape === 'list' && (
                  <ChoiceList
                    legend={t('routines.condition.valueOf', { position })}
                    testId={`condition-value-${index}`}
                    choices={CONDITION_CHANNELS.map((channel) => ({ value: channel.name, label: t(channel.labelKey) }))}
                    chosen={rule.list}
                    onChange={(list) => setRule(rule.key, (current) => ({ ...current, list }))}
                  />
                )}

                {field.kind === 'channel' && shape === 'single' && (
                  <Select
                    aria-label={t('routines.condition.valueOf', { position })}
                    value={rule.single}
                    onChange={(event) => setRule(rule.key, (current) => ({ ...current, single: event.target.value }))}
                    data-testid={`condition-value-${index}`}
                  >
                    <option value="">{t('routines.condition.chooseChannel')}</option>
                    {CONDITION_CHANNELS.map((channel) => (
                      <option key={channel.name} value={channel.name}>
                        {t(channel.labelKey)}
                      </option>
                    ))}
                  </Select>
                )}

                {field.kind === 'count' && shape === 'single' && (
                  <div className="space-y-1">
                    <Label htmlFor={`${id}-single`}>{t(`routines.condition.unit.${rule.fieldId}`)}</Label>
                    <Input
                      id={`${id}-single`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      value={rule.single}
                      onChange={(event) => setRule(rule.key, (current) => ({ ...current, single: event.target.value }))}
                      data-testid={`condition-value-${index}`}
                    />
                  </div>
                )}

                {field.kind === 'count' && shape === 'range' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor={`${id}-low`}>{t('routines.condition.from')}</Label>
                      <Input
                        id={`${id}-low`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={rule.low}
                        onChange={(event) => setRule(rule.key, (current) => ({ ...current, low: event.target.value }))}
                        data-testid={`condition-low-${index}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`${id}-high`}>{t('routines.condition.to')}</Label>
                      <Input
                        id={`${id}-high`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={rule.high}
                        onChange={(event) => setRule(rule.key, (current) => ({ ...current, high: event.target.value }))}
                        data-testid={`condition-high-${index}`}
                      />
                    </div>
                  </div>
                )}

                {rule.fieldId === 'bookingLeadTime' && (
                  <p className="text-sm text-muted-foreground" data-testid={`condition-lead-time-note-${index}`}>
                    {t('routines.condition.leadTimeNote')}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {value.rules.length > 1 && (
        <div className="space-y-1">
          <Label htmlFor={`${baseId}-match`}>{t('routines.condition.match')}</Label>
          <Select
            id={`${baseId}-match`}
            value={value.operator}
            onChange={(event) => onChange({ ...value, operator: event.target.value === 'OR' ? 'OR' : 'AND' })}
            data-testid="condition-match"
          >
            <option value="AND">{t('routines.condition.matchAll')}</option>
            <option value="OR">{t('routines.condition.matchAny')}</option>
          </Select>
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange({ ...value, rules: [...value.rules, newRuleDraft(nextKeyOf(value.rules))] })}
        data-testid="add-condition-button"
      >
        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
        {t('routines.condition.add')}
      </Button>
    </div>
  );
}
