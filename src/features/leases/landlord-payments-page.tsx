import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { FinancialConnectionsTransfer } from '@/features/bank-transfer/financial-connections-transfer';
import { useWorkspace } from '@/hooks/use-workspace';

/**
 * Conto SEPA of the long-term area, in the settings. The landlord links the Italian euro account that pays the condominium.
 * It does not need a signed contract. Canoni stay on the contract. A manual transfer stays available.
 * Linking is a write (`lease.create`). Who may only read the leases does not get the button.
 */
export function LandlordPaymentsPage() {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const canLink = hasPermission('long-rent', 'lease.create');

  return (
    <div className="min-w-0 space-y-6" data-testid="long-rent-payments">
      <PageHeader title={t('longRentPayments.title')} description={t('longRentPayments.description')} crumbs="auto" />
      <div className={`${FOCUS_COLUMN} space-y-4`}>
        <p className="text-sm text-foreground/70">
          {t('longRentPayments.contractsLead')}{' '}
          <Link to="/app/long-rent/leases" className="font-medium underline" data-testid="long-rent-payments-contracts">
            {t('longRentPayments.contracts')}
          </Link>
        </p>
        {canLink ? (
          <FinancialConnectionsTransfer
            mode="org"
            linkOnly
            forLandlord
            showManualTransfer
            leaseId="org"
            dueId="condominium"
            amount={0}
            currency="EUR"
            reference=""
          />
        ) : (
          <p className="text-sm" data-testid="long-rent-payments-readonly">
            {t('longRentPayments.readonly')}
          </p>
        )}
      </div>
    </div>
  );
}
