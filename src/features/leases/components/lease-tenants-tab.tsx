import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import type { LeaseDetail } from '@/types';
import { PartyList } from './lease-data-tab';

/** Only the tenants of this contract, using the masked data returned by the server. */
export function LeaseTenantsTab({ lease, onRequestErasure }: { lease: LeaseDetail; onRequestErasure?: () => void }) {
  const { t } = useTranslation();
  const action = onRequestErasure ? {
    actionLabel: t('leaseLifecycle.erasure.action'),
    onAction: onRequestErasure,
    actionTestId: 'lease-tenants-erasure-action',
  } : {};
  return (
    <PlainSection title={t('nav.longRentTenants')} data-testid="lease-tenants" {...action}>
      <PartyList parties={(lease.parties ?? []).filter((party) => party.role === 'Tenant')} />
    </PlainSection>
  );
}
