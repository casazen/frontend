import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '@/api/client';
import { StripeIntentPayment } from '@/features/public-booking/components/stripe-intent-payment';
import { stripeLocale } from '@/lib/stripe-appearance';

import { canPayExtraOrder, extraLabels, formatExtraPrice, hostExtraStatus, useGuestHostExtras,
  type HostExtraOrder, type Language } from './guest-host-extra-model';

interface Payment {
  clientSecret: string;
  publishableKey: string;
  stripeAccountId: string;
}

export function GuestHostExtras({ path, language }: { path: string; language: Language }) {
  const labels = extraLabels[language];
  const content = useGuestHostExtras(path, language, true, true);
  const queryClient = useQueryClient();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [activePayment, setActivePayment] = useState<{ id: string; session: Payment }>();
  const [paymentError, setPaymentError] = useState('');
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['guest-host-extras', path, language] });
  const reserve = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => ApiClient.post<HostExtraOrder>(
      `${path}/host-extras/${id}/orders`, { quantity, requestId: crypto.randomUUID() }, { public: true },
    ),
    onSuccess: (order) => {
      void refresh();
      if (canPayExtraOrder(order.status)) pay.mutate(order.id);
    },
  });
  const pay = useMutation({
    mutationFn: async (id: string) => ({
      id,
      session: await ApiClient.post<Payment>(`${path}/host-extra-orders/${id}/payment`, undefined, { public: true }),
    }),
    onSuccess: (next) => { setActivePayment(next); setPaymentError(''); },
    onError: refresh,
  });
  const confirmAuthorization = useMutation({
    mutationFn: (id: string) => ApiClient.post(`${path}/host-extra-orders/${id}/authorization`, undefined, { public: true }),
    onSettled: refresh,
  });
  const cancel = useMutation({
    mutationFn: (id: string) => ApiClient.delete(`${path}/host-extra-orders/${id}`, { public: true }),
    onSuccess: () => { setActivePayment(undefined); return refresh(); },
  });

  const returnUrl = new URL(window.location.pathname, window.location.origin);
  returnUrl.search = new URLSearchParams({ lang: language, page: 'extras' }).toString();

  return (
    <div className="stay-stack" data-testid="guest-host-extras">
      {content.isPending && <p role="status">{labels[1]}</p>}
      {(content.isError || reserve.isError || pay.isError || cancel.isError || confirmAuthorization.isError) && <p role="alert">{labels[8]}</p>}
      {content.isSuccess && content.data.offers.length === 0 && <p>{labels[2]}</p>}
      {Boolean(content.data?.offers.length) && <div className="grid gap-3 sm:grid-cols-2">
        {content.data?.offers.map((offer) => {
          const quantity = quantities[offer.id] ?? 1;
          return (
            <article className="stay-card stay-content" key={offer.id}>
              <h2>{offer.name}</h2>
              <p className="whitespace-pre-wrap">{offer.description}</p>
              <p><strong>{formatExtraPrice(language, offer.unitPrice * quantity, offer.currency)}</strong></p>
              {offer.byQuantity && <label>{labels[5]} <input type="number" min="1" max="100" value={quantity}
                onChange={(event) => setQuantities((current) => ({ ...current, [offer.id]: event.target.valueAsNumber || 1 }))} /></label>}
              <button type="button" disabled={reserve.isPending || !Number.isInteger(quantity) || quantity < 1 || quantity > 100}
                onClick={() => reserve.mutate({ id: offer.id, quantity })}>
                {offer.requiresApproval ? labels[3] : labels[4]}
              </button>
            </article>
          );
        })}
      </div>}
      {content.data?.orders.length ? <h2 className="stay-stack-title">{labels[9]}</h2> : null}
      {content.data?.orders.map((order) => (
        <article className="stay-card stay-content" key={order.id}>
          <h3>{order.name}</h3>
          <p>{formatExtraPrice(language, order.amount, order.currency)} · {hostExtraStatus(language, order.status)}</p>
          {canPayExtraOrder(order.status) && activePayment?.id !== order.id && <button type="button" className="stay-action-primary" disabled={pay.isPending}
            onClick={() => pay.mutate(order.id)}>{order.status === 'AwaitingAuthorization' ? labels[3] : labels[6]}</button>}
          {canPayExtraOrder(order.status) && activePayment?.id === order.id && (
            <StripeIntentPayment mode="payment" {...activePayment.session} locale={stripeLocale(language)}
              returnUrl={returnUrl.href}
              submitLabel={order.status === 'AwaitingAuthorization' ? labels[3] : undefined}
              onSubmitted={() => {
                setActivePayment(undefined);
                if (order.status === 'AwaitingAuthorization') confirmAuthorization.mutate(order.id);
                else void refresh();
              }} onError={setPaymentError} />
          )}
          {paymentError && activePayment?.id === order.id && <p role="alert">{paymentError}</p>}
          {(order.status === 'Requested' || canPayExtraOrder(order.status)) && <button type="button" className="stay-action-link" disabled={cancel.isPending}
            onClick={() => cancel.mutate(order.id)}>{labels[7]}</button>}
        </article>
      ))}
    </div>
  );
}
