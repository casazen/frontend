import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { SkeletonLine } from '@/components/ui/skeleton';
import { getHttpStatus } from '@/lib/api-errors';
import { cn } from '@/lib/utils';
import { useSupplierPaymentsAccount } from '@/queries/use-supplier-payments';
import { InvoiceData } from './invoice-data';
import { PaymentsFocus } from './payments-focus';
import { stripeMarkOf } from './payments-model';

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
 * The payments account of the supplier (SP-16c-b): the account on Stripe where the payments of the jobs land. It says where the
 * account stands (not connected, something left to send, being checked, able to take payments) with the one thing to do about it:
 * connect it or finish it on Stripe, ask again, open the dashboard of the account. IBAN and holder are never typed here: Stripe
 * hosts them. It is the page Stripe sends the supplier back to (`?stripe_return=1`, `?stripe_refresh=1`): the account is read
 * from Stripe again, a few times while only Stripe's own check is left, and the words say how it went; the marks then leave the
 * address. While online payments are not active on the server (its endpoints answer 404) the page says so and offers nothing.
 */
export function SupplierPaymentsPage() {
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
        return params;
      },
      { replace: true },
    );
  }, [marksInAddress, setSearchParams]);

  const header = <PageHeader title={t('supplier.payments.title')} description={t('supplier.payments.description')} crumbs="auto" />;

  if (isError && !data) {
    return (
      <div className={cn(FOCUS_COLUMN, 'space-y-6')} data-testid="supplier-payments-page">
        {header}
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
      <div className={cn(FOCUS_COLUMN, 'space-y-6')} data-testid="supplier-payments-page" aria-busy="true">
        {header}
        {account.askingStripe ? <CheckingNote /> : <SkeletonLine lines={4} label={t('supplier.payments.loading')} />}
      </div>
    );
  }

  return (
    <div className={cn(FOCUS_COLUMN, 'space-y-8')} data-testid="supplier-payments-page">
      {header}
      {account.askingStripe ? <CheckingNote /> : null}
      <PaymentsFocus account={data} mark={mark} checking={account.askingStripe} onCheckAgain={account.askStripeAgain} />
      <InvoiceData />
    </div>
  );
}
