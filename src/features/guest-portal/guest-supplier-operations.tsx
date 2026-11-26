import { SupplierInviteIdentityFields } from '@/features/supplier/supplier-invite-identity-fields';
import { readSupplierInviteIdentity } from '@/features/supplier/read-supplier-invite-identity';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ApiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getHttpStatus } from '@/lib/api-errors';
import { GUEST_ORDER_REFRESH_MS, orderMoney, orderStatus, type GuestSupplierOrder } from './guest-supplier-order-model';

interface OfferTerms {
  id: string;
  serviceId: string;
  serviceName: string;
  supplierName: string;
  propertyName?: string;
  hostName?: string;
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
  hostOrigin: boolean;
  commissionBasisPoints: number;
}

type Scope = { role: 'host'; propertyId: string } | { role: 'supplier' } | { role: 'admin' };

export function GuestSupplierOperations({ scope }: { scope: Scope }) {
  const { t } = useTranslation();
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
    refetchOnWindowFocus: 'always',
    refetchInterval: ({ state }) => scope.role === 'supplier' && state.data && !state.error ? GUEST_ORDER_REFRESH_MS : false,
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
      <p>Ambiente di test per gli ordini ospiti.</p>
      {scope.role === 'host' && <>
        <ConfigureOffer endpoint={endpoint} offers={query.data.offers}
          busy={change.isPending} save={(id, commissionBasisPoints, enabled) =>
            change.mutate({ suffix: `/offers/${id}`, method: 'put', body: { commissionBasisPoints, enabled } })} />
      </>}
      {scope.role === 'supplier' && query.data.offers.map((offer) => (
        <div className="grid gap-2 rounded border p-3" key={offer.id}>
          <h3 className="font-semibold">{offer.serviceName}</h3>
          {(offer.propertyName || offer.hostName) && <p>{[offer.propertyName, offer.hostName].filter(Boolean).join(' · ')}</p>}
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
            <p>{orderStatus(order.state)} · {orderMoney(order.totalCents)} · {order.stripeSandbox ? 'Stripe sandbox' : 'Simulazione'}</p>
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
                {['PendingQuote', 'Quoted', 'Authorized', 'CardSaved', 'PaymentFailed', 'PaymentActionRequired'].includes(order.state) && <Button variant="outline"
                  disabled={change.isPending} onClick={() => transition('decline')}>Rifiuta ordine</Button>}
                {order.state === 'Accepted' && <Button disabled={change.isPending} onClick={() => transition('complete')}>Completa servizio</Button>}
              </div>
              {disputable && !order.supplierReply && <ActionForm textLabel="Risposta alla segnalazione" button="Invia risposta"
                busy={change.isPending} send={(_, text) => transition('reply', { text })} />}
            </>}
            {disputable && (scope.role === 'admin' || (scope.role === 'host' && order.hostOrigin)) && <ActionForm
              amountLabel={order.stripeSandbox ? undefined : 'Rimborso in euro'} textLabel="Motivazione della decisione"
              button={order.stripeSandbox ? 'Chiudi senza rimborso' : 'Risolvi controversia'} maxCents={order.totalCents}
              busy={change.isPending} send={(refundCents, text) => change.mutate({ suffix: `/${order.id}/resolve`, body: { refundCents, text } })} />}
          </article>
        );
      })}
      {change.isSuccess && change.variables.method === 'put' && <p role="status">{t('supplier.trusted.serviceSaved')}</p>}
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
  const { t } = useTranslation();
  const [term, setTerm] = useState('');
  const [origin, setOrigin] = useState<'host' | 'marketplace'>('host');
  const found = useQuery({
    queryKey: ['guest-supplier-catalog', endpoint, term, origin],
    queryFn: ({ signal }) => ApiClient.get<CatalogMatch[]>(`${endpoint}/catalog`, { search: term, origin }, { signal }),
    enabled: term.length >= 2,
    retry: false,
  });

  const hostOrigin = origin === 'host';
  const configured = offers.filter((offer) => offer.hostOrigin === hostOrigin);
  const available = found.data?.filter((item) => item.hostOrigin === hostOrigin && !offers.some((offer) => offer.serviceId === item.id));

  return <section className="grid gap-4">
    <div role="group" aria-label={t('supplier.trusted.source')} className="flex flex-wrap gap-2">
      <Button type="button" aria-pressed={hostOrigin} variant={hostOrigin ? 'default' : 'outline'} onClick={() => setOrigin('host')}>{t('supplier.trusted.privateDirectory')}</Button>
      <Button type="button" aria-pressed={!hostOrigin} variant={hostOrigin ? 'outline' : 'default'} onClick={() => setOrigin('marketplace')}>{t('supplier.trusted.marketplace')}</Button>
    </div>
    <p>{hostOrigin ? t('supplier.trusted.hostTerms') : t('supplier.trusted.marketplaceTerms')}</p>
    {hostOrigin && <InviteTrustedSupplier endpoint={endpoint} />}
    <h3 className="font-semibold">{t('supplier.trusted.configured')}</h3>
    {configured.length === 0 && <p>{t('supplier.trusted.noneConfigured')}</p>}
    {configured.map((offer) => <ServiceOfferForm key={offer.id + ':' + offer.version}
      item={{ id: offer.serviceId, name: offer.serviceName, supplier: offer.supplierName, hostOrigin, commissionBasisPoints: offer.commissionBasisPoints }}
      offer={offer} busy={busy} save={save} />)}
    <form className="grid gap-2 sm:grid-cols-[1fr_auto]" onSubmit={(event) => {
      event.preventDefault();
      setTerm(String(new FormData(event.currentTarget).get('search')).trim());
    }}>
      <label>{t('supplier.trusted.findServices')}<Input name="search" required minLength={2} maxLength={100} /></label>
      <Button className="self-end" variant="outline">Cerca</Button>
    </form>
    {found.isFetching && <p role="status">Ricerca in corso…</p>}
    {found.isError && <p role="alert">Ricerca non riuscita.</p>}
    {available?.length === 0 && <p role="status">{t('supplier.trusted.noMatches')}</p>}
    {available?.map((item) => <ServiceOfferForm key={item.id} item={item} busy={busy} save={save} />)}
  </section>;
}

function ServiceOfferForm({ item, offer, busy, save }: {
  item: CatalogMatch; offer?: OfferTerms; busy: boolean;
  save: (id: string, commissionBasisPoints: number, enabled: boolean) => void;
}) {
  const { t } = useTranslation();
  return <form className="grid gap-2 rounded border p-3" onSubmit={(event) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const rate = item.hostOrigin ? Math.round(Number(fields.get('commission')) * 100) : item.commissionBasisPoints;
    save(item.id, rate, fields.has('enabled'));
  }}>
    <h4 className="font-semibold">{item.name} · {item.supplier}</h4>
    {offer && <p>{offer.accepted ? t('supplier.trusted.accepted') : t('supplier.trusted.pending')}</p>}
    {item.hostOrigin ? <label>{t('supplier.trusted.hostRate')}
      <Input name="commission" type="number" required step={0.01} min={0} max={50} defaultValue={item.commissionBasisPoints / 100} />
    </label> : <p>{t('supplier.trusted.platformRate', { rate: item.commissionBasisPoints / 100 })}</p>}
    <label className="flex items-center gap-2"><input type="checkbox" name="enabled" defaultChecked={offer?.enabled ?? true} /> {t('supplier.trusted.exposed')}</label>
    <Button className="justify-self-start" disabled={busy}>{t('supplier.trusted.save')}</Button>
  </form>;
}

function InviteTrustedSupplier({ endpoint }: { endpoint: string }) {
  const [email, setEmail] = useState('');
  const invite = useMutation({
    mutationFn: (form: HTMLFormElement) => ApiClient.post<void>(`${endpoint}/invite`, { email: email.trim(), ...readSupplierInviteIdentity(form) }),
    onSuccess: (_, form) => { setEmail(''); form.reset(); },
  });

  return <div className="grid gap-2">
    <form className="grid gap-2 sm:grid-cols-[1fr_auto]" onSubmit={(event) => {
      event.preventDefault();
      invite.mutate(event.currentTarget);
    }}>
      <label>Email del fornitore di fiducia<Input type="email" required maxLength={255} value={email}
        onChange={(event) => setEmail(event.target.value)} /></label>
      <div className="sm:col-span-2"><SupplierInviteIdentityFields /></div>
      <Button className="justify-self-start" variant="outline" disabled={invite.isPending}>Invita fornitore</Button>
    </form>
    {invite.isSuccess && <p role="status">Richiesta registrata. Dopo la verifica il fornitore riceverà il link per accettare.</p>}
    {invite.isError && <p role="alert">Impossibile creare l’invito.</p>}
  </div>;
}

export function MarketplaceSettings() {
  const endpoint = '/admin/suppliers/marketplace';
  const [term, setTerm] = useState('');
  const suppliers = useQuery({
    queryKey: ['guest-supplier-marketplace', term],
    queryFn: ({ signal }) => ApiClient.get<{ orgId: string; legalName: string; enabled: boolean }[]>(
      endpoint, { search: term }, { signal },
    ),
    enabled: term.length >= 2,
    retry: false,
  });
  const publish = useMutation({
    mutationFn: ({ orgId, enabled }: { orgId: string; enabled: boolean }) =>
      ApiClient.put<void>(`${endpoint}/${orgId}`, { enabled }),
    onSuccess: () => { void suppliers.refetch(); },
  });

  return <div className="grid gap-2">
    <form className="grid gap-2 sm:grid-cols-[1fr_auto]" onSubmit={(event) => {
      event.preventDefault();
      setTerm(String(new FormData(event.currentTarget).get('search')).trim());
    }}>
      <label>Fornitori nel marketplace CasaZen<Input name="search" required minLength={2} maxLength={100} /></label>
      <Button className="self-end" variant="outline">Cerca</Button>
    </form>
    {suppliers.isFetching && <p role="status">Ricerca in corso…</p>}
    {suppliers.data?.length === 0 && <p>Nessun fornitore trovato.</p>}
    {suppliers.isError && <p role="alert">Ricerca non riuscita.</p>}
    {suppliers.data?.map((supplier) => <div className="flex flex-wrap items-center gap-2" key={supplier.orgId}>
      <span>{supplier.legalName}</span>
      <Button variant="outline" disabled={publish.isPending} onClick={() => publish.mutate({
        orgId: supplier.orgId, enabled: !supplier.enabled,
      })}>{supplier.enabled ? 'Rimuovi dal marketplace' : 'Pubblica nel marketplace'}</Button>
    </div>)}
    {publish.isError && <p role="alert">Impossibile aggiornare il marketplace.</p>}
  </div>;
}
