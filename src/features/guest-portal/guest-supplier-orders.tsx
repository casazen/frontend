import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { withoutPaymentReturn } from '@/features/checkin/lib/tourist-tax-model';
import { GuestSupplierCheckout } from './guest-supplier-checkout';
import { supplierOrderText as checkoutText } from './guest-supplier-order-copy';
import { ShoppingBag } from 'lucide-react';
import { ApiClient } from '@/api/client';
import { getHttpStatus } from '@/lib/api-errors';
import { romeDateOf, romeWallTimeToUtc } from '@/lib/stay-dates';
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

interface Catalog { environment: string; offers: Offer[]; orders: GuestSupplierOrder[] }

export function GuestSupplierOrders({ path, language }: { path: string; language: string }) {
  const endpoint = `${path}/supplier-orders`;
  const text = supplierOrderText(language);
  const [submittedOrders, setSubmittedOrders] = useState<Record<string, string>>({});
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const returnId = params.get('supplierOrderReturn');
  useEffect(() => {
    const cleaned = withoutPaymentReturn(params);
    if (cleaned) setParams(cleaned, { replace: true });
  }, [params, setParams]);
  const query = useQuery({
    queryKey: ['guest-supplier-orders', endpoint],
    queryFn: ({ signal }) => ApiClient.get<Catalog>(
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

  const sandbox = query.data.environment === 'stripe-sandbox';
  const offers = sandbox ? query.data.offers.filter(offer => offer.priceCents !== null
    && offer.priceCents + Math.round(offer.priceCents * offer.commissionBasisPoints / 10000) >= 50) : query.data.offers;
  return (
    <div className="stay-supplier-orders">
      <p className="stay-content">{sandbox ? checkoutText(language)('sandboxMode') : text.simulation}</p>
      <h2>{text.catalog}</h2>
      {offers.length === 0 && <p>{text.emptyCatalog}</p>}
      {Object.keys(submittedOrders).length > 0 && <p role="status" className="stay-card stay-content">{text.sent} <a href="#guest-service-orders">{text.orders}</a></p>}
      {offers.map((offer) => <OfferForm key={`${offer.id}:${submittedOrders[offer.id] ?? ''}`} offer={offer} language={language} sandbox={sandbox} now={now}
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
          {order.stripeSandbox && (order.state === 'Quoted' || returnId === order.id) && (
            <GuestSupplierCheckout key={order.totalCents} endpoint={endpoint} order={order} language={language} returned={returnId === order.id} refresh={() => { void query.refetch(); }}
              update={verified => client.setQueryData<Catalog>(['guest-supplier-orders', endpoint], previous =>
                previous && { ...previous, orders: previous.orders.map(item => item.id === verified.id ? verified : item) })} />
          )}
          {!sandbox && !order.stripeSandbox && order.state === 'Quoted' && <button disabled={change.isPending} onClick={() => change.mutate({
            suffix: `/${order.id}/authorize`, body: { totalCents: order.totalCents },
          })}>{text.authorize}</button>}
          {order.state === 'Completed' && (!order.stripeSandbox || (order.completedAt && now < Date.parse(order.completedAt) + 24 * 3600000)) && <form onSubmit={(event) => {
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

function OfferForm({ offer, language, sandbox, now, busy, submit }: {
  offer: Offer; language: string; sandbox: boolean; now: number; busy: boolean; submit: (body: object) => void;
}) {
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [invalidTime, setInvalidTime] = useState(false);
  const text = supplierOrderText(language);
  function order(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const requestedFor = romeWallTimeToUtc(String(data.get('date')), String(data.get('time')));
    const time = Date.parse(requestedFor);
    if (!requestedFor || (sandbox && (time <= Date.now() || time > Date.now() + 48 * 3600000))) {
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
        <label>{text.date} <input className="stay-supplier-input" type="date" name="date" min={sandbox ? romeDateOf(new Date(now).toISOString()) : undefined}
          max={sandbox ? romeDateOf(new Date(now + 48 * 3600000).toISOString()) : undefined} required /></label>
        <label>{text.time} <input className="stay-supplier-input" type="time" name="time" required /></label>
        {invalidTime && <p role="alert">{sandbox ? checkoutText(language)('sandboxTime') : text.invalidTime}</p>}
        <label>{text.note} <textarea className="stay-supplier-input" name="note" maxLength={2000} /></label>
        <button disabled={busy}>{price === null ? text.ask : text.place}</button>
      </form>
    </details>
  );
}
