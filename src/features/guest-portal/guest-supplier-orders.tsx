import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ShoppingBag } from 'lucide-react';
import { ApiClient } from '@/api/client';
import { getHttpStatus } from '@/lib/api-errors';
import { romeWallTimeToUtc } from '@/lib/stay-dates';
import { GUEST_ORDER_REFRESH_MS, orderMoney, orderNeedsUpdates, orderStatus, type GuestSupplierOrder } from './guest-supplier-order-model';
import { supplierOrderText } from './guest-supplier-order-text';

interface Offer {
  id: string;
  serviceName: string;
  supplierName: string;
  category: string;
  summary: string | null;
  priceCents: number | null;
  commissionBasisPoints: number;
}

export function GuestSupplierOrders({ path, language }: { path: string; language: string }) {
  const endpoint = `${path}/supplier-orders`;
  const text = supplierOrderText(language);
  const [submittedOrders, setSubmittedOrders] = useState<Record<string, string>>({});
  const query = useQuery({
    queryKey: ['guest-supplier-orders', endpoint],
    queryFn: ({ signal }) => ApiClient.get<{ environment: string; offers: Offer[]; orders: GuestSupplierOrder[] }>(
      endpoint, undefined, { public: true, signal },
    ),
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: 'always',
    refetchInterval: ({ state }) => state.data?.orders.some(orderNeedsUpdates) ? GUEST_ORDER_REFRESH_MS : false,
  });
  const change = useMutation({
    mutationFn: (args: { suffix: string; body: object }) =>
      ApiClient.post<GuestSupplierOrder>(`${endpoint}${args.suffix}`, args.body, { public: true }),
    onSuccess: (order, { suffix, body }) => {
      if (suffix === '' && 'offerId' in body && typeof body.offerId === 'string') {
        const offerId = body.offerId;
        setSubmittedOrders(previous => ({ ...previous, [offerId]: order.id }));
      }
      void query.refetch();
    },
  });
  if (query.isPending) return <p role="status">{text.loading}</p>;
  if (query.isError) return <p role="alert">{getHttpStatus(query.error) === 404
    ? text.unavailable : text.failed}</p>;

  return (
    <div className="stay-supplier-orders">
      <p className="stay-content">{text.simulation}</p>
      <h2>{text.catalog}</h2>
      {query.data.offers.length === 0 && <p>{text.emptyCatalog}</p>}
      {Object.keys(submittedOrders).length > 0 && <p role="status" className="stay-card stay-content">{text.sent} <a href="#guest-service-orders">{text.orders}</a></p>}
      {query.data.offers.map((offer) => <OfferForm key={`${offer.id}:${submittedOrders[offer.id] ?? ''}`} offer={offer} language={language}
        busy={change.isPending} submit={(body) => change.mutate({ suffix: '', body })} />)}
      <h2 id="guest-service-orders" tabIndex={-1}>{text.orders}</h2>
      {query.data.orders.length === 0 && <p>{text.emptyOrders}</p>}
      {query.data.orders.map((order) => (
        <article className="stay-card stay-content" key={order.id}>
          <h3>{order.serviceName}</h3>
          <p>{order.supplierName} · {orderStatus(order.state, language)}</p>
          <p>{new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Rome' })
            .format(new Date(order.requestedFor))}</p>
          {order.totalCents > 0 && <dl>
            <div><dt>{text.price}</dt><dd>{orderMoney(order.supplierPriceCents, language)}</dd></div>
            <div><dt>{text.fee}</dt><dd>{orderMoney(order.commissionCents, language)}</dd></div>
            <div><dt>{text.total}</dt><dd>{orderMoney(order.totalCents, language)}</dd></div>
            {order.refundCents > 0 && <div><dt>{text.refund}</dt><dd>{orderMoney(order.refundCents, language)}</dd></div>}
          </dl>}
          {order.state === 'Quoted' && <button disabled={change.isPending} onClick={() => change.mutate({
            suffix: `/${order.id}/authorize`, body: { totalCents: order.totalCents },
          })}>{text.authorize}</button>}
          {order.state === 'Completed' && <form onSubmit={(event) => {
            event.preventDefault();
            const text = new FormData(event.currentTarget).get('complaint');
            change.mutate({ suffix: `/${order.id}/dispute`, body: { text } });
          }}>
            <label>{text.complaint}<textarea className="stay-supplier-input" name="complaint" required maxLength={2000} /></label>
            <button disabled={change.isPending}>{text.dispute}</button>
          </form>}
          {order.complaint && <p>{text.report}: {order.complaint}</p>}
          {order.decision && <p>{text.decision}: {order.decision}</p>}
        </article>
      ))}
      {change.isError && <p role="alert">{text.actionFailed}</p>}
    </div>
  );
}

function OfferForm({ offer, language, busy, submit }: {
  offer: Offer; language: string; busy: boolean; submit: (body: object) => void;
}) {
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [invalidTime, setInvalidTime] = useState(false);
  const text = supplierOrderText(language);
  function order(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const requestedFor = romeWallTimeToUtc(String(data.get('date')), String(data.get('time')));
    if (!requestedFor) {
      setInvalidTime(true);
      return;
    }
    submit({ requestId, offerId: offer.id, requestedFor, note: data.get('note') });
  }
  const price = offer.priceCents === null ? null : offer.priceCents + Math.round(offer.priceCents * offer.commissionBasisPoints / 10000);
  return (
    <details className="stay-card stay-content">
      <summary className="min-h-11 cursor-pointer py-3 font-medium focus-visible:ring-2">
        <ShoppingBag aria-hidden="true" size={17} className="mr-2 inline" />
        {offer.serviceName} · {price === null ? text.quote : orderMoney(price, language)}
      </summary>
      <form className="stay-content" onSubmit={order} onChange={() => {
        setRequestId(crypto.randomUUID());
        setInvalidTime(false);
      }}>
        <p>{offer.category} · {offer.supplierName}</p>
        {offer.summary && <p>{offer.summary}</p>}
        <label>{text.date} <input className="stay-supplier-input" type="date" name="date" required /></label>
        <label>{text.time} <input className="stay-supplier-input" type="time" name="time" required /></label>
        {invalidTime && <p role="alert">{text.invalidTime}</p>}
        <label>{text.note} <textarea className="stay-supplier-input" name="note" maxLength={2000} /></label>
        <button disabled={busy}>{price === null ? text.ask : text.place}</button>
      </form>
    </details>
  );
}
