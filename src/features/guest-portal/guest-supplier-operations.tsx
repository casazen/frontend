import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getHttpStatus } from '@/lib/api-errors';
import { orderMoney, orderStatus, type GuestSupplierOrder } from './guest-supplier-order-model';

interface OfferTerms {
  id: string;
  serviceId: string;
  commissionBasisPoints: number;
  hostOrigin: boolean;
  accepted: boolean;
  enabled: boolean;
  version: number;
}

interface OrderList {
  offers: OfferTerms[];
  orders: GuestSupplierOrder[];
}

interface CatalogMatch {
  id: string;
  name: string;
  supplier: string;
}

type Scope = { role: 'host'; propertyId: string } | { role: 'supplier' } | { role: 'admin' };

export function GuestSupplierOperations({ scope }: { scope: Scope }) {
  const endpoint = scope.role === 'host' ? `/properties/${scope.propertyId}/guest-supplier-orders`
    : scope.role === 'supplier' ? '/supplier/guest-orders' : '/admin/guest-supplier-orders';
  const query = useQuery({
    queryKey: ['guest-supplier-operations', endpoint],
    queryFn: async ({ signal }): Promise<OrderList> => {
      if (scope.role === 'admin') {
        return { offers: [], orders: await ApiClient.get<GuestSupplierOrder[]>(endpoint, undefined, { signal }) };
      }
      return ApiClient.get<OrderList>(endpoint, undefined, { signal });
    },
    retry: false,
  });
  const change = useMutation({
    mutationFn: ({ suffix, body, method }: { suffix: string; body: object; method?: 'put' }) =>
      method === 'put' ? ApiClient.put(`${endpoint}${suffix}`, body) : ApiClient.post(`${endpoint}${suffix}`, body),
    onSuccess: () => { void query.refetch(); },
  });
  if (query.isPending) return <p role="status">Caricamento ordini ospiti…</p>;
  if (query.isError) return getHttpStatus(query.error) === 404 || getHttpStatus(query.error) === 403
    ? null : <p role="alert">Impossibile caricare gli ordini ospiti.</p>;

  return (
    <section className="grid gap-4 rounded-lg border bg-card p-4">
      <h2 className="font-semibold">Servizi e ordini ospiti</h2>
      <p>Ambiente di test. Pagamenti e rimborsi simulati.</p>
      {scope.role === 'host' && <ConfigureOffer endpoint={endpoint} offers={query.data.offers}
        busy={change.isPending} save={(id, commissionBasisPoints, enabled) =>
          change.mutate({ suffix: `/offers/${id}`, method: 'put', body: { commissionBasisPoints, enabled } })} />}
      {scope.role === 'supplier' && query.data.offers.map((offer) => (
        <div className="flex flex-wrap items-center gap-3" key={offer.id}>
          <span>Commissione {offer.hostOrigin ? 'host' : 'CasaZen'} {offer.commissionBasisPoints / 100}% · {offer.accepted ? 'Accettata' : 'In attesa'}</span>
          <Button disabled={change.isPending} onClick={() => change.mutate({
            suffix: `/offers/${offer.id}/consent`,
            body: { accepted: !offer.accepted, commissionBasisPoints: offer.commissionBasisPoints, version: offer.version },
          })}>{offer.accepted ? 'Revoca consenso' : 'Accetta commissione'}</Button>
        </div>
      ))}
      {query.data.orders.length === 0 && <p>Nessun ordine.</p>}
      {query.data.orders.map((order) => {
        const transition = (action: string, data = {}) => change.mutate({
          suffix: `/${order.id}/transition`, body: { action, ...data },
        });
        const disputable = order.state === 'Disputed';
        return (
          <article className="grid gap-2 rounded-lg border p-3" key={order.id}>
            <h3 className="font-semibold">{order.serviceName} · {order.supplierName}</h3>
            <p>{orderStatus(order.state)} · {orderMoney(order.totalCents)}</p>
            <p>{new Date(order.requestedFor).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}</p>
            {order.requestNote && <p>Note: {order.requestNote}</p>}
            {order.complaint && <p>Segnalazione: {order.complaint}</p>}
            {order.supplierReply && <p>Risposta fornitore: {order.supplierReply}</p>}
            {order.decision && <p>Decisione: {order.decision} · Rimborso {orderMoney(order.refundCents)}</p>}
            {scope.role === 'supplier' && <>
              {order.state === 'PendingQuote' && <ActionForm amountLabel="Prezzo in euro" button="Invia preventivo" busy={change.isPending}
                send={(priceCents) => transition('quote', { priceCents })} />}
              <div className="flex flex-wrap gap-2">
                {['Authorized', 'CardSaved'].includes(order.state) && <Button disabled={change.isPending} onClick={() => transition('accept')}>Accetta ordine</Button>}
                {['PendingQuote', 'Quoted', 'Authorized', 'CardSaved'].includes(order.state) && <Button variant="outline"
                  disabled={change.isPending} onClick={() => transition('decline')}>Rifiuta ordine</Button>}
                {order.state === 'Accepted' && <Button disabled={change.isPending} onClick={() => transition('complete')}>Completa servizio</Button>}
              </div>
              {disputable && !order.supplierReply && <ActionForm textLabel="Risposta alla segnalazione" button="Invia risposta"
                busy={change.isPending} send={(_, text) => transition('reply', { text })} />}
            </>}
            {disputable && (scope.role === 'admin' || (scope.role === 'host' && order.hostOrigin)) && <ActionForm
              amountLabel="Rimborso in euro" textLabel="Motivazione della decisione" button="Risolvi controversia" maxCents={order.totalCents}
              busy={change.isPending} send={(refundCents, text) => change.mutate({ suffix: `/${order.id}/resolve`, body: { refundCents, text } })} />}
          </article>
        );
      })}
      {change.isError && <p role="alert">Operazione non riuscita. Aggiorna la pagina e riprova.</p>}
    </section>
  );
}

function ActionForm({ amountLabel, textLabel, button, busy, maxCents, send }: {
  amountLabel?: string;
  textLabel?: string;
  button: string;
  busy: boolean;
  maxCents?: number;
  send: (cents: number, text: string) => void;
}) {
  return <form className="grid gap-2" onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    send(Math.round(Number(data.get('amount')) * 100), String(data.get('text') ?? '').trim());
  }}>
    {amountLabel && <label>{amountLabel}<Input type="number" name="amount" required
      min={maxCents === undefined ? 0.01 : 0} step={0.01} max={maxCents === undefined ? 100000 : maxCents / 100} /></label>}
    {textLabel && <label>{textLabel}<Textarea name="text" required maxLength={2000} /></label>}
    <Button className="justify-self-start" disabled={busy}>{button}</Button>
  </form>;
}

function ConfigureOffer({ endpoint, offers, busy, save }: {
  endpoint: string; offers: OfferTerms[]; busy: boolean;
  save: (id: string, commissionBasisPoints: number, enabled: boolean) => void;
}) {
  const [term, setTerm] = useState('');
  const found = useQuery({
    queryKey: ['guest-supplier-catalog', endpoint, term],
    queryFn: ({ signal }) => ApiClient.get<CatalogMatch[]>(`${endpoint}/catalog`, { search: term }, { signal }),
    enabled: term.length >= 2,
    retry: false,
  });

  return <>
    <form className="grid gap-2 sm:grid-cols-[1fr_auto]" onSubmit={(event) => {
      event.preventDefault();
      setTerm(String(new FormData(event.currentTarget).get('search')).trim());
    }}>
      <label>Cerca servizi o fornitori<Input name="search" required minLength={2} maxLength={100} /></label>
      <Button className="self-end" variant="outline">Cerca</Button>
    </form>
    {found.isFetching && <p role="status">Ricerca in corso…</p>}
    {found.isError && <p role="alert">Ricerca non riuscita.</p>}
    {found.data?.length === 0 && <p>Nessun servizio trovato.</p>}
    {found.data?.map((item) => {
      const offer = offers.find((entry) => entry.serviceId === item.id);
      return <form className="grid gap-2 rounded border p-3" key={`${item.id}:${offer?.version ?? ''}`} onSubmit={(event) => {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        save(item.id, Math.round(Number(fields.get('commission')) * 100), fields.has('enabled'));
      }}>
        <h3>{item.name} · {item.supplier}</h3>
        {offer && <p>{offer.accepted ? 'Commissione accettata' : 'In attesa di consenso'} · {offer.commissionBasisPoints / 100}%</p>}
        {offer?.hostOrigin !== false && <label>Commissione host (%)
          <Input name="commission" type="number" step={0.01} min={0} max={50} defaultValue={(offer?.commissionBasisPoints ?? 0) / 100} />
        </label>}
        <label className="flex items-center gap-2"><input type="checkbox" name="enabled" defaultChecked={offer?.enabled ?? true} /> Disponibile nel portale</label>
        <Button className="justify-self-start" disabled={busy}>Salva servizio</Button>
      </form>;
    })}
  </>;
}
