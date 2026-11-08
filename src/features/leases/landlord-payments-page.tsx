import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { FinancialConnectionsTransfer } from '@/features/bank-transfer/financial-connections-transfer';

/**
 * Pagamenti of the long-term area. The landlord links the Italian euro account that pays the condominium.
 * It does not need a signed contract. The tenant pays from Canoni. A manual transfer stays available.
 */
export function LandlordPaymentsPage() {
  const { t } = useTranslation();

  return (
    <div className="min-w-0 space-y-6" data-testid="long-rent-payments">
      <PageHeader title={t('longRentPayments.title')} description={t('longRentPayments.description')} crumbs="auto" />
      <div className={`${FOCUS_COLUMN} space-y-4`}>
        <p className="text-sm text-foreground/70">
          {t('longRentPayments.canoniLead')}{' '}
          <Link to="/app/long-rent/rents" className="font-medium underline" data-testid="long-rent-payments-canoni">
            {t('longRentPayments.canoni')}
          </Link>
        </p>
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
      </div>
    </div>
  );
}
