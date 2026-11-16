import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { PAGE_COLUMNS_WIDE } from '@/components/layout/page-columns';
import { HostInviteForm } from '@/features/invites/host-invite-form';
import { HostInvitesList } from '@/features/invites/host-invites-list';

/** Super admin invites the founder of a new agency. Teams are managed by the agency itself. */
export function AdminInvitesPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6" data-testid="admin-invites-page">
      <PageHeader title={t('admin.invites.title')} description={t('admin.staffInvite.description')} />
      <p className="rounded-lg border bg-muted/40 p-4 text-sm">{t('admin.staffInvite.hint')}</p>
      <div className={PAGE_COLUMNS_WIDE}>
        <HostInviteForm scope="admin" />
        <HostInvitesList scope="admin" />
      </div>
    </div>
  );
}
