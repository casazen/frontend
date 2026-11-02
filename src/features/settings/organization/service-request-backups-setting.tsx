import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { isFeatureEnabled } from '@/config/feature-flags';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useOrgServiceRequestSettings, useUpdateOrgServiceRequestSettings } from './use-org-settings';

/**
 * The org's choice for its requests to suppliers (SP-BKP): whether a request also goes to up to three backup suppliers, declared as such,
 * with the chosen supplier keeping an hour to answer. Saved as the switch is moved (it is its own resource, not part of the form above it).
 * Only for the org billing administrator (the page that holds it already asks for one) and only while the server has the rule on; a
 * single request can still say otherwise (the choice in the guided request).
 */
export function ServiceRequestBackupsSetting() {
  const { t } = useTranslation();
  const { flags } = useFeatureFlags();
  const available = isFeatureEnabled(flags, 'supplierRequestBackups');
  const settings = useOrgServiceRequestSettings(available);
  const update = useUpdateOrgServiceRequestSettings();

  if (!available || !settings.data) return null;

  return (
    <section className="mt-8 min-w-0 space-y-3 border-t pt-6" aria-labelledby="org-backups-title" data-testid="org-backups-section">
      <h2 id="org-backups-title" className="text-base font-semibold">
        {t('orgSettings.backups.title')}
      </h2>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <Label htmlFor="org-backups-switch">{t('orgSettings.backups.label')}</Label>
          <p id="org-backups-help" className="break-words text-sm text-foreground/70">
            {t('orgSettings.backups.help')}
          </p>
        </div>
        <Switch
          id="org-backups-switch"
          aria-describedby="org-backups-help"
          data-testid="org-backups-switch"
          checked={settings.data.useBackupSuppliers}
          disabled={update.isPending}
          onCheckedChange={(checked) => update.mutate({ useBackupSuppliers: checked })}
        />
      </div>
    </section>
  );
}
