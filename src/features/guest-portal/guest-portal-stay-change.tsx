import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '@/api/client';
import { Link } from 'react-router-dom';
import { getHttpStatus } from '@/lib/api-errors';

interface StayChangeQuote {
  previousTotal: number;
  newTotal: number;
  currency: string;
}

interface StayChangeStatus extends StayChangeQuote {
  arrival: string;
  departure: string;
  approvedAt: string | null;
  rejectedAt: string | null;
}

const copy = {
  it: ['Modifica il soggiorno', 'Arrivo', 'Partenza', 'Adulti', 'Bambini', 'Età del bambino', 'Calcola il prezzo', 'Totale attuale', 'Nuovo totale', 'Invia richiesta', 'In attesa di approvazione', 'Modifica approvata', 'Richiesta rifiutata', 'Verifica le date e gli ospiti oppure riprova.', 'Chiudi'],
  en: ['Change your stay', 'Arrival', 'Departure', 'Adults', 'Children', 'Child’s age', 'Get a quote', 'Current total', 'New total', 'Send request', 'Awaiting approval', 'Change approved', 'Request declined', 'Check the dates and guests or try again.', 'Close'],
  de: ['Aufenthalt ändern', 'Anreise', 'Abreise', 'Erwachsene', 'Kinder', 'Alter des Kindes', 'Preis berechnen', 'Aktueller Gesamtpreis', 'Neuer Gesamtpreis', 'Anfrage senden', 'Genehmigung ausstehend', 'Änderung genehmigt', 'Anfrage abgelehnt', 'Prüfe die Daten und Gäste oder versuche es erneut.', 'Schließen'],
  fr: ['Modifier le séjour', 'Arrivée', 'Départ', 'Adultes', 'Enfants', 'Âge de l’enfant', 'Calculer le prix', 'Total actuel', 'Nouveau total', 'Envoyer la demande', 'En attente d’approbation', 'Modification approuvée', 'Demande refusée', 'Vérifiez les dates et les voyageurs ou réessayez.', 'Fermer'],
  es: ['Modificar la estancia', 'Llegada', 'Salida', 'Adultos', 'Niños', 'Edad del niño', 'Calcular el precio', 'Total actual', 'Nuevo total', 'Enviar solicitud', 'Pendiente de aprobación', 'Cambio aprobado', 'Solicitud rechazada', 'Comprueba las fechas y los huéspedes o inténtalo de nuevo.', 'Cerrar'],
} as const;

export function GuestPortalStayChange({ path, language, arrival, departure, paymentsHref }: {
  path: string;
  language: keyof typeof copy;
  arrival: string;
  departure: string;
  paymentsHref: string;
}) {
  const client = useQueryClient();
  const endpoint = `${path}/stay-change`;
  const [open, setOpen] = useState(false);
  const status = useQuery({
    queryKey: [endpoint],
    queryFn: ({ signal }) => ApiClient.get<{ canRequest: boolean; adults: number; children: number; latest: StayChangeStatus | null }>(
      endpoint, undefined, { public: true, signal },
    ),
    retry: false,
    gcTime: 0,
    refetchInterval: (query) => query.state.data?.latest && !query.state.data.latest.approvedAt && !query.state.data.latest.rejectedAt ? 15000 : false,
  });
  const [title, arriveLabel, leaveLabel, adultsLabel, childrenLabel, ageLabel, calculate, before, after, send, pending, approved, rejected, error, close] = copy[language];
  const latest = status.data?.latest;
  const approvedAt = latest?.approvedAt;
  useEffect(() => {
    if (approvedAt) void client.invalidateQueries({ queryKey: ['guest-portal', path.split('/').at(-1)] });
  }, [approvedAt, client, path]);
  if (!status.data) return status.isError && getHttpStatus(status.error) !== 404 ? <p role="alert">{error}</p> : null;
  if (!status.data.canRequest && !latest) return null;
  const paymentLabels = { it: "Vai ai pagamenti", en: "Go to payments", de: "Zu den Zahlungen", fr: "Accéder aux paiements", es: "Ir a los pagos" };
  const dateRange = (start: string, end: string) => new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeZone: 'UTC' })
    .formatRange(new Date(start), new Date(end));
  return (
    <section className="stay-card stay-content">
      <h2>{title}</h2>
      {latest && <p role="status">{latest.approvedAt ? approved : latest.rejectedAt ? rejected : pending} · {dateRange(latest.arrival, latest.departure)}</p>}
      {latest?.approvedAt && latest.newTotal > latest.previousTotal && <Link to={paymentsHref}>{paymentLabels[language]}</Link>}
      {status.data.canRequest && (
        <>
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? close : title}</button>
          {open && <StayChangeForm endpoint={endpoint} arrival={arrival} departure={departure} adults={status.data.adults}
            children={status.data.children} language={language}
            labels={{ arriveLabel, leaveLabel, adultsLabel, childrenLabel, ageLabel, calculate, before, after, send, error }}
            onSent={() => { setOpen(false); void status.refetch(); }} />}
        </>
      )}
    </section>
  );
}

function StayChangeForm({ endpoint, arrival, departure, adults, children, language, labels, onSent }: {
  endpoint: string;
  arrival: string;
  departure: string;
  adults: number;
  children: number;
  language: string;
  labels: Record<'arriveLabel' | 'leaveLabel' | 'adultsLabel' | 'childrenLabel' | 'ageLabel' | 'calculate' | 'before' | 'after' | 'send' | 'error', string>;
  onSent: () => void;
}) {
  const [childCount, setChildCount] = useState(children);
  const quote = useMutation({
    mutationFn: (input: { arrival: string; departure: string; adults: number; childrenAges: number[] }) =>
      ApiClient.post<StayChangeQuote>(`${endpoint}/quote`, input, { public: true }),
  });
  const submit = useMutation({
    mutationFn: () => ApiClient.post(endpoint, { ...quote.variables, expectedTotal: quote.data!.newTotal }, { public: true }),
    onSuccess: onSent,
  });
  function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    quote.mutate({
      arrival: String(form.get('arrival')),
      departure: String(form.get('departure')),
      adults: Number(form.get('adults')),
      childrenAges: form.getAll('age').map(Number),
    });
  }
  const money = (value: number, currency: string) => new Intl.NumberFormat(language, { style: 'currency', currency }).format(value);
  return (
    <>
      <form className="grid gap-3" onSubmit={preview} onChange={() => { quote.reset(); submit.reset(); }}>
        <fieldset className="grid gap-3 sm:grid-cols-2" disabled={submit.isPending || quote.isPending}>
          <label className="grid gap-1">{labels.arriveLabel}<input className="rounded border px-2 py-1" name="arrival" type="date" defaultValue={arrival.slice(0, 10)} required /></label>
          <label className="grid gap-1">{labels.leaveLabel}<input className="rounded border px-2 py-1" name="departure" type="date" defaultValue={departure.slice(0, 10)} required /></label>
          <label className="grid gap-1">{labels.adultsLabel}<input className="rounded border px-2 py-1" name="adults" type="number" min={1} max={100} defaultValue={adults} required /></label>
          <label className="grid gap-1">{labels.childrenLabel}<input className="rounded border px-2 py-1" type="number" min={0} max={100} value={childCount} onChange={(event) => setChildCount(Math.min(100, Math.max(0, Math.floor(event.target.valueAsNumber || 0))))} required /></label>
          {Array.from({ length: childCount }, (_, index) => (
            <label className="grid gap-1" key={index}>{labels.ageLabel} {index + 1}<input className="rounded border px-2 py-1" name="age" type="number" min={0} max={17} required /></label>
          ))}
          <button type="submit">{labels.calculate}</button>
        </fieldset>
      </form>
      {quote.isError || submit.isError ? <p role="alert">{labels.error}</p> : null}
      {quote.data && (
        <div>
          <p>{labels.before} <strong>{money(quote.data.previousTotal, quote.data.currency)}</strong></p>
          <p>{labels.after} <strong>{money(quote.data.newTotal, quote.data.currency)}</strong></p>
          <button type="button" disabled={submit.isPending} onClick={() => submit.mutate()}>{labels.send}</button>
        </div>
      )}
    </>
  );
}
