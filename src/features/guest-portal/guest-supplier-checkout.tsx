import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { ApiClient } from '@/api/client';
import { refusalLeavesPaymentOpen, withoutPaymentReturn } from '@/features/checkin/lib/tourist-tax-model';
import { StripeIntentPayment } from '@/features/public-booking/components/stripe-intent-payment';
import { stripeLocale } from '@/lib/stripe-appearance';
import { supplierOrderText } from './guest-supplier-order-copy';
import { orderMoney, type GuestSupplierOrder } from './guest-supplier-order-model';

export function GuestSupplierCheckout({ endpoint, order, language, returned, update, refresh }: {
  endpoint: string;
  order: GuestSupplierOrder;
  language: string;
  returned: boolean;
  update: (order: GuestSupplierOrder) => void;
  refresh: () => void;
}) {
  const text = supplierOrderText(language);
  const [, setParams] = useSearchParams();
  const [message, setMessage] = useState('');
  const automaticallyChecked = useRef(false);
  const [consent, setConsent] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const setup = order.stripeDeferred && order.state === 'Quoted';
  const retryCharge = order.state === 'PaymentActionRequired' || order.state === 'PaymentFailed';
  const button = text(setup ? 'saveCard' : retryCharge ? 'confirmCharge' : 'authorizeCard');
  const base = `${endpoint}/${order.id}`;
  const checkout = useMutation({
    mutationFn: async () => {
      const checkout = await ApiClient.post<{ publishableKey: string; clientSecret: string; mode?: 'setup' | 'payment' | 'next-action' }>(
        base + '/checkout', { totalCents: order.totalCents, ...(setup && consent ? { consentVersion: 'guest-service-order-off-session-v1' } : {}) }, { public: true });
      if (!checkout.publishableKey?.startsWith('pk_test_') || !checkout.clientSecret) throw new Error('Invalid sandbox session');
      if (setup && checkout.mode !== 'setup') throw new Error('Invalid setup session');
      return checkout;
    },
    onError: refresh,
    gcTime: 0,
  });
  const { mutate: verify, isPending, isError: checkFailed, data: checked } = useMutation({
    mutationFn: () => ApiClient.post<GuestSupplierOrder>(base + '/reconcile', {}, { public: true }),
    onSuccess: (verified) => {
      if (returned) setParams(current => {
        const next = withoutPaymentReturn(current) ?? new URLSearchParams(current);
        next.delete('supplierOrderReturn');
        return next;
      }, { replace: true });
      update(verified);
    },
  });

  useEffect(() => {
    if (returned && !automaticallyChecked.current) {
      automaticallyChecked.current = true;
      verify();
    }
  }, [returned, verify]);

  const returnUrl = new URL(window.location.href);
  const cleanParams = new URLSearchParams({ page: 'supplier-orders', lang: language });
  cleanParams.set('supplierOrderReturn', order.id);
  returnUrl.search = cleanParams.toString();
  returnUrl.hash = '';

  if (isPending || (returned && !checkFailed)) return <p role="status">{text('checking')}</p>;
  return <div className="space-y-3">
    {message && <p role="alert">{message}</p>}
    {(checkout.isError || checkFailed) && <p role="alert">{text('paymentError')}</p>}
    {checked?.state === 'Quoted' && <p role="status">{text('notAuthorized')}</p>}
    {(checkFailed || checked?.state === 'Quoted' || retryCharge || order.state === 'PaymentProcessing') &&
      <button type="button" onClick={() => verify()}>{text('verify')}</button>}
    {setup && !checkout.data && <label className="flex items-start gap-2">
      <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />
      <span>{text('consent').replace('{amount}', orderMoney(order.totalCents, language)).replace('{supplier}', order.supplierName)}</span>
    </label>}
    {(order.state === 'Quoted' || retryCharge) && !checkFailed && (checkout.data?.mode === 'next-action'
      ? <button type="button" disabled={authenticating} onClick={async () => {
          if (!checkout.data || authenticating) return;
          setAuthenticating(true);
          try {
            const stripe = await loadStripe(checkout.data.publishableKey);
            if (!stripe) throw new Error();
            const result = await stripe.handleNextAction({ clientSecret: checkout.data.clientSecret });
            setMessage(result.error?.message ?? '');
          } catch {
            setMessage(text('paymentError'));
          } finally {
            setAuthenticating(false);
            checkout.reset();
            verify();
          }
        }}>{text('bankCheck')}</button>
      : checkout.data
      ? <StripeIntentPayment mode={checkout.data.mode === 'setup' ? 'setup' : 'payment'} clientSecret={checkout.data.clientSecret}
          publishableKey={checkout.data.publishableKey} locale={stripeLocale(language)} returnUrl={returnUrl.toString()}
          submitLabel={button} busyLabel={text('checking')} onError={setMessage}
          onRefusal={reason => {
            if (refusalLeavesPaymentOpen(reason)) {
              checkout.reset();
              verify();
            }
          }}
          onSubmitted={() => { checkout.reset(); setMessage(''); verify(); }} />
      : <button type="button" disabled={checkout.isPending || (setup && !consent)}
          onClick={() => { setMessage(''); checkout.mutate(); }}>{button}</button>)}
  </div>;
}
