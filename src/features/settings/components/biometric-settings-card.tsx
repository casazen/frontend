import { useState, type FormEvent } from 'react';
import { ChevronDown, ScanFace } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SkeletonLine } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { isFeatureEnabled } from '@/config/feature-flags';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getProblemMessage } from '@/lib/api-errors';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import {
  BIOMETRIC_ACCEPT_MAX,
  BIOMETRIC_ATTEMPTS_MAX,
  BIOMETRIC_ATTEMPTS_MIN,
  BIOMETRIC_ESCALATE_MIN,
  type BiometricModelStatus,
  type BiometricSettings,
} from '@/types/biometric-settings.types';
import {
  formOf,
  isChanged,
  isPlatformAdmin,
  modelReasonKey,
  modelStateKey,
  requestOf,
  validateBiometricForm,
  type BiometricForm,
  type BiometricFormErrors,
} from '../lib/biometric-settings-model';
import { useBiometricCardBusy, useBiometricModelsStatus, useBiometricSettings, useUpdateBiometricSettings } from '../use-biometric-settings';
import { IdentitySegmentsSection } from './identity-segments-section';

function boundText(value: number, language: string): string {
  return new Intl.NumberFormat(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function calibratedOn(value: string | null, language: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : new Intl.DateTimeFormat(language, { dateStyle: 'long' }).format(date);
}

function ModelRow({ model }: { model: BiometricModelStatus }) {
  const { t } = useTranslation();
  const failed = model.state === 'failed';

  return (
    <li className="flex flex-wrap items-start justify-between gap-2 text-sm" data-testid="biometric-model" data-state={model.state}>
      <div className="min-w-0">
        <p className="font-medium">
          {model.name} <span className="font-normal text-foreground/70">{model.version}</span>
        </p>
        {failed && model.code && <p className="text-foreground/70">{t(modelReasonKey(model.code))}</p>}
        <p className="text-xs text-foreground/70">{t(model.pinned ? 'biometricSettings.models.pinned' : 'biometricSettings.models.notPinned')}</p>
      </div>
      <Badge variant={model.state === 'ready' || model.state === 'present' ? 'success' : failed ? 'warning' : 'secondary'}>{t(modelStateKey(model.state))}</Badge>
    </li>
  );
}

function ModelsStatus() {
  const { t } = useTranslation();
  const status = useBiometricModelsStatus(true);

  return (
    <div className="space-y-3 border-t pt-4" data-testid="biometric-models">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{t('biometricSettings.models.title')}</h3>
        <p className="text-sm text-foreground/70">{t('biometricSettings.models.description')}</p>
      </div>

      {status.isError ? (
        <Alert variant="warning" data-testid="biometric-models-error">
          {t('biometricSettings.models.loadError')}
        </Alert>
      ) : status.isPending ? (
        <SkeletonLine lines={2} lineClassName="h-5" />
      ) : (
        <>
          <p className="text-sm" data-testid="biometric-models-state" data-state={status.data.state}>
            {t('biometricSettings.models.summary', { state: t(modelStateKey(status.data.state)) })}
            {status.data.reasonCode ? ` ${t(modelReasonKey(status.data.reasonCode))}` : ''}
          </p>
          <ul className="space-y-3">
            {status.data.models.map((model) => (
              <ModelRow key={`${model.role}-${model.name}`} model={model} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function BiometricSettingsForm({ settings }: { settings: BiometricSettings }) {
  const { t, i18n } = useTranslation();
  const update = useUpdateBiometricSettings();
  const busy = useBiometricCardBusy() || update.isPending;
  const [form, setForm] = useState<BiometricForm>(() => formOf(settings));
  const [synced, setSynced] = useState<BiometricSettings>(settings);
  const [tried, setTried] = useState(false);
  if (settings !== synced) {
    setSynced(settings);
    setForm(formOf(settings));
    setTried(false);
  }

  const errors = validateBiometricForm(form);
  const shown: BiometricFormErrors = tried ? errors : {};
  const edit = (change: Partial<BiometricForm>) => {
    setForm((current) => ({ ...current, ...change }));
    if (update.isError) update.reset();
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    if (busy || Object.keys(errors).length > 0 || !isChanged(form, settings)) return;
    update.mutate(requestOf(form));
  };

  const errorText = (field: keyof BiometricFormErrors) => {
    const error = shown[field];
    return error ? t(`biometricSettings.errors.${error}`, { min: boundText(BIOMETRIC_ESCALATE_MIN, i18n.language), max: boundText(BIOMETRIC_ACCEPT_MAX, i18n.language) }) : undefined;
  };
  const calibrated = settings.provisional ? undefined : calibratedOn(settings.calibratedAt, i18n.language);

  return (
    <form onSubmit={save} noValidate className="space-y-5" data-testid="biometric-settings-form">
      <div className="flex items-start justify-between gap-4 rounded-xl bg-muted/40 p-4">
        <div className="min-w-0 space-y-1">
          <Label htmlFor="biometric-enabled">{t('biometricSettings.enabled.label')}</Label>
          <p id="biometric-enabled-help" className="break-words text-sm text-foreground/70">
            {t('biometricSettings.enabled.help')}
          </p>
        </div>
        <Switch
          id="biometric-enabled"
          aria-describedby="biometric-enabled-help"
          data-testid="biometric-enabled"
          checked={form.enabled}
          disabled={busy}
          onCheckedChange={(checked) => edit({ enabled: checked })}
        />
      </div>

      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label={t('biometricSettings.accept.label')} hint={t('biometricSettings.accept.help')} error={errorText('accept')}>
          <Input
            data-testid="biometric-accept"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={BIOMETRIC_ESCALATE_MIN}
            max={BIOMETRIC_ACCEPT_MAX}
            value={form.accept}
            disabled={busy}
            onChange={(event) => edit({ accept: event.target.value })}
          />
        </Field>

        <Field label={t('biometricSettings.escalate.label')} hint={t('biometricSettings.escalate.help')} error={errorText('escalate')}>
          <Input
            data-testid="biometric-escalate"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={BIOMETRIC_ESCALATE_MIN}
            max={BIOMETRIC_ACCEPT_MAX}
            value={form.escalate}
            disabled={busy}
            onChange={(event) => edit({ escalate: event.target.value })}
          />
        </Field>

      </div>
      <p className="text-sm text-foreground/70">
        {t('biometricSettings.thresholdsRange', { min: boundText(BIOMETRIC_ESCALATE_MIN, i18n.language), max: boundText(BIOMETRIC_ACCEPT_MAX, i18n.language) })}
      </p>

      <Field label={t('biometricSettings.attempts.label')} hint={t('biometricSettings.attempts.help', { min: BIOMETRIC_ATTEMPTS_MIN, max: BIOMETRIC_ATTEMPTS_MAX })} error={errorText('attempts')}>
        <Input
          data-testid="biometric-attempts"
          type="number"
          inputMode="numeric"
          step="1"
          min={BIOMETRIC_ATTEMPTS_MIN}
          max={BIOMETRIC_ATTEMPTS_MAX}
          value={form.attempts}
          disabled={busy}
          onChange={(event) => edit({ attempts: event.target.value })}
        />
      </Field>

      {settings.provisional ? (
        <p className="text-sm text-foreground/70" data-testid="biometric-provisional-explain">
          {t('biometricSettings.provisional.explain')}
        </p>
      ) : calibrated ? (
        <p className="text-sm text-foreground/70" data-testid="biometric-calibrated">
          {t('biometricSettings.calibrated', { date: calibrated })}
        </p>
      ) : null}

      {settings.isDefault && (
        <p className="text-sm text-foreground/70" data-testid="biometric-default">
          {t('biometricSettings.defaults')}
        </p>
      )}

      {update.isError && (
        <Alert variant="danger" data-testid="biometric-save-error">
          {getProblemMessage(update.error, t) ?? t('biometricSettings.saveFailed')}
        </Alert>
      )}

      <Button type="submit" loading={update.isPending} disabled={busy || !isChanged(form, settings)} data-testid="biometric-save">
        {t('biometricSettings.save')}
      </Button>
    </form>
  );
}

/**
 * The card «Verifica dell'identità» of the organization settings (E22/F02/US01/T02, NF-24, NF-50, ADR-013-R13): the face check on or off, the two thresholds in plain words (above the first
 * the face is accepted alone, under it a person decides; at the second the attempt does not pass), the attempts of a guest, and the label «provvisorie» until a platform administrator marks the
 * calibration. Platform administrators also see the models: name, state and why one cannot be used. Only for the org billing administrator and only while the identity verification is on; with
 * the flag off the card does not exist and nothing is asked. A save the server refuses (a bound that failed) says so, and nothing is saved.
 *
 * While the self-hosted verification is on too (`checkInIdentitySelfHosted`, E70/F03/US01/T02) the card also holds its segments (`IdentitySegmentsSection`): where the policy only observes, where it may approve
 * by itself and where it is suspended. With that flag off the card is the one it always was.
 */
export function BiometricSettingsCard({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { flags } = useFeatureFlags();
  const { contexts } = useWorkspace();
  const available = isFeatureEnabled(flags, 'checkInIdentityVerification') && isOrgBillingAdmin(contexts);
  const settings = useBiometricSettings(available);

  if (!available) return null;

  const controls = (
    <div className="max-w-3xl space-y-4">
      {settings.isError ? (
        <Alert
          variant="danger"
          data-testid="biometric-settings-error"
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => void settings.refetch()}>
              {t('biometricSettings.retry')}
            </Button>
          }
        >
          {t('biometricSettings.loadError')}
        </Alert>
      ) : settings.isPending ? (
        <div data-testid="biometric-settings-loading">
          <SkeletonLine lines={3} lineClassName="h-10" />
        </div>
      ) : (
        <BiometricSettingsForm settings={settings.data} />
      )}

      <IdentitySegmentsSection />

      {isPlatformAdmin(contexts) && <ModelsStatus />}
    </div>
  );

  return (
    <section className="min-w-0 space-y-3 rounded-2xl border bg-card p-5 sm:p-6" aria-labelledby="biometric-settings-title" data-testid="biometric-settings-card">
      <div className="flex flex-wrap items-center gap-2">
        <ScanFace aria-hidden="true" className="size-5 text-primary-text" />
        <h2 id="biometric-settings-title" className="font-semibold">{t('biometricSettings.title')}</h2>
        {!settings.isError && settings.data?.provisional ? (
          <Badge variant="warning" data-testid="biometric-provisional">{t('biometricSettings.provisional.badge')}</Badge>
        ) : null}
      </div>
      {settings.data && !settings.isError && compact ? (
        <p className="text-sm">{t(settings.data.enabled ? 'aiSettings.enabledSummary' : 'aiSettings.manualSummary')}</p>
      ) : <p className="max-w-prose text-sm text-muted-foreground">{t('biometricSettings.description')}</p>}
      {compact && settings.data && !settings.isError ? (
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md text-sm font-semibold text-primary-text focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            {t('aiSettings.advancedVerification')}<ChevronDown aria-hidden="true" className="size-4 group-open:rotate-180" />
          </summary>
          {controls}
        </details>
      ) : controls}
    </section>
  );
}
