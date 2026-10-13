import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { useHostInviteQuota } from '@/queries/use-host-invites';
import { HostInviteForm } from './host-invite-form';
import { HostInviteQuotaIndicator } from './host-invite-quota';
import { HostInvitesList } from './host-invites-list';

/**
 * Content of the page where a host invites other independent hosts: form (centered), daily quota and the list of their own
 * invites (full width) with resend and revoke. The short-rent route wraps it in its shell ({@link HostInvitesPage}), the
 * long-rent route gets the long-rent shell from the context layout.
 */
export function HostInvitesContent() {
  const { t } = useTranslation();
  const quota = useHostInviteQuota();
  const exhausted = quota.data !== undefined && quota.data.remaining <= 0;

  return (
    <div className="space-y-6" data-testid="host-invites-page">
      <PageHeader title={t('hostInvites.title')} description={t('hostInvites.description')} />
      <div className="mx-auto w-full max-w-2xl">
        <HostInviteQuotaIndicator />
      </div>
      <HostInviteForm scope="host" blocked={exhausted} />
      <section className="space-y-3" aria-labelledby="host-invites-list-title">
        <h2 id="host-invites-list-title" className="text-lg font-semibold">
          {t('hostInvites.list.title')}
        </h2>
        <HostInvitesList scope="host" />
      </section>
    </div>
  );
}

/** Invites of other hosts in the short-rent shell. */
export function HostInvitesPage() {
  return (
    <AppShell>
      <HostInvitesContent />
    </AppShell>
  );
}
