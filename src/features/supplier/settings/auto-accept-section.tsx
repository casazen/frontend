import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { ErrorState } from '@/components/shared/error-state';
import { SkeletonLine } from '@/components/ui/skeleton';
import { getProblemMessage } from '@/lib/api-errors';
import { useSaveSupplierSettings, useSupplierSettings } from '@/queries/use-supplier-settings';
import { SwitchRow } from '../services/components/service-fields';

const RULES = ['regulars', 'service', 'cancel', 'notice'] as const;

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
      <div className="grid grid-cols-1 gap-x-10 gap-y-2 xl:grid-cols-2 xl:items-start">
        <div className="min-w-0 space-y-2">
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
        </div>
        <div className="min-w-0 space-y-1 pt-2 xl:pt-0">
          <h3 className="text-sm font-semibold">{t('supplier.settings.autoAccept.rules.title')}</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/80" data-testid="supplier-auto-accept-rules">
            {RULES.map((rule) => (
              <li key={rule} className="break-words">
                {t(`supplier.settings.autoAccept.rules.${rule}`)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </PlainSection>
  );
}
