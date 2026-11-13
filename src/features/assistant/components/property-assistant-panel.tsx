import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  SIGNATURE_MAX_LENGTH,
  assistantProblemMessage,
  hasPropertyExceptions,
  hoursApi,
  hoursInput,
  hoursProblem,
  isNotFound,
  relaxedThreshold,
  relaxedTopics,
  topicOptions,
  topicText,
} from '@/features/assistant/lib/assistant-model';
import {
  useAssistantRules,
  usePropertyAssistantSettings,
  useRemovePropertyAssistantSettings,
  useSavePropertyAssistantSettings,
} from '@/queries/use-assistant-settings';
import {
  ASSISTANT_TONES,
  type AssistantRules,
  type AssistantTone,
  type PropertyAssistantSettings,
  type SavePropertyAssistantSettingsRequest,
} from '@/types/assistant-settings.types';
import { KnowledgeList } from './knowledge-list';
import { SettingsError, SettingsLoading, SettingsNoAccess, SettingsNotFound } from './settings-states';

type Mode = 'inherit' | 'own';

/**
 * Whether the rules of the organization are known to the form: what an exception loosens can be said only against them, so a save is offered only when they are `ready`
 * (still being read, `loading`; not readable, `failed`; the person may not read them, `forbidden`).
 */
type RulesStatus = 'ready' | 'loading' | 'failed' | 'forbidden';

/** What the form of the exceptions holds: every field starts as «as the organization» until it is changed. */
interface ExceptionFields {
  enabled: 'inherit' | 'off' | 'on';
  tone: AssistantTone | 'inherit';
  signatureMode: Mode;
  signature: string;
  hoursMode: Mode;
  hoursFrom: string;
  hoursTo: string;
  topicsMode: Mode;
  forbiddenTopics: string[];
}

function fieldsOf(settings: PropertyAssistantSettings): ExceptionFields {
  return {
    enabled: settings.enabled === null ? 'inherit' : settings.enabled ? 'on' : 'off',
    tone: settings.tone ?? 'inherit',
    signatureMode: settings.signature !== null ? 'own' : 'inherit',
    signature: settings.signature ?? '',
    hoursMode: settings.hoursFrom !== null || settings.hoursTo !== null ? 'own' : 'inherit',
    hoursFrom: hoursInput(settings.hoursFrom),
    hoursTo: hoursInput(settings.hoursTo),
    topicsMode: settings.forbiddenTopics !== null ? 'own' : 'inherit',
    forbiddenTopics: [...(settings.forbiddenTopics ?? [])],
  };
}

/** The body of the save: the WHOLE set of the exceptions (a `null` field is «as the organization»); the threshold of confidence is sent back as it was read. */
function requestOf(fields: ExceptionFields, settings: PropertyAssistantSettings): SavePropertyAssistantSettingsRequest {
  return {
    enabled: fields.enabled === 'inherit' ? null : fields.enabled === 'on',
    tone: fields.tone === 'inherit' ? null : fields.tone,
    signature: fields.signatureMode === 'own' && fields.signature.trim().length > 0 ? fields.signature.trim() : null,
    hoursFrom: fields.hoursMode === 'own' ? hoursApi(fields.hoursFrom) : null,
    hoursTo: fields.hoursMode === 'own' ? hoursApi(fields.hoursTo) : null,
    confidenceThreshold: settings.confidenceThreshold,
    forbiddenTopics: fields.topicsMode === 'own' ? fields.forbiddenTopics : null,
  };
}

function problemsOf(fields: ExceptionFields): Partial<Record<'signature' | 'hours', string>> {
  const problems: Partial<Record<'signature' | 'hours', string>> = {};
  if (fields.signatureMode === 'own') {
    const length = fields.signature.trim().length;
    if (length === 0) problems.signature = 'assistant.property.error.signatureRequired';
    else if (length > SIGNATURE_MAX_LENGTH) problems.signature = 'assistant.rules.error.signatureTooLong';
  }
  if (fields.hoursMode === 'own') {
    const hours = hoursProblem(fields.hoursFrom, fields.hoursTo);
    if (fields.hoursFrom.length === 0 && fields.hoursTo.length === 0) problems.hours = 'assistant.property.error.hoursRequired';
    else if (hours === 'bothEnds') problems.hours = 'assistant.rules.error.hoursBothEnds';
    else if (hours === 'sameTime') problems.hours = 'assistant.rules.error.hoursSameTime';
  }
  return problems;
}

interface ExceptionsFormProps {
  propertyId: string;
  settings: PropertyAssistantSettings;
  /** The rules of the organization, when the person may read them: the value an exception falls back to, and what an exception loosens. */
  rules: AssistantRules | undefined;
  canEdit: boolean;
  /**
   * The two mutations belong to `PropertyAssistantPanel`, not to this form: the form is started again whenever the server holds other exceptions (after a save, or when
   * somebody else changed them), and a refusal that lived inside it (the 409, or the exceptions that changed while it was open) would be gone with the remount.
   */
  save: ReturnType<typeof useSavePropertyAssistantSettings>;
  reset: ReturnType<typeof useRemovePropertyAssistantSettings>;
  /** Whether `rules` is known (see {@link RulesStatus}): without the rules of the organization the form cannot say what an exception loosens, so it offers no save. */
  rulesStatus: RulesStatus;
  /** Reads the rules of the organization again (the retry of a reading that failed). */
  onReloadRules: () => void;
}

function ExceptionsForm({ propertyId, settings, rules, canEdit, save, reset, rulesStatus, onReloadRules }: ExceptionsFormProps) {
  const { t, i18n } = useTranslation();
  const initial = fieldsOf(settings);
  const [fields, setFields] = useState<ExceptionFields>(initial);
  const [attempted, setAttempted] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [confirmingLoosen, setConfirmingLoosen] = useState(false);

  const problems = problemsOf(fields);
  const shown = attempted ? problems : {};
  const dirty = JSON.stringify(fields) !== JSON.stringify(initial);
  const busy = save.isPending || reset.isPending;
  const rulesReady = rulesStatus === 'ready';
  const update = (patch: Partial<ExceptionFields>) => setFields((current) => ({ ...current, ...patch }));

  // What the exceptions loosen, said before it is saved and after: a looser rule of a property is never relaxed in silence.
  const loosened = relaxedTopics(rules?.forbiddenTopics ?? [], fields.topicsMode === 'own' ? fields.forbiddenTopics : null);
  const lowerThreshold = relaxedThreshold(settings.confidenceThreshold, rules?.confidenceThreshold);
  const loosens = loosened.length > 0 || lowerThreshold;
  // What the person confirms before such a save, one sentence each (the same ones the warnings above the button say).
  const loosenings = [
    ...(loosened.length > 0 ? [t('assistant.property.relaxedTopics', { topics: loosened.map((name) => topicText(name, t, i18n)).join(', ') })] : []),
    ...(lowerThreshold ? [t('assistant.property.relaxedThreshold', { value: settings.confidenceThreshold, organization: rules?.confidenceThreshold })] : []),
  ];

  const asOrganization = (value: string | null) =>
    value === null ? t('assistant.property.asOrganization') : t('assistant.property.asOrganizationValue', { value });
  const organizationHours =
    rules === undefined ? null : rules.hoursFrom === null && rules.hoursTo === null ? t('assistant.rules.hours.anyTime') : `${hoursInput(rules.hoursFrom)} - ${hoursInput(rules.hoursTo)}`;
  const organizationTopics =
    rules === undefined ? null : rules.forbiddenTopics.length === 0 ? t('assistant.property.noTopics') : rules.forbiddenTopics.map((name) => topicText(name, t, i18n)).join(', ');

  // `base` is what this form started from: the save reads the exceptions again and sends nothing if somebody else changed them meanwhile.
  const send = () => save.mutate({ propertyId, request: requestOf(fields, settings), base: settings });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (!canEdit || !rulesReady || Object.keys(problems).length > 0) return;
    // A rule looser than the organization's is never saved with one click: the person confirms what it loosens first (the dialog is outside this form).
    if (loosens) {
      setConfirmingLoosen(true);
      return;
    }
    send();
  };

  // «Only for this property» starts from the organization's own list, so that choosing it does not forbid nothing: the person unticks what this property allows.
  const chooseTopicsMode = (topicsMode: Mode) =>
    update(topicsMode === 'own' && fields.forbiddenTopics.length === 0 ? { topicsMode, forbiddenTopics: [...(rules?.forbiddenTopics ?? [])] } : { topicsMode });

  const modeOptions = (name: string): Array<{ value: Mode; label: string; testId: string; disabled: boolean }> => [
    { value: 'inherit', label: t('assistant.property.asOrganization'), testId: `assistant-${name}-inherit`, disabled: !canEdit },
    { value: 'own', label: t('assistant.property.own'), testId: `assistant-${name}-own`, disabled: !canEdit },
  ];

  return (
    <div className="space-y-4" data-testid="assistant-property-exceptions">
      <form onSubmit={handleSubmit} noValidate className="min-w-0 space-y-6" data-testid="assistant-property-form">
        {!canEdit ? (
          <Alert variant="info" role="status" icon={ShieldAlert} data-testid="assistant-property-read-only">
            {t('assistant.readOnly.property')}
          </Alert>
        ) : null}

        {rules && !rules.enabled ? (
          <Alert variant="info" data-testid="assistant-org-off">
            {t('assistant.property.organizationOff')}
          </Alert>
        ) : null}

        <fieldset className="min-w-0 space-y-6" disabled={!canEdit}>
          <Field label={t('assistant.property.enabled.label')} hint={t('assistant.property.enabled.help')}>
            <Select value={fields.enabled} onChange={(event) => update({ enabled: event.target.value as ExceptionFields['enabled'] })} data-testid="assistant-property-enabled">
              <option value="inherit">{t('assistant.property.asOrganization')}</option>
              <option value="off">{t('assistant.property.enabled.off')}</option>
              {fields.enabled === 'on' ? <option value="on">{t('assistant.property.enabled.on')}</option> : null}
            </Select>
          </Field>

          <Field label={t('assistant.rules.tone.label')} hint={fields.tone === 'inherit' && rules ? asOrganization(t(`assistant.tone.${rules.tone}`)) : undefined}>
            <Select value={fields.tone} onChange={(event) => update({ tone: event.target.value as ExceptionFields['tone'] })} data-testid="assistant-property-tone">
              <option value="inherit">{t('assistant.property.asOrganization')}</option>
              {ASSISTANT_TONES.map((tone) => (
                <option key={tone} value={tone}>
                  {t(`assistant.tone.${tone}`)}
                </option>
              ))}
            </Select>
          </Field>

          <div className="space-y-2">
            <p className="text-sm font-medium leading-snug">{t('assistant.rules.signature.label')}</p>
            <Segmented<Mode> label={t('assistant.rules.signature.label')} value={fields.signatureMode} onValueChange={(signatureMode) => update({ signatureMode })} options={modeOptions('signature')} />
            {fields.signatureMode === 'own' ? (
              <Field label={t('assistant.property.signature.own')} counter={`${fields.signature.trim().length}/${SIGNATURE_MAX_LENGTH}`} error={shown.signature}>
                <Textarea rows={2} value={fields.signature} onChange={(event) => update({ signature: event.target.value })} data-testid="assistant-property-signature" />
              </Field>
            ) : (
              <p className="break-words text-sm text-foreground/70">{asOrganization(rules ? (rules.signature ?? t('assistant.property.noSignature')) : null)}</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium leading-snug">{t('assistant.rules.hours.label')}</p>
            <Segmented<Mode> label={t('assistant.rules.hours.label')} value={fields.hoursMode} onValueChange={(hoursMode) => update({ hoursMode })} options={modeOptions('hours')} />
            {fields.hoursMode === 'own' ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={t('assistant.rules.hours.from')} error={shown.hours}>
                  <Input type="time" value={fields.hoursFrom} onChange={(event) => update({ hoursFrom: event.target.value })} data-testid="assistant-property-hours-from" />
                </Field>
                <Field label={t('assistant.rules.hours.to')}>
                  <Input type="time" value={fields.hoursTo} onChange={(event) => update({ hoursTo: event.target.value })} data-testid="assistant-property-hours-to" />
                </Field>
              </div>
            ) : (
              <p className="break-words text-sm text-foreground/70">{asOrganization(organizationHours)}</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium leading-snug">{t('assistant.rules.forbiddenTopics.label')}</p>
            <Segmented<Mode> label={t('assistant.rules.forbiddenTopics.label')} value={fields.topicsMode} onValueChange={chooseTopicsMode} options={modeOptions('topics')} />
            {fields.topicsMode === 'own' ? (
              <fieldset className="min-w-0 space-y-2" data-testid="assistant-property-topics">
                <legend className="sr-only">{t('assistant.rules.forbiddenTopics.label')}</legend>
                <p className="break-words text-sm text-foreground/70">
                  {fields.forbiddenTopics.length === 0 ? t('assistant.property.topicsNone') : t('assistant.property.topicsSome')}
                </p>
                <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                  {topicOptions(fields.forbiddenTopics).map((name) => (
                    <label key={name} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                      <Checkbox
                        checked={fields.forbiddenTopics.includes(name)}
                        onCheckedChange={(checked) =>
                          update({ forbiddenTopics: checked === true ? [...fields.forbiddenTopics.filter((other) => other !== name), name] : fields.forbiddenTopics.filter((other) => other !== name) })
                        }
                        data-testid={`assistant-property-topic-${name}`}
                      />
                      <span className="min-w-0 break-words">{topicText(name, t, i18n)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <p className="break-words text-sm text-foreground/70">{asOrganization(organizationTopics)}</p>
            )}
          </div>
        </fieldset>

        {loosened.length > 0 ? (
          <Alert variant="warning" icon={AlertTriangle} data-testid="assistant-relaxed-topics">
            {t('assistant.property.relaxedTopics', { topics: loosened.map((name) => topicText(name, t, i18n)).join(', ') })}
          </Alert>
        ) : null}

        {settings.confidenceThreshold !== null ? (
          <div className="space-y-2" data-testid="assistant-property-threshold">
            <p className="break-words text-sm text-foreground/70">
              {t('assistant.property.threshold', { value: settings.confidenceThreshold, organization: rules?.confidenceThreshold ?? '' })}
            </p>
            {lowerThreshold ? (
              <Alert variant="warning" icon={AlertTriangle} data-testid="assistant-relaxed-threshold">
                {t('assistant.property.relaxedThreshold', { value: settings.confidenceThreshold, organization: rules?.confidenceThreshold })}
              </Alert>
            ) : null}
          </div>
        ) : null}

        {save.isError ? (
          <Alert variant="danger" role="alert" data-testid="assistant-property-save-error">
            {assistantProblemMessage(save.error, t) ?? t('assistant.property.saveFailed')}
          </Alert>
        ) : null}

        {/* Without the rules of the organization the form cannot say what an exception loosens: no save is offered until they are read, and the reason is said. */}
        {canEdit && rulesStatus === 'loading' ? (
          <Alert variant="info" role="status" data-testid="assistant-property-rules-loading">
            {t('assistant.property.rulesLoading')}
          </Alert>
        ) : null}
        {canEdit && rulesStatus === 'failed' ? (
          <Alert
            variant="danger"
            data-testid="assistant-property-rules-error"
            action={
              <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={onReloadRules}>
                {t('shared.errorFallback.tryAgain')}
              </Button>
            }
          >
            {t('assistant.property.rulesError')}
          </Alert>
        ) : null}
        {canEdit && rulesStatus === 'forbidden' ? (
          <Alert variant="info" data-testid="assistant-property-rules-needed">
            {t('assistant.property.rulesNeeded')}
          </Alert>
        ) : null}

        {canEdit ? (
          <div>
            <Button type="submit" className="min-h-11 w-full sm:w-auto" loading={save.isPending} disabled={!dirty || reset.isPending || !rulesReady} data-testid="assistant-property-save">
              {t('assistant.property.save')}
            </Button>
          </div>
        ) : null}
      </form>

      {/* Outside the form: a confirmation dialog inside a form would submit it. A rule looser than the organization's is saved only after this one. */}
      {canEdit ? (
        <ConfirmationDialog
          open={confirmingLoosen}
          onOpenChange={setConfirmingLoosen}
          title={t('assistant.property.loosen.title')}
          description={t('assistant.property.loosen.description')}
          confirmLabel={t('assistant.property.loosen.confirm')}
          consequences={loosenings}
          isLoading={save.isPending}
          onConfirm={send}
        />
      ) : null}

      {canEdit && hasPropertyExceptions(settings) ? (
        <div className="space-y-2">
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setConfirmingReset(true)} disabled={busy} data-testid="assistant-property-reset">
            {t('assistant.property.reset.button')}
          </Button>
          {reset.isError ? (
            <Alert variant="danger" role="alert" data-testid="assistant-property-reset-error">
              {assistantProblemMessage(reset.error, t) ?? t('assistant.property.reset.failed')}
            </Alert>
          ) : null}
          <ConfirmationDialog
            open={confirmingReset}
            onOpenChange={setConfirmingReset}
            title={t('assistant.property.reset.title')}
            description={t('assistant.property.reset.description')}
            confirmLabel={t('assistant.property.reset.confirm')}
            isLoading={reset.isPending}
            onConfirm={() => reset.mutate(propertyId, { onSettled: () => setConfirmingReset(false) })}
          />
        </div>
      ) : null}
    </div>
  );
}

interface PropertyAssistantPanelProps {
  propertyId: string;
  /** The person may read the exceptions and the knowledge of the property (`property.read`). */
  canRead: boolean;
  /** The person may change them (`property.write`). */
  canEdit: boolean;
  /** The person may read the rules of the organization (`booking.read`): what each exception falls back to. */
  canReadRules: boolean;
}

/**
 * The assistant for one property (E05/F05/US04/T02, NF-66): its switch and its exceptions to the rules of the organization (each field is «as the organization» until it is
 * changed, with the value it falls back to), then what it may say about the property. An exception can loosen what the organization forbids (a topic it forbids, a lower
 * threshold of confidence): the screen says so, never in silence. The settings are the server's: a 404 is «not found» whatever the cache holds, a reading that failed is a
 * failure, and nothing is shown before the server has answered.
 */
export function PropertyAssistantPanel({ propertyId, canRead, canEdit, canReadRules }: PropertyAssistantPanelProps) {
  const { t } = useTranslation();
  const settings = usePropertyAssistantSettings(propertyId, canRead);
  const rules = useAssistantRules(canReadRules);
  // The saves live here, above the form that is started again: their refusals outlive the reading again that follows them.
  const save = useSavePropertyAssistantSettings();
  const reset = useRemovePropertyAssistantSettings();
  // A person who may not read the rules of the organization never knows what an exception loosens (and nothing is asked of the server for them).
  const rulesStatus: RulesStatus = !canReadRules ? 'forbidden' : rules.data ? 'ready' : rules.isError ? 'failed' : 'loading';

  if (!canRead) return <SettingsNoAccess message={t('assistant.noAccess.property')} testId="assistant-property-no-access" />;
  // A 404 is «not found» even when an older answer is still in the cache (the query keeps its data on an error).
  if (settings.isError && isNotFound(settings.error)) {
    return <SettingsNotFound title={t('assistant.property.notFound')} hint={t('assistant.property.notFoundHint')} testId="assistant-property-not-found" />;
  }
  if (settings.isPending) return <SettingsLoading testId="assistant-property-loading" />;
  if (!settings.data) return <SettingsError message={t('assistant.property.loadError')} onRetry={() => void settings.refetch()} testId="assistant-property-error" />;

  return (
    <div className="min-w-0 space-y-8" data-testid="assistant-property-panel" data-property-id={propertyId}>
      {/* The form starts from what the server holds and starts again when that changes (after a save, or when someone else changed the exceptions). */}
      <ExceptionsForm key={JSON.stringify(settings.data)} propertyId={propertyId} settings={settings.data} rules={rules.data} canEdit={canEdit} save={save} reset={reset} rulesStatus={rulesStatus} onReloadRules={() => void rules.refetch()} />
      <KnowledgeList scope={{ kind: 'property', propertyId }} canRead={canRead} canEdit={canEdit} />
    </div>
  );
}
