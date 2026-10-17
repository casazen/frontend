import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { ErrorState } from '@/components/shared/error-state';
import { SkeletonLine } from '@/components/ui/skeleton';
import { getProblemMessage } from '@/lib/api-errors';
import { useSaveSupplierSettings, useSupplierSettings } from '@/queries/use-supplier-settings';
import { SwitchRow } from '../services/components/service-fields';

const RULES = ['regulars', 'service', 'cancel', 'notice'] as const;

/**
 * "Accetta in automatico i clienti abituali" (SP-16c-c): the one switch of the answers. It is off for everybody until the supplier turns
 * it on, and it is saved as soon as it is touched (`PUT api/supplier/settings` takes all five settings, so the other four are sent as the
 * server gave them). The rule is told as the server applies it (SP-04d): hosts with at least three jobs already taken, a service with a
 * price and a free time, and the supplier can cancel until the job starts. If saving fails the switch goes back to what is saved.
 */
export function AutoAcceptSection() {
  const { t } = useTranslation();
  const settings = useSupplierSettings();
  const save = useSaveSupplierSettings();
  const { data } = settings;

  if (settings.isError && !data) {
    return (
      <ErrorState
        testId="supplier-settings-error"
        title={t('supplier.settings.loadError')}
        error={settings.error}
        onRetry={() => void settings.refetch()}
      />
    );
  }

  if (settings.isLoading || !data) {
    return <SkeletonLine lines={4} label={t('supplier.settings.loading')} />;
  }

  // While the save is on the way the switch shows what was asked; if it fails the data is the old one and the switch goes back.
  const checked = save.isPending ? (save.variables?.autoAcceptRegulars ?? data.autoAcceptRegulars) : data.autoAcceptRegulars;
  const toggle = (next: boolean) =>
    save.mutate({
      autoAcceptRegulars: next,
      notifyNewRequests: data.notifyNewRequests,
      notifyDayBeforeReminder: data.notifyDayBeforeReminder,
      notifyPayments: data.notifyPayments,
      respondWithinMinutes: data.respondWithinMinutes,
    });

  return (
    <PlainSection title={t('supplier.settings.answers.title')} data-testid="supplier-settings-auto-accept">
      <SwitchRow
        checked={checked}
        onCheckedChange={toggle}
        disabled={save.isPending}
        label={t('supplier.settings.autoAccept.label')}
        hint={t('supplier.settings.autoAccept.hint')}
        testId="supplier-auto-accept-switch"
      />
      <div aria-live="polite" className="min-h-5 text-sm">
        {save.isError ? (
          <p role="alert" className="font-medium text-destructive" data-testid="supplier-settings-save-error">
            {getProblemMessage(save.error, t) ?? t('supplier.settings.saveError')}
          </p>
        ) : save.isSuccess ? (
          <p role="status" className="text-foreground/70" data-testid="supplier-settings-saved">
            {t('supplier.settings.saved')}
          </p>
        ) : null}
      </div>
      <div className="space-y-1 pt-2">
        <h3 className="text-sm font-semibold">{t('supplier.settings.autoAccept.rules.title')}</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/80" data-testid="supplier-auto-accept-rules">
          {RULES.map((rule) => (
            <li key={rule} className="break-words">
              {t(`supplier.settings.autoAccept.rules.${rule}`)}
            </li>
          ))}
        </ul>
      </div>
    </PlainSection>
  );
}
