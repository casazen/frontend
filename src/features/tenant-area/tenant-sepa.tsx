import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';
import { useTranslation } from 'react-i18next';
import { ApiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StripeIntentPayment } from '@/features/public-booking/components/stripe-intent-payment';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getProblemMessage } from '@/lib/api-errors';

interface SepaSettings {
  authorized: boolean;
  automaticEnabled: boolean;
  canAuthorize: boolean;
  canManage: boolean;
  authorizationUntil: string;
  blockedFrom: string;
  transactionFee: number;
}
interface SepaSession { clientSecret: string; publishableKey: string; stripeAccountId: string; useSavedMandate?: boolean }
const path = (lease: string) => `/tenant-area/contracts/${encodeURIComponent(lease)}/sepa`;

export function TenantSepaSettings({ leaseId }: { leaseId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ['tenant-sepa', leaseId], queryFn: async () => { const data = await ApiClient.get<SepaSettings>(path(leaseId)); if (typeof data.authorizationUntil !== 'string' || typeof data.blockedFrom !== 'string') throw new Error('Invalid SEPA settings'); return data; }, retry: false });
  const returnedFromSetup = new URLSearchParams(window.location.search).has('setup_intent');
  const [setupDone, setSetupDone] = useState(false);
  const setup = useMutation({ mutationFn: () => ApiClient.post<SepaSession>(`${path(leaseId)}/setup`, {}) });
  const mode = useMutation({
    mutationFn: (enabled: boolean) => ApiClient.put<SepaSettings>(`${path(leaseId)}/automatic`, { enabled }),
    onSuccess: (data) => { qc.setQueryData(['tenant-sepa', leaseId], data); setSetupDone(false); setup.reset(); },
  });
  const data = settings.data;
  return <Card data-testid="tenant-sepa-settings">
    <CardHeader><CardTitle className="text-base">{t('tenantSepa.title')}</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <p className="text-sm">{t('tenantSepa.explanation')}</p>
      {settings.isLoading ? <p role="status">{t('tenantSepa.loading')}</p> : null}
      {data ? <>
        <p className="text-sm">{t('tenantSepa.duration', { until: formatDate(data.authorizationUntil), from: formatDate(data.blockedFrom) })}</p>
        <p className="text-sm">{t('tenantSepa.renewal')}</p>
        <p className="text-sm">{t('tenantSepa.fee', { amount: formatCurrency(data.transactionFee, 'EUR') })}</p>
        {!data.canAuthorize ? <p role="status">{t('tenantSepa.expired')}</p> : !data.canManage ? <p role="status">{t('tenantSepa.otherHolder')}</p> : <>
          {data.authorized ? <>
            <p role="status">{t(data.automaticEnabled ? 'tenantSepa.automaticOn' : 'tenantSepa.manualOn')}</p>
            <Button variant="outline" disabled={mode.isPending} onClick={() => mode.mutate(!data.automaticEnabled)}>
              {t(data.automaticEnabled ? 'tenantSepa.disableAutomatic' : 'tenantSepa.enableAutomatic')}
            </Button>
          </> : setup.data && !setupDone ? <StripeIntentPayment mode="setup" {...setup.data}
            returnUrl={window.location.href} submitLabel={t('tenantSepa.confirmMandate')}
            onSubmitted={(status) => { if (status === 'succeeded') setSetupDone(true); }}
            onError={() => setup.reset()} /> : setupDone || returnedFromSetup ? <>
              <p>{t('tenantSepa.chooseMode')}</p>
              <Button disabled={mode.isPending} onClick={() => mode.mutate(false)}>{t('tenantSepa.manual')}</Button>{' '}
              <Button disabled={mode.isPending} onClick={() => mode.mutate(true)}>{t('tenantSepa.enableAutomatic')}</Button>
            </> : <Button disabled={setup.isPending} onClick={() => setup.mutate()}>{t('tenantSepa.authorize')}</Button>}
        </>}
      </> : null}
      {[settings.error, setup.error, mode.error].filter(Boolean).map((error, index) => <p key={index} role="alert" className="text-sm text-destructive">{getProblemMessage(error, t) ?? t('tenantSepa.error')}</p>)}
    </CardContent>
  </Card>;
}

/** A manual payment remains a separate, explicit confirmation even while automatic collection is enabled. */
export function TenantSepaPayment({ leaseId, dueId, amount, currency }: { leaseId: string; dueId: string; amount: number; currency: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!submitted) return;
    const timer = window.setInterval(() => { void qc.invalidateQueries({ queryKey: ['tenant-area', leaseId] }); }, 3_000);
    return () => window.clearInterval(timer);
  }, [submitted, qc, leaseId]);
  const session = useMutation({ mutationFn: () => ApiClient.post<SepaSession>(
    `/tenant-area/contracts/${encodeURIComponent(leaseId)}/dues/${encodeURIComponent(dueId)}/sepa/payment-session`, {}) });
  const fee = 1;
  return <div className="space-y-3" data-testid="tenant-sepa-payment">
    <dl className="grid grid-cols-2 gap-2 text-sm">
      <dt>{t('tenantSepa.installment')}</dt><dd>{formatCurrency(amount, currency)}</dd>
      <dt>{t('tenantSepa.feeLabel')}</dt><dd>{formatCurrency(fee, currency)}</dd>
      <dt className="font-semibold">{t('tenantSepa.total')}</dt><dd className="font-semibold">{formatCurrency(amount + fee, currency)}</dd>
    </dl>
    {submitted ? <p role="status">{t('tenantSepa.processing')}</p> : session.data?.useSavedMandate ? <SavedSepaConfirmation session={session.data} total={amount + fee} currency={currency}
      onError={setError} onSubmitted={() => { setSubmitted(true); void qc.invalidateQueries({ queryKey: ['tenant-area', leaseId] }); }} /> : session.data ? <StripeIntentPayment mode="payment" {...session.data}
      returnUrl={window.location.href} submitLabel={t('tenantSepa.confirmPayment', { amount: formatCurrency(amount + fee, currency) })}
      onError={setError} onSubmitted={(status) => { if (status === 'failed') { setError(t('tenantSepa.error')); return; } setSubmitted(true); void qc.invalidateQueries({ queryKey: ['tenant-area'] }); }} /> :
      <Button disabled={session.isPending} onClick={() => session.mutate()}>{t('tenantSepa.pay')}</Button>}
    {error || session.isError ? <p role="alert">{error ?? getProblemMessage(session.error, t) ?? t('tenantSepa.error')}</p> : null}
  </div>;
}

function SavedSepaConfirmation({ session, total, currency, onError, onSubmitted }: {
  session: SepaSession; total: number; currency: string; onError: (message: string) => void; onSubmitted: () => void;
}) {
  const { t } = useTranslation();
  const stripe = useMemo(() => loadStripe(session.publishableKey), [session.publishableKey]);
  const [pending, setPending] = useState(false);
  const confirm = async () => {
    setPending(true);
    try {
      const client = await stripe;
      if (!client) { onError(t('tenantSepa.error')); return; }
      const result = await client.confirmSepaDebitPayment(session.clientSecret);
      if (result.error) { onError(result.error.message ?? t('tenantSepa.error')); return; }
      if (result.paymentIntent?.status === 'processing' || result.paymentIntent?.status === 'succeeded') onSubmitted();
      else onError(t('tenantSepa.error'));
    } catch { onError(t('tenantSepa.error')); }
    finally { setPending(false); }
  };
  return <Button disabled={pending} onClick={() => void confirm()}>{t('tenantSepa.confirmPayment', { amount: formatCurrency(total, currency) })}</Button>;
}
