import { Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PAGE_COLUMN, PAGE_COLUMNS_WIDE } from '@/components/layout/page-columns';
import { useHostInviteQuota } from '@/queries/use-host-invites';
import { HostInviteForm } from './host-invite-form';
import { HostInviteQuotaIndicator } from './host-invite-quota';
import { HostInvitesList } from './host-invites-list';

export function HostInvitesContent() {
  const { t } = useTranslation();
  const quota = useHostInviteQuota();
  const exhausted = quota.data !== undefined && quota.data.remaining <= 0;

  return (
    <div className="space-y-6" data-testid="host-invites-page">
      <PageHeader title={t('hostInvites.title')} description={t('hostInvites.description')} />
      <div className={PAGE_COLUMNS_WIDE}>
        <div className={PAGE_COLUMN}>
          <HostInviteQuotaIndicator />
          <HostInviteForm scope="host" blocked={exhausted} />
        </div>
        <section className="min-w-0 space-y-3" aria-labelledby="host-invites-list-title">
          <h2 id="host-invites-list-title" className="flex items-center gap-2 text-lg font-semibold">
            <Mail aria-hidden="true" className="size-5 text-primary-text" />
            {t('hostInvites.list.title')}
          </h2>
          <HostInvitesList scope="host" />
        </section>
      </div>
    </div>
  );
}

export function HostInvitesPage() {
  return (
    <AppShell>
      <HostInvitesContent />
    </AppShell>
  );
}
