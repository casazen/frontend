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

const statuses: Record<string, string> = {
  PendingQuote: 'Preventivo in attesa', Quoted: 'Da confermare', Authorized: 'Importo autorizzato',
  CardSaved: 'Carta di test registrata', Accepted: 'Prenotato', Declined: 'Rifiutato', Completed: 'Servizio completato',
  Disputed: 'Controversia aperta', Resolved: 'Controversia risolta', Released: 'Pagamento rilasciato',
};

export const orderStatus = (state: string) => statuses[state] ?? state;
export const orderMoney = (cents: number, language = 'it') =>
  new Intl.NumberFormat(language, { style: 'currency', currency: 'EUR' }).format(cents / 100);

