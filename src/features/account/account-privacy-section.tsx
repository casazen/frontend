import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { gdprApi } from '@/api/gdpr.api';
import { PlainSection } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { supportConfig } from '@/config/support.config';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs } from '@/lib/file-download';

/** The day in the name of the file (`2026-10-29`), in the time of the person who downloads. */
function dayStamp(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * «Privacy e dati» of the settings of the account (AM-08b-c): the owner and the administrators download, right now, a file with the
 * fiscal data of the organization, the people of the team and (for who may read it) the activity log: `GET /api/gdpr/org/export`, a
 * JSON the server builds under its own permission (`OrgBillingAdmin`), saved as it comes. The file holds personal data, so its name
 * has none (no name of the org, no address) and nothing of it is kept in the page. To close the account or have data erased the page
 * points to the support of the build configuration, when there is one: no address is made up.
 */
export function AccountPrivacySection() {
  const { t } = useTranslation();
  const download = useMutation({
    mutationFn: () => gdprApi.exportOrgFiscal(),
    onSuccess: (data) => {
      const file = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      saveBlobAs(file, `${t('accountSettings.privacy.fileName')}-${dayStamp(new Date())}.json`);
      toast.success(t('accountSettings.privacy.done'));
    },
    onError: (error) => toast.error(getProblemMessage(error, t) ?? t('accountSettings.privacy.failed')),
  });

  return (
    <PlainSection title={t('accountSettings.privacy.title')} data-testid="account-settings-privacy">
      <p className="text-sm text-foreground/70">{t('accountSettings.privacy.body')}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          loading={download.isPending}
          onClick={() => download.mutate()}
          data-testid="account-export-org-data"
        >
          <Download aria-hidden="true" className="size-4" />
          {t('accountSettings.privacy.export')}
        </Button>
        <p className="min-w-0 break-words text-sm text-foreground/70">{t('accountSettings.privacy.hint')}</p>
      </div>
      {supportConfig.email ? (
        <p className="break-words text-sm text-foreground/70" data-testid="account-privacy-support">
          {t('accountSettings.privacy.support')}{' '}
          <a href={`mailto:${supportConfig.email}`} className="font-medium text-primary-text underline underline-offset-2">
            {supportConfig.email}
          </a>
        </p>
      ) : null}
    </PlainSection>
  );
}
