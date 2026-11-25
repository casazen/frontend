import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronRight, FileText, ShoppingBag } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiClient } from '@/api/client';
import { guestTaxOutlook, refusalLeavesPaymentOpen, withoutPaymentReturn } from '@/features/checkin/lib/tourist-tax-model';
import { StripeIntentPayment } from '@/features/public-booking/components/stripe-intent-payment';
import { clientStatusFromRedirect } from '@/features/public-booking/checkout-outcome';
import type { PublicTouristTax } from '@/types/public-checkin.types';

interface StayBalance {
  amount: number;
  total: number;
  currency: string;
  canPay: boolean;
  deferred: boolean;
  processing: boolean;
  external: boolean;
}

interface BalanceSession {
  amount: number;
  clientSecret: string;
  publishableKey: string;
  stripeAccountId: string;
}

interface PaymentLabels {
  balance: string;
  total: string;
  paid: string;
  tax: string;
  payNow: string;
  loading: string;
  failed: string;
  settled: string;
  deferred: string;
  processing: string;
  unavailable: string;
  documents: string;
  payTax: string;
  services: string;
  refresh: string;
}

export function GuestPortalPayments({ path, language, direct, tax, checkIn, documents, services, labels }: {
  path: string;
  language: 'it' | 'en' | 'de' | 'fr' | 'es';
  direct: boolean;
  tax?: PublicTouristTax;
  checkIn: string;
  documents: string;
  services?: string;
  labels: PaymentLabels;
}) {
  const [params, setParams] = useSearchParams();
  const [redirect] = useState(() => clientStatusFromRedirect(params.get('redirect_status')));
  const [waitingSince, setWaitingSince] = useState(() => redirect === 'succeeded' || redirect === 'processing' ? Date.now() : null);
  const [stripeError, setStripeError] = useState<string | null>(() => redirect === 'failed' ? labels.failed : null);
  const endpoint = `${path}/payments`;
  const balance = useQuery({
    queryKey: ['guest-portal-payments', endpoint],
    queryFn: ({ signal }) => ApiClient.get<StayBalance>(endpoint, undefined, { public: true, signal }),
    enabled: direct,
    refetchInterval: ({ state }) => (waitingSince !== null || state.data?.processing)
      && state.data?.amount !== 0 && (waitingSince === null || Date.now() - waitingSince < 60_000) ? 2500 : false,
    gcTime: 0,
    retry: false,
  });
  const session = useMutation({
    mutationFn: () => ApiClient.post<BalanceSession>(`${endpoint}/payment-session`, undefined, { public: true }),
    onError: () => { void balance.refetch(); },
    gcTime: 0,
  });
  const format = (amount: number, currency: string) => currency
    ? new Intl.NumberFormat(language, { style: 'currency', currency }).format(amount)
    : new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(amount);

  useEffect(() => {
    const clean = withoutPaymentReturn(params);
    if (clean) setParams(clean, { replace: true });
  }, [params, setParams]);

  const amount = balance.data?.amount;
  const returnUrl = new URL(window.location.pathname, window.location.origin);
  returnUrl.search = new URLSearchParams({ page: 'payments', lang: language }).toString();
  const taxOutlook = tax && guestTaxOutlook(tax);
  const canPayTax = taxOutlook === 'payable';
  const taxSettled = taxOutlook === 'included' || taxOutlook === 'paid' || taxOutlook === 'paidAtProperty'
    || taxOutlook === 'channelCollects' || taxOutlook === 'nothingDue';

  return (
    <div className="stay-links">
      {direct && (
        <section className="stay-card stay-content">
          <h2>{labels.balance}</h2>
          {balance.isPending && <p role="status">{labels.loading}</p>}
          {(balance.isError || session.isError || stripeError) && <p role="alert">{stripeError ?? labels.failed}</p>}
          {balance.data && (
            balance.data.external ? <p>{labels.unavailable}</p> : amount === 0 ? <p>{labels.settled}</p> : (
              <>
                <p>{labels.total} · {format(balance.data.total, balance.data.currency)}</p>
                <p>{labels.paid} · {format(balance.data.total - balance.data.amount, balance.data.currency)}</p>
                <p><strong>{format(session.data?.amount ?? balance.data.amount, balance.data.currency)}</strong></p>
                {waitingSince !== null || balance.data.processing ? (
                    <>
                      <p role="status">{labels.processing}</p>
                      <button type="button" disabled={balance.isFetching} onClick={() => { void balance.refetch(); }}>{labels.refresh}</button>
                    </>
                  ) : balance.data.deferred ? <p>{labels.deferred}</p>
                  : !balance.data.canPay ? <p>{labels.unavailable}</p>
                  : session.data ? (
                    <StripeIntentPayment
                      clientSecret={session.data.clientSecret}
                      publishableKey={session.data.publishableKey}
                      stripeAccountId={session.data.stripeAccountId}
                      locale={language}
                      mode="payment"
                      returnUrl={returnUrl.toString()}
                      submitLabel={labels.payNow}
                      busyLabel={labels.processing}
                      onError={setStripeError}
                      onRefusal={(refusal) => {
                        if (refusalLeavesPaymentOpen(refusal)) {
                          session.reset();
                          void balance.refetch();
                        }
                      }}
                      onSubmitted={(status) => {
                        setStripeError(status === 'failed' ? labels.failed : null);
                        if (status !== 'failed') {
                          session.reset();
                          setWaitingSince(Date.now());
                        }
                        void balance.refetch();
                      }}
                    />
                  ) : (
                    <button type="button" disabled={session.isPending} onClick={() => {
                      setStripeError(null);
                      session.mutate();
                    }}>{session.isPending ? labels.loading : labels.payNow}</button>
                  )}
              </>
            )
          )}
        </section>
      )}
      {tax && (
        <section className="stay-card stay-content">
          <h2>{labels.tax}</h2>
          {canPayTax ? (
            <><p>{format(tax.payable, tax.currency)}</p><a href={checkIn} rel="noreferrer">{labels.payTax}</a></>
          ) : <p>{taxSettled ? labels.settled : labels.unavailable}</p>}
        </section>
      )}
      {services && <Link className="stay-card" to={services}><ShoppingBag aria-hidden="true" />{labels.services}<ChevronRight aria-hidden="true" /></Link>}
      <Link className="stay-card" to={documents}><FileText aria-hidden="true" />{labels.documents}<ChevronRight aria-hidden="true" /></Link>
    </div>
  );
}
