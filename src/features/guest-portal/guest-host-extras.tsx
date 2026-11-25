import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '@/api/client';
import { StripeIntentPayment } from '@/features/public-booking/components/stripe-intent-payment';
import { stripeLocale } from '@/lib/stripe-appearance';

export const extraLabels = {
  it: ['Extra dell’host', 'Caricamento…', 'Nessun extra disponibile', 'Richiedi', 'Prenota', 'Quantità', 'Paga ora', 'Annulla', 'Operazione non riuscita', 'I tuoi ordini'],
  en: ['Host extras', 'Loading…', 'No extras available', 'Request', 'Book', 'Quantity', 'Pay now', 'Cancel', 'Something went wrong', 'Your orders'],
  de: ['Extras der Unterkunft', 'Wird geladen…', 'Keine Extras verfügbar', 'Anfragen', 'Buchen', 'Menge', 'Jetzt bezahlen', 'Stornieren', 'Aktion fehlgeschlagen', 'Deine Bestellungen'],
  fr: ['Extras de l’hôte', 'Chargement…', 'Aucun extra disponible', 'Demander', 'Réserver', 'Quantité', 'Payer maintenant', 'Annuler', 'Échec de l’opération', 'Vos commandes'],
  es: ['Extras del anfitrión', 'Cargando…', 'No hay extras disponibles', 'Solicitar', 'Reservar', 'Cantidad', 'Pagar ahora', 'Cancelar', 'La operación falló', 'Tus pedidos'],
} as const;

const statuses = {
  it: ['Richiesto', 'Da pagare', 'Pagato', 'Rifiutato', 'Erogato', 'Annullato'],
  en: ['Requested', 'Awaiting payment', 'Paid', 'Declined', 'Fulfilled', 'Cancelled'],
  de: ['Angefragt', 'Zahlung ausstehend', 'Bezahlt', 'Abgelehnt', 'Erbracht', 'Storniert'],
  fr: ['Demandé', 'En attente du paiement', 'Payé', 'Refusé', 'Fourni', 'Annulé'],
  es: ['Solicitado', 'Pendiente de pago', 'Pagado', 'Rechazado', 'Entregado', 'Cancelado'],
} as const;

type Language = keyof typeof extraLabels;
interface Offer {
  id: string;
  name: string;
  description: string;
  unitPrice: number;
  currency: string;
  byQuantity: boolean;
  requiresApproval: boolean;
}
const statusKeys = ['Requested', 'ReadyToPay', 'Paid', 'Declined', 'Fulfilled', 'Cancelled'] as const;
export type HostExtraStatus = typeof statusKeys[number];

export interface HostExtraOrder {
  id: string;
  name: string;
  quantity: number;
  amount: number;
  currency: string;
  status: HostExtraStatus;
}
interface Payment {
  clientSecret: string;
  publishableKey: string;
  stripeAccountId: string;
}

export function useGuestHostExtras(path: string, language: Language, enabled: boolean, trackOrders = false) {
  return useQuery({
    queryKey: ['guest-host-extras', path, language],
    queryFn: ({ signal }) => ApiClient.get<{ offers: Offer[]; orders: HostExtraOrder[] }>(
      `${path}/host-extras`, { lang: language }, { public: true, signal },
    ),
    enabled, retry: false, gcTime: 0,
    refetchInterval: ({ state }) => trackOrders && state.data?.orders.some(
      (order) => order.status === 'Requested' || order.status === 'ReadyToPay',
    ) ? 5000 : false,
  });
}

export function formatExtraPrice(language: string, amount: number, currency: string) {
  return new Intl.NumberFormat(language, { style: 'currency', currency }).format(amount);
}

export function hostExtraStatus(language: Language, status: HostExtraStatus) {
  return statuses[language][statusKeys.indexOf(status)];
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
      if (order.status === 'ReadyToPay') pay.mutate(order.id);
    },
  });
  const pay = useMutation({
    mutationFn: async (id: string) => ({
      id,
      session: await ApiClient.post<Payment>(`${path}/host-extra-orders/${id}/payment`, undefined, { public: true }),
    }),
    onSuccess: (next) => { setActivePayment(next); setPaymentError(''); },
  });
  const cancel = useMutation({
    mutationFn: (id: string) => ApiClient.delete(`${path}/host-extra-orders/${id}`, { public: true }),
    onSuccess: () => { setActivePayment(undefined); return refresh(); },
  });

  const returnUrl = new URL(window.location.pathname, window.location.origin);
  returnUrl.search = new URLSearchParams({ lang: language, page: 'extras' }).toString();

  return (
    <div className="stay-content">
      {content.isPending && <p role="status">{labels[1]}</p>}
      {(content.isError || reserve.isError || pay.isError || cancel.isError) && <p role="alert">{labels[8]}</p>}
      {content.isSuccess && content.data.offers.length === 0 && <p>{labels[2]}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
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
      </div>
      {content.data?.orders.length ? <h2>{labels[9]}</h2> : null}
      {content.data?.orders.map((order) => (
        <article className="stay-card stay-content" key={order.id}>
          <h3>{order.name}</h3>
          <p>{formatExtraPrice(language, order.amount, order.currency)} · {hostExtraStatus(language, order.status)}</p>
          {order.status === 'ReadyToPay' && activePayment?.id !== order.id && <button type="button" disabled={pay.isPending}
            onClick={() => pay.mutate(order.id)}>{labels[6]}</button>}
          {order.status === 'ReadyToPay' && activePayment?.id === order.id && (
            <StripeIntentPayment mode="payment" {...activePayment.session} locale={stripeLocale(language)}
              returnUrl={returnUrl.href}
              onSubmitted={() => { setActivePayment(undefined); void refresh(); }} onError={setPaymentError} />
          )}
          {paymentError && activePayment?.id === order.id && <p role="alert">{paymentError}</p>}
          {(order.status === 'Requested' || order.status === 'ReadyToPay') && <button type="button" disabled={cancel.isPending}
            onClick={() => cancel.mutate(order.id)}>{labels[7]}</button>}
        </article>
      ))}
    </div>
  );
}
