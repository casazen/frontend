import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ShoppingBag } from 'lucide-react';
import { ApiClient } from '@/api/client';
import { getHttpStatus } from '@/lib/api-errors';
import { romeWallTimeToUtc } from '@/lib/stay-dates';
import { orderMoney, orderStatus, type GuestSupplierOrder } from './guest-supplier-order-model';

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
  const query = useQuery({
    queryKey: ['guest-supplier-orders', endpoint],
    queryFn: ({ signal }) => ApiClient.get<{ environment: string; offers: Offer[]; orders: GuestSupplierOrder[] }>(
      endpoint, undefined, { public: true, signal },
    ),
    retry: false,
    gcTime: 0,
  });
  const change = useMutation({
    mutationFn: (args: { suffix: string; body: object }) =>
      ApiClient.post<GuestSupplierOrder>(`${endpoint}${args.suffix}`, args.body, { public: true }),
    onSuccess: () => { void query.refetch(); },
  });
  if (query.isPending) return <p role="status">Caricamento dei servizi…</p>;
  if (query.isError) return <p role="alert">{getHttpStatus(query.error) === 404
    ? 'Servizi non disponibili per il soggiorno.' : 'Impossibile caricare i servizi.'}</p>;

  return (
    <div className="stay-supplier-orders">
      <p className="stay-card stay-content">Ambiente di test. I pagamenti e i rimborsi sono simulati.</p>
      <h2>Servizi disponibili</h2>
      {query.data.offers.length === 0 && <p>Nessun servizio disponibile.</p>}
      {query.data.offers.map((offer) => <OfferForm key={`${offer.id}:${query.data.orders.length}`} offer={offer} language={language}
        busy={change.isPending} submit={(body) => change.mutate({ suffix: '', body })} />)}
      <h2>I tuoi ordini</h2>
      {query.data.orders.length === 0 && <p>Non hai ancora ordinato servizi.</p>}
      {query.data.orders.map((order) => (
        <article className="stay-card stay-content" key={order.id}>
          <h3>{order.serviceName}</h3>
          <p>{order.supplierName} · {orderStatus(order.state)}</p>
          <p>{new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Rome' })
            .format(new Date(order.requestedFor))}</p>
          {order.totalCents > 0 && <dl>
            <div><dt>Prezzo del fornitore</dt><dd>{orderMoney(order.supplierPriceCents, language)}</dd></div>
            <div><dt>Commissione</dt><dd>{orderMoney(order.commissionCents, language)}</dd></div>
            <div><dt>Totale</dt><dd>{orderMoney(order.totalCents, language)}</dd></div>
            {order.refundCents > 0 && <div><dt>Rimborso</dt><dd>{orderMoney(order.refundCents, language)}</dd></div>}
          </dl>}
          {order.state === 'Quoted' && <button disabled={change.isPending} onClick={() => change.mutate({
            suffix: `/${order.id}/authorize`, body: { totalCents: order.totalCents },
          })}>Simula autorizzazione</button>}
          {order.state === 'Completed' && <form onSubmit={(event) => {
            event.preventDefault();
            const text = new FormData(event.currentTarget).get('complaint');
            change.mutate({ suffix: `/${order.id}/dispute`, body: { text } });
          }}>
            <label>Descrivi il problema<textarea className="stay-supplier-input" name="complaint" required maxLength={2000} /></label>
            <button disabled={change.isPending}>Apri controversia</button>
          </form>}
          {order.complaint && <p>Segnalazione: {order.complaint}</p>}
          {order.decision && <p>Decisione: {order.decision}</p>}
        </article>
      ))}
      {change.isError && <p role="alert">Operazione non riuscita. Ricarica la pagina e verifica lo stato dell’ordine.</p>}
    </div>
  );
}

function OfferForm({ offer, language, busy, submit }: {
  offer: Offer; language: string; busy: boolean; submit: (body: object) => void;
}) {
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  function order(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const requestedFor = romeWallTimeToUtc(String(data.get('date')), String(data.get('time')));
    if (!requestedFor) return;
    submit({ requestId, offerId: offer.id, requestedFor, note: data.get('note') });
  }
  const price = offer.priceCents === null ? null : offer.priceCents + Math.round(offer.priceCents * offer.commissionBasisPoints / 10000);
  return (
    <form className="stay-card stay-content" onSubmit={order} onChange={() => setRequestId(crypto.randomUUID())}>
      <h3><ShoppingBag aria-hidden="true" size={17} /> {offer.serviceName}</h3>
      <p>{offer.category} · {offer.supplierName}</p>
      {offer.summary && <p>{offer.summary}</p>}
      <p>{price === null ? 'Su preventivo' : orderMoney(price, language)}</p>
      <label>Data <input className="stay-supplier-input" type="date" name="date" required /></label>
      <label>Ora italiana <input className="stay-supplier-input" type="time" name="time" required /></label>
      <label>Note per il fornitore <textarea className="stay-supplier-input" name="note" maxLength={2000} /></label>
      <button disabled={busy}>{price === null ? 'Richiedi preventivo' : 'Prepara ordine'}</button>
    </form>
  );
}
