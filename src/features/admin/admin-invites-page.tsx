import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { HostInviteForm } from '@/features/invites/host-invite-form';
import { HostInvitesList } from '@/features/invites/host-invites-list';
import { AdminSupplierInviteForm } from './admin-supplier-invite-page';
import { SupplierInvitesList } from './components/supplier-invites-list';

type InviteType = 'supplier' | 'host';
const TYPES: InviteType[] = ['supplier', 'host'];

/**
 * The one section for the invites of the platform (admin only): a selector of the type (supplier or host), the form of
 * that type and, below it, the invites of that type with state, resend and revoke. A host invite gives no role: the
 * invited person signs up as usual.
 */
export function AdminInvitesPage() {
  const { t } = useTranslation();
  const [type, setType] = useState<InviteType>('supplier');

  return (
    <div className="space-y-6" data-testid="admin-invites-page">
      <PageHeader title={t('admin.invites.title')} description={t('admin.invites.description')} />

      <div
        className="inline-flex rounded-lg bg-muted p-1"
        role="tablist"
        aria-label={t('admin.invites.typeLabel')}
      >
        {TYPES.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={type === value}
            onClick={() => setType(value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              type === value ? 'bg-background shadow' : 'text-muted-foreground hover:text-foreground'
            }`}
            data-testid={`admin-invites-type-${value}`}
          >
            {t(`admin.invites.type.${value}`)}
          </button>
        ))}
      </div>

      {type === 'supplier' ? (
        <>
          <AdminSupplierInviteForm />
          <SupplierInvitesList />
        </>
      ) : (
        <>
          <HostInviteForm scope="admin" />
          <HostInvitesList scope="admin" />
        </>
      )}
    </div>
  );
}
