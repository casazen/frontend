import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Wallet } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { SkeletonLine } from '@/components/ui/skeleton';
import { getHttpStatus } from '@/lib/api-errors';
import { useSupplierPaymentsAccount } from '@/queries/use-supplier-payments';
import { InvoiceData } from './invoice-data';
import { PaymentsFocus } from './payments-focus';
import { PAYMENTS_TAB, stripeMarkOf } from './payments-model';

/** "Controlliamo con Stripe…": said while the account is read from Stripe, announced once to a screen reader. */
function CheckingNote() {
  const { t } = useTranslation();
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-foreground/70" data-testid="supplier-payments-checking">
      <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin motion-reduce:animate-none" />
      <span>{t('supplier.payments.checking')}</span>
    </p>
  );
}

/**
 * The payments account of the supplier (SP-16c-b), the "Pagamenti" tab of the settings: the account on Stripe where the payments of the
 * jobs land. It says where the account stands (not connected, something left to send, being checked, able to take payments) with the one
 * thing to do about it: connect it or finish it on Stripe, ask again, open the dashboard of the account. IBAN and holder are never typed
 * here: Stripe hosts them. It is what the page shows when Stripe sends the supplier back (`?stripe_return=1`, `?stripe_refresh=1`): the
 * account is read from Stripe again, a few times while only Stripe's own check is left, and the words say how it went; the marks then
 * leave the address and the tab stays in it. While online payments are not active on the server (its endpoints answer 404) the panel says
 * so and offers nothing.
 */
export function SupplierPaymentsPanel() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  // Read once: the marks leave the address below, and the outcome they stand for stays on the page.
  const [mark] = useState(() => stripeMarkOf(searchParams));
  const marksInAddress = stripeMarkOf(searchParams) !== null;
  const account = useSupplierPaymentsAccount(mark !== null);
  const { data, isLoading, isError, error } = account;

  useEffect(() => {
    if (!marksInAddress) return;
    setSearchParams(
      (params) => {
        params.delete('stripe_return');
        params.delete('stripe_refresh');
        // The marks were what said "payments" to the page: without them the tab has to be in the address.
        params.set('tab', PAYMENTS_TAB);
        return params;
      },
      { replace: true },
    );
  }, [marksInAddress, setSearchParams]);

  if (isError && !data) {
    return (
      <div className="space-y-6" data-testid="supplier-payments-page">
        {getHttpStatus(error) === 404 ? (
          <EmptyState
            icon={Wallet}
            title={t('supplier.payments.unavailable.title')}
            description={t('supplier.payments.unavailable.description')}
            className="py-8"
          />
        ) : (
          <ErrorState
            testId="supplier-payments-error"
            title={t('supplier.payments.loadError')}
            error={error}
            onRetry={() => void account.refetch()}
          />
        )}
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6" data-testid="supplier-payments-page" aria-busy="true">
        {account.askingStripe ? <CheckingNote /> : <SkeletonLine lines={4} label={t('supplier.payments.loading')} />}
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="supplier-payments-page">
      {account.askingStripe ? <CheckingNote /> : null}
      <PaymentsFocus account={data} mark={mark} checking={account.askingStripe} onCheckAgain={account.askStripeAgain} />
      <InvoiceData />
    </div>
  );
}
