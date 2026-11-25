import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ApiClient } from '@/api/client';
import { withoutPaymentReturn } from '@/features/checkin/lib/tourist-tax-model';
import { StripeIntentPayment } from '@/features/public-booking/components/stripe-intent-payment';
import { stripeLocale } from '@/lib/stripe-appearance';
import { supplierOrderText } from './guest-supplier-order-copy';
import type { GuestSupplierOrder } from './guest-supplier-order-model';

export function GuestSupplierCheckout({ endpoint, order, language, returned, update }: {
  endpoint: string;
  order: GuestSupplierOrder;
  language: string;
  returned: boolean;
  update: (order: GuestSupplierOrder) => void;
}) {
  const text = supplierOrderText(language);
  const [, setParams] = useSearchParams();
  const [message, setMessage] = useState('');
  const automaticallyChecked = useRef(false);
  const base = `${endpoint}/${order.id}`;
  const checkout = useMutation({
    mutationFn: async () => {
      const checkout = await ApiClient.post<{ publishableKey: string; clientSecret: string }>(
        base + '/checkout', { totalCents: order.totalCents }, { public: true });
      if (!checkout.publishableKey?.startsWith('pk_test_') || !checkout.clientSecret) throw new Error('Invalid sandbox session');
      return checkout;
    },
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
    {(checkFailed || checked?.state === 'Quoted') &&
      <button type="button" onClick={() => verify()}>{text('verify')}</button>}
    {order.state === 'Quoted' && !checkFailed && (checkout.data
      ? <StripeIntentPayment mode="payment" clientSecret={checkout.data.clientSecret}
          publishableKey={checkout.data.publishableKey} locale={stripeLocale(language)} returnUrl={returnUrl.toString()}
          submitLabel={text('authorizeCard')} busyLabel={text('checking')} onError={setMessage}
          onSubmitted={() => { checkout.reset(); setMessage(''); verify(); }} />
      : <button type="button" disabled={checkout.isPending}
          onClick={() => { setMessage(''); checkout.mutate(); }}>{text('authorizeCard')}</button>)}
  </div>;
}
