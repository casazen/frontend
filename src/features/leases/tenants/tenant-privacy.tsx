import { useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Button } from '@/components/ui/button';
import { TENANT_EXPORT_FILE_NAME } from '@/api/long-rent-tenants.api';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs } from '@/lib/file-download';
import { useDownloadTenantData, useRequestTenantErasure } from '@/queries/use-long-rent-tenants';
import type { TenantErasureResult, TenantRow } from '@/types';
import { Disclosure } from '../guide/disclosure';
import { tenantName } from './tenant-format';

interface TenantPrivacySectionProps {
  tenant: TenantRow;
  onErased: (result: TenantErasureResult) => void;
}

export function TenantPrivacySection({ tenant, onErased }: TenantPrivacySectionProps) {
  const { t } = useTranslation();
  const download = useDownloadTenantData();
  const erasure = useRequestTenantErasure();
  const [confirming, setConfirming] = useState(false);
  const name = tenantName(tenant);
  const running = tenant.leases.filter((lease) => lease.stage !== 'Concluded');

  async function exportData() {
    try {
      saveBlobAs(await download.mutateAsync(tenant.id), TENANT_EXPORT_FILE_NAME);
      toast.success(t('longRentTenants.privacy.exported'));
    } catch (error) {
      toast.error(getProblemMessage(error, t) ?? t('longRentTenants.privacy.exportFailed'));
    }
  }

  async function requestErasure() {
    try {
      const result = await erasure.mutateAsync(tenant.id);
      setConfirming(false);
      onErased(result);
    } catch (error) {
      setConfirming(false);
      toast.error(getProblemMessage(error, t) ?? t('longRentTenants.privacy.erasure.failed'));
    }
  }

  const consequences = [
    t('longRentTenants.privacy.erasure.consequences.ended'),
    running.length > 0
      ? t('longRentTenants.privacy.erasure.consequences.running', { properties: running.map((lease) => lease.propertyName).join(', '), count: running.length })
      : null,
    t('longRentTenants.privacy.erasure.consequences.documents'),
    t('longRentTenants.privacy.erasure.consequences.final'),
  ].filter((line): line is string => line !== null);

  return (
    <>
      <Disclosure summary={t('longRentTenants.privacy.summary')} testId="tenant-privacy">
        <p className="text-foreground/80">{t('longRentTenants.privacy.intro', { name })}</p>
        <p className="text-foreground/70" data-testid="tenant-privacy-identity-note">
          {t('longRentTenants.privacy.identityNote')}
        </p>
        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap">
          <Button type="button" variant="outline" className="min-h-11" onClick={() => void exportData()} loading={download.isPending} data-testid="tenant-export">
            <Download aria-hidden="true" className="size-4" />
            {t('longRentTenants.privacy.export')}
          </Button>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setConfirming(true)} data-testid="tenant-erasure-action">
            <Trash2 aria-hidden="true" className="size-4" />
            {t('longRentTenants.privacy.erase')}
          </Button>
        </div>
        <p className="text-foreground/70">{t('longRentTenants.privacy.exportHint')}</p>
      </Disclosure>

      <ConfirmationDialog
        open={confirming}
        onOpenChange={(open) => !erasure.isPending && setConfirming(open)}
        title={t('longRentTenants.privacy.erasure.title')}
        description={t('longRentTenants.privacy.erasure.description', { name })}
        confirmLabel={t('longRentTenants.privacy.erasure.confirm')}
        variant="destructive"
        consequences={consequences}
        isLoading={erasure.isPending}
        onConfirm={requestErasure}
      />
    </>
  );
}
