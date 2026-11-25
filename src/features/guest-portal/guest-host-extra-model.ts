import { useQuery } from '@tanstack/react-query';
import { ApiClient } from '@/api/client';

export const extraLabels = {
  it: ['Extra dell’host', 'Caricamento…', 'Nessun extra disponibile', 'Richiedi', 'Prenota', 'Quantità', 'Paga ora', 'Annulla', 'Operazione non riuscita', 'I tuoi ordini'],
  en: ['Host extras', 'Loading…', 'No extras available', 'Request', 'Book', 'Quantity', 'Pay now', 'Cancel', 'Something went wrong', 'Your orders'],
  de: ['Extras der Unterkunft', 'Wird geladen…', 'Keine Extras verfügbar', 'Anfragen', 'Buchen', 'Menge', 'Jetzt bezahlen', 'Stornieren', 'Aktion fehlgeschlagen', 'Deine Bestellungen'],
  fr: ['Extras de l’hôte', 'Chargement…', 'Aucun extra disponible', 'Demander', 'Réserver', 'Quantité', 'Payer maintenant', 'Annuler', 'Échec de l’opération', 'Vos commandes'],
  es: ['Extras del anfitrión', 'Cargando…', 'No hay extras disponibles', 'Solicitar', 'Reservar', 'Cantidad', 'Pagar ahora', 'Cancelar', 'La operación falló', 'Tus pedidos'],
} as const;

const statuses = {
  it: ['Richiesto', 'Da pagare', 'Pagato', 'Rifiutato', 'Erogato', 'Annullato', 'Carta da autorizzare', 'Incasso in corso'],
  en: ['Requested', 'Awaiting payment', 'Paid', 'Declined', 'Fulfilled', 'Cancelled', 'Card authorization required', 'Payment processing'],
  de: ['Angefragt', 'Zahlung ausstehend', 'Bezahlt', 'Abgelehnt', 'Erbracht', 'Storniert', 'Kartenautorisierung erforderlich', 'Zahlung wird verarbeitet'],
  fr: ['Demandé', 'En attente du paiement', 'Payé', 'Refusé', 'Fourni', 'Annulé', 'Autorisation de la carte requise', 'Paiement en cours'],
  es: ['Solicitado', 'Pendiente de pago', 'Pagado', 'Rechazado', 'Entregado', 'Cancelado', 'Se requiere autorización de la tarjeta', 'Pago en curso'],
} as const;

export type Language = keyof typeof extraLabels;
interface Offer {
  id: string;
  name: string;
  description: string;
  unitPrice: number;
  currency: string;
  byQuantity: boolean;
  requiresApproval: boolean;
}
const statusKeys = ['Requested', 'ReadyToPay', 'Paid', 'Declined', 'Fulfilled', 'Cancelled', 'AwaitingAuthorization', 'CapturePending'] as const;
export const canPayExtraOrder = (status: HostExtraStatus) => status === 'ReadyToPay' || status === 'AwaitingAuthorization';
export type HostExtraStatus = typeof statusKeys[number];

export interface HostExtraOrder {
  id: string;
  name: string;
  quantity: number;
  amount: number;
  currency: string;
  status: HostExtraStatus;
}

export function useGuestHostExtras(path: string, language: Language, enabled: boolean, trackOrders = false) {
  return useQuery({
    queryKey: ['guest-host-extras', path, language],
    queryFn: ({ signal }) => ApiClient.get<{ offers: Offer[]; orders: HostExtraOrder[] }>(
      `${path}/host-extras`, { lang: language }, { public: true, signal },
    ),
    enabled, retry: false, gcTime: 0,
    refetchInterval: ({ state }) => trackOrders && state.data?.orders.some(
      (order) => order.status === 'Requested' || order.status === 'CapturePending' || canPayExtraOrder(order.status),
    ) ? 5000 : false,
  });
}

export function formatExtraPrice(language: string, amount: number, currency: string) {
  return new Intl.NumberFormat(language, { style: 'currency', currency }).format(amount);
}

export function hostExtraStatus(language: Language, status: HostExtraStatus) {
  return statuses[language][statusKeys.indexOf(status)];
}
