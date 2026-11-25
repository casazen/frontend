export interface GuestSupplierOrder {
  id: string;
  serviceName: string;
  supplierName: string;
  state: string;
  requestedFor: string;
  completedAt: string | null;
  supplierPriceCents: number;
  commissionCents: number;
  totalCents: number;
  refundCents: number;
  hostOrigin: boolean;
  requestNote: string | null;
  complaint: string | null;
  supplierReply: string | null;
  decision: string | null;
}

const statuses: Record<string, readonly [string, string, string, string, string]> = {
  PendingQuote: ['Preventivo in attesa', 'Awaiting quote', 'Angebot ausstehend', 'Devis en attente', 'Presupuesto pendiente'],
  Quoted: ['Da confermare', 'Awaiting confirmation', 'Bestätigung ausstehend', 'À confirmer', 'Pendiente de confirmación'],
  Authorized: ['Importo autorizzato', 'Payment authorized', 'Zahlung autorisiert', 'Paiement autorisé', 'Pago autorizado'],
  CardSaved: ['Carta di test registrata', 'Test card saved', 'Testkarte gespeichert', 'Carte de test enregistrée', 'Tarjeta de prueba guardada'],
  Accepted: ['Prenotato', 'Booked', 'Gebucht', 'Réservé', 'Reservado'],
  Declined: ['Rifiutato', 'Declined', 'Abgelehnt', 'Refusé', 'Rechazado'],
  Completed: ['Servizio completato', 'Service completed', 'Leistung abgeschlossen', 'Service effectué', 'Servicio completado'],
  Disputed: ['Controversia aperta', 'Dispute open', 'Reklamation offen', 'Litige ouvert', 'Reclamación abierta'],
  Resolved: ['Controversia risolta', 'Dispute resolved', 'Reklamation geklärt', 'Litige résolu', 'Reclamación resuelta'],
  Released: ['Pagamento rilasciato', 'Payment released', 'Zahlung freigegeben', 'Paiement débloqué', 'Pago liberado'],
};

export function orderStatus(state: string, language = 'it') {
  const index = ['it', 'en', 'de', 'fr', 'es'].indexOf(language.toLowerCase().split('-')[0]);
  return statuses[state]?.[index < 0 ? 1 : index] ?? state;
}
export const orderMoney = (cents: number, language = 'it') =>
  new Intl.NumberFormat(language, { style: 'currency', currency: 'EUR' }).format(cents / 100);
