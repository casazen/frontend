import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LONG_RENT_TENANTS_PATH } from '../tenants/paths';
import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import type { LeaseDetail } from '@/types';
import { PartyList } from './lease-data-tab';

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
      <Button variant="outline" size="sm" asChild>
        <Link to={LONG_RENT_TENANTS_PATH}>{t('longRentProperties.detail.viewTenants')}</Link>
      </Button>
    </PlainSection>
  );
}
