import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { assistantProblemMessage, hoursApi, hoursInput, hoursProblem, languageOptions, languageText, SIGNATURE_MAX_LENGTH, topicOptions, topicText } from '@/features/assistant/lib/assistant-model';
import { useAssistantRules, useSaveAssistantRules } from '@/queries/use-assistant-settings';
import { ASSISTANT_TONES, type AssistantRules, type AssistantTone, type SaveAssistantRulesRequest } from '@/types/assistant-settings.types';
import { SettingsError, SettingsLoading, SettingsNoAccess } from './settings-states';

/** What the form holds: the hours as an `<input type="time">` takes them, the lists as the names the server keeps. */
interface RulesFields {
  enabled: boolean;
  tone: AssistantTone;
  languages: string[];
  signature: string;
  anyTime: boolean;
  hoursFrom: string;
  hoursTo: string;
  allowedTopics: string[];
  forbiddenTopics: string[];
}

function fieldsOf(rules: AssistantRules): RulesFields {
  return {
    enabled: rules.enabled,
    tone: rules.tone,
    languages: [...rules.languages],
    signature: rules.signature ?? '',
    anyTime: rules.hoursFrom === null && rules.hoursTo === null,
    hoursFrom: hoursInput(rules.hoursFrom),
    hoursTo: hoursInput(rules.hoursTo),
    allowedTopics: [...rules.allowedTopics],
    forbiddenTopics: [...rules.forbiddenTopics],
  };
}

/**
 * The body of the save: the WHOLE set (the server takes what is not given as its default). The threshold of confidence is not on this screen (the assistant only
 * drafts in this release), but it is the server's and the rules were read with it: it is sent back as it was read, so that a save never resets it.
 */
function requestOf(fields: RulesFields, rules: AssistantRules): SaveAssistantRulesRequest {
  return {
    enabled: fields.enabled,
    tone: fields.tone,
    languages: fields.languages,
    signature: fields.signature.trim().length > 0 ? fields.signature.trim() : null,
    hoursFrom: fields.anyTime ? null : hoursApi(fields.hoursFrom),
    hoursTo: fields.anyTime ? null : hoursApi(fields.hoursTo),
    allowedTopics: fields.allowedTopics,
    forbiddenTopics: fields.forbiddenTopics,
    confidenceThreshold: rules.confidenceThreshold,
  };
}

/** What is wrong with the form (what the server would refuse as `assistant_rules_invalid`): the i18n key of the sentence under the field. */
function problemsOf(fields: RulesFields): Partial<Record<'languages' | 'signature' | 'hours', string>> {
  const problems: Partial<Record<'languages' | 'signature' | 'hours', string>> = {};
  if (fields.languages.length === 0) problems.languages = 'assistant.rules.error.languages';
  if (fields.signature.trim().length > SIGNATURE_MAX_LENGTH) problems.signature = 'assistant.rules.error.signatureTooLong';
  if (!fields.anyTime) {
    const hours = hoursProblem(fields.hoursFrom, fields.hoursTo);
    if (hours === 'bothEnds') problems.hours = 'assistant.rules.error.hoursBothEnds';
    if (hours === 'sameTime') problems.hours = 'assistant.rules.error.hoursSameTime';
  }
  return problems;
}

function toggled(list: readonly string[], name: string, on: boolean): string[] {
  return on ? [...list.filter((candidate) => candidate !== name), name] : list.filter((candidate) => candidate !== name);
}

interface ChecklistProps {
  legend: string;
  help: string;
  names: readonly string[];
  selected: readonly string[];
  label: (name: string) => string;
  disabled: boolean;
  onChange: (next: string[]) => void;
  testId: string;
}

/** A group of choices where each one is a row of 44 px: the whole row is the target of the box. */
function Checklist({ legend, help, names, selected, label, disabled, onChange, testId }: ChecklistProps) {
  return (
    <fieldset className="min-w-0 space-y-2" disabled={disabled} data-testid={testId}>
      <legend className="text-sm font-medium leading-snug">{legend}</legend>
      <p className="break-words text-sm text-foreground/70">{help}</p>
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        {names.map((name) => (
          <label key={name} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <Checkbox checked={selected.includes(name)} onCheckedChange={(checked) => onChange(toggled(selected, name, checked === true))} data-testid={`${testId}-${name}`} />
            <span className="min-w-0 break-words">{label(name)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

interface RulesFieldsFormProps {
  rules: AssistantRules;
  canEdit: boolean;
}

function RulesFieldsForm({ rules, canEdit }: RulesFieldsFormProps) {
  const { t, i18n } = useTranslation();
  const save = useSaveAssistantRules();
  const initial = fieldsOf(rules);
  const [fields, setFields] = useState<RulesFields>(initial);
  const [attempted, setAttempted] = useState(false);

  const problems = problemsOf(fields);
  const dirty = JSON.stringify(fields) !== JSON.stringify(initial);
  const shown = attempted ? problems : {};
  const update = (patch: Partial<RulesFields>) => setFields((current) => ({ ...current, ...patch }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (!canEdit || Object.keys(problems).length > 0) return;
    save.mutate(requestOf(fields, rules));
  };

  const tones: Record<AssistantTone, string> = {
    Neutral: t('assistant.tone.Neutral'),
    Friendly: t('assistant.tone.Friendly'),
    Formal: t('assistant.tone.Formal'),
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="min-w-0 space-y-6" data-testid="assistant-rules-form">
      {!canEdit ? (
        <Alert variant="info" role="status" icon={ShieldAlert} data-testid="assistant-rules-read-only">
          {t('assistant.readOnly.rules')}
        </Alert>
      ) : null}

      <fieldset className="min-w-0 space-y-6" disabled={!canEdit}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <Label htmlFor="assistant-enabled">{t('assistant.rules.enabled.label')}</Label>
            <p id="assistant-enabled-help" className="break-words text-sm text-foreground/70">
              {t('assistant.rules.enabled.help')}
            </p>
          </div>
          <Switch
            id="assistant-enabled"
            aria-describedby="assistant-enabled-help"
            data-testid="assistant-enabled-switch"
            checked={fields.enabled}
            onCheckedChange={(enabled) => update({ enabled })}
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium leading-snug">{t('assistant.rules.tone.label')}</p>
          <Segmented<AssistantTone>
            label={t('assistant.rules.tone.label')}
            value={fields.tone}
            onValueChange={(tone) => update({ tone })}
            options={ASSISTANT_TONES.map((tone) => ({ value: tone, label: tones[tone], testId: `assistant-tone-${tone}`, disabled: !canEdit }))}
          />
          <p className="break-words text-sm text-foreground/70">{t('assistant.rules.tone.help')}</p>
        </div>

        <fieldset className="min-w-0 space-y-2" data-testid="assistant-languages">
          <legend className="text-sm font-medium leading-snug">{t('assistant.rules.languages.label')}</legend>
          <p className="break-words text-sm text-foreground/70">{t('assistant.rules.languages.help')}</p>
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
            {languageOptions(fields.languages).map((code) => (
              <label key={code} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                <Checkbox
                  checked={fields.languages.includes(code)}
                  onCheckedChange={(checked) => update({ languages: toggled(fields.languages, code, checked === true) })}
                  data-testid={`assistant-language-${code}`}
                />
                <span>{languageText(code, t, i18n)}</span>
              </label>
            ))}
          </div>
          {shown.languages ? (
            <p className="text-sm text-[color:var(--color-danger-foreground,#b4232a)]" role="alert">
              {t(shown.languages)}
            </p>
          ) : null}
        </fieldset>

        <Field
          label={t('assistant.rules.signature.label')}
          hint={t('assistant.rules.signature.help')}
          counter={`${fields.signature.trim().length}/${SIGNATURE_MAX_LENGTH}`}
          error={shown.signature}
        >
          <Textarea rows={2} value={fields.signature} onChange={(event) => update({ signature: event.target.value })} data-testid="assistant-signature" />
        </Field>

        <fieldset className="min-w-0 space-y-2" data-testid="assistant-hours">
          <legend className="text-sm font-medium leading-snug">{t('assistant.rules.hours.label')}</legend>
          <p className="break-words text-sm text-foreground/70">{t('assistant.rules.hours.help')}</p>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <Checkbox checked={fields.anyTime} onCheckedChange={(checked) => update({ anyTime: checked === true })} data-testid="assistant-any-time" />
            <span>{t('assistant.rules.hours.anyTime')}</span>
          </label>
          {!fields.anyTime ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t('assistant.rules.hours.from')} error={shown.hours}>
                <Input type="time" value={fields.hoursFrom} onChange={(event) => update({ hoursFrom: event.target.value })} data-testid="assistant-hours-from" />
              </Field>
              <Field label={t('assistant.rules.hours.to')}>
                <Input type="time" value={fields.hoursTo} onChange={(event) => update({ hoursTo: event.target.value })} data-testid="assistant-hours-to" />
              </Field>
            </div>
          ) : null}
        </fieldset>

        <Checklist
          legend={t('assistant.rules.allowedTopics.label')}
          help={fields.allowedTopics.length === 0 ? t('assistant.rules.allowedTopics.none') : t('assistant.rules.allowedTopics.some')}
          names={topicOptions(fields.allowedTopics)}
          selected={fields.allowedTopics}
          label={(name) => topicText(name, t, i18n)}
          disabled={!canEdit}
          onChange={(allowedTopics) => update({ allowedTopics })}
          testId="assistant-allowed-topics"
        />

        <Checklist
          legend={t('assistant.rules.forbiddenTopics.label')}
          help={fields.forbiddenTopics.length === 0 ? t('assistant.rules.forbiddenTopics.none') : t('assistant.rules.forbiddenTopics.some')}
          names={topicOptions(fields.forbiddenTopics)}
          selected={fields.forbiddenTopics}
          label={(name) => topicText(name, t, i18n)}
          disabled={!canEdit}
          onChange={(forbiddenTopics) => update({ forbiddenTopics })}
          testId="assistant-forbidden-topics"
        />
      </fieldset>

      {save.isError ? (
        <Alert variant="danger" role="alert" data-testid="assistant-rules-save-error">
          {assistantProblemMessage(save.error, t) ?? t('assistant.rules.saveFailed')}
        </Alert>
      ) : null}

      {canEdit ? (
        <div>
          <Button type="submit" className="min-h-11 w-full sm:w-auto" loading={save.isPending} disabled={!dirty} data-testid="assistant-rules-save">
            {t('assistant.rules.save')}
          </Button>
        </div>
      ) : null}
    </form>
  );
}

interface RulesFormProps {
  /** The person may read the rules (`booking.read`); without it nothing is asked of the server. */
  canRead: boolean;
  /** The person is the administrator of the organization, the only one who may change the rules. */
  canEdit: boolean;
}

/**
 * The rules of the organization (E05/F05/US04/T02, NF-66): the switch, the tone, the languages, the signature, the hours (or «at any time») and the topics the assistant
 * may answer and the ones it must not. They are read from the server and shown as it holds them: while it has not answered there is nothing to edit, and a reading that
 * failed is a failure, never a form with defaults. Only the organization administrator changes them (the others read them, with the reason in words). An empty list of
 * allowed topics is said in plain words: no restriction, not «nothing allowed».
 */
export function RulesForm({ canRead, canEdit }: RulesFormProps) {
  const { t } = useTranslation();
  const rules = useAssistantRules(canRead);

  if (!canRead) return <SettingsNoAccess message={t('assistant.noAccess.rules')} testId="assistant-rules-no-access" />;
  if (rules.isPending) return <SettingsLoading testId="assistant-rules-loading" />;
  if (!rules.data) return <SettingsError message={t('assistant.rules.loadError')} onRetry={() => void rules.refetch()} testId="assistant-rules-error" />;

  // The form starts from what the server holds and starts again when that changes (after a save, or when someone else changed the rules).
  return <RulesFieldsForm key={JSON.stringify(rules.data)} rules={rules.data} canEdit={canEdit} />;
}
