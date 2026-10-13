/* eslint-disable i18next/no-literal-string -- A page for developers and for the Playwright runs, not a screen of the product: it is not in the production build (see routes/dev-routes.tsx), so its words are not translated. */
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarCheck, DoorOpen, LogOut, MessageSquare, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { defineList } from '@/components/shared/list-view/define-list';
import { ListView } from '@/components/shared/list-view/list-view';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { Button } from '@/components/ui/button';
import { toastUndo } from '@/lib/toast-undo';
import type { BookingStatus } from '@/types/booking.types';

type Channel = 'direct' | 'airbnb' | 'booking' | 'manual';
type PropertyId = 'casa-bianca' | 'trullo' | 'masseria';

interface Booking {
  id: string;
  guest: string;
  email: string;
  property: PropertyId;
  channel: Channel;
  status: BookingStatus;
  from: string;
  to: string;
  guests: number;
  total: number;
}

const PROPERTY_NAME: Record<PropertyId, string> = { 'casa-bianca': 'Casa Bianca', trullo: 'Trullo dei Sogni', masseria: 'Masseria Ulivi' };
const CHANNEL_NAME: Record<Channel, string> = { direct: 'Sito diretto', airbnb: 'Airbnb', booking: 'Booking.com', manual: 'A mano' };

const INITIAL: Booking[] = [
  { id: 'ZS-1001', guest: 'Sofia Marino', email: 'sofia.marino@example.com', property: 'casa-bianca', channel: 'direct', status: 'Pending', from: '2026-10-12', to: '2026-10-15', guests: 2, total: 420 },
  { id: 'ZS-1002', guest: 'Elena Gatti', email: 'elena.gatti@example.com', property: 'trullo', channel: 'airbnb', status: 'Pending', from: '2026-10-14', to: '2026-10-18', guests: 4, total: 640.5 },
  { id: 'ZS-1003', guest: 'Mario Rossi', email: 'mario.rossi@example.com', property: 'casa-bianca', channel: 'direct', status: 'Confirmed', from: '2026-10-10', to: '2026-10-13', guests: 2, total: 380 },
  { id: 'ZS-1004', guest: 'Anna Maria Giuseppina Bianchi Montefeltro Della Rovere', email: 'anna.maria.giuseppina.bianchi.montefeltro.della.rovere@un-dominio-di-posta-molto-lungo.example.org', property: 'masseria', channel: 'booking', status: 'Confirmed', from: '2026-10-16', to: '2026-10-23', guests: 6, total: 1480 },
  { id: 'ZS-1005', guest: 'Luigi Verdi', email: 'luigi.verdi@example.com', property: 'trullo', channel: 'manual', status: 'Confirmed', from: '2026-10-20', to: '2026-10-22', guests: 2, total: 260 },
  { id: 'ZS-1006', guest: 'Chiara Neri', email: 'chiara.neri@example.com', property: 'casa-bianca', channel: 'airbnb', status: 'Confirmed', from: '2026-11-02', to: '2026-11-05', guests: 3, total: 450 },
  { id: 'ZS-1007', guest: 'Zoë Müller', email: 'zoe.muller@example.com', property: 'masseria', channel: 'booking', status: 'Confirmed', from: '2026-10-11', to: '2026-10-14', guests: 2, total: 590 },
  { id: 'ZS-1008', guest: 'Emma Johnson', email: 'emma.johnson@example.com', property: 'trullo', channel: 'airbnb', status: 'CheckedIn', from: '2026-10-07', to: '2026-10-11', guests: 2, total: 520 },
  { id: 'ZS-1009', guest: 'Pierre Laurent', email: 'pierre.laurent@example.com', property: 'casa-bianca', channel: 'direct', status: 'CheckedIn', from: '2026-10-06', to: '2026-10-10', guests: 2, total: 400 },
  { id: 'ZS-1010', guest: 'Giuseppe Esposito', email: 'giuseppe.esposito@example.com', property: 'masseria', channel: 'direct', status: 'CheckedOut', from: '2026-09-20', to: '2026-09-27', guests: 5, total: 1320 },
  { id: 'ZS-1011', guest: 'Francesca Romano', email: 'francesca.romano@example.com', property: 'trullo', channel: 'booking', status: 'CheckedOut', from: '2026-09-24', to: '2026-09-28', guests: 2, total: 470 },
  { id: 'ZS-1012', guest: 'Alessandro Colombo', email: 'alessandro.colombo@example.com', property: 'casa-bianca', channel: 'airbnb', status: 'CheckedOut', from: '2026-09-30', to: '2026-10-03', guests: 3, total: 360 },
  { id: 'ZS-1013', guest: '=HYPERLINK("http://evil.example","clicca qui")', email: 'attaccante@example.com', property: 'trullo', channel: 'direct', status: 'CheckedOut', from: '2026-09-15', to: '2026-09-18', guests: 1, total: 210 },
  { id: 'ZS-1014', guest: 'Marco Conti', email: 'marco.conti@example.com', property: 'masseria', channel: 'manual', status: 'Cancelled', from: '2026-10-25', to: '2026-10-28', guests: 2, total: 330 },
];

const NEXT: Partial<Record<BookingStatus, BookingStatus>> = { Pending: 'Confirmed', Confirmed: 'CheckedIn', CheckedIn: 'CheckedOut' };
const BOARD_ORDER: BookingStatus[] = ['Pending', 'Confirmed', 'CheckedIn', 'CheckedOut'];
const BOARD_LABEL: Record<BookingStatus, string> = { Pending: 'Richieste', Confirmed: 'Confermate', CheckedIn: 'In corso', CheckedOut: 'Concluse', Cancelled: 'Cancellate' };

type Scenario = 'data' | 'loading' | 'refreshing' | 'error' | 'empty';
const SCENARIOS: Scenario[] = ['data', 'loading', 'refreshing', 'error', 'empty'];

const range = (booking: Booking) => `${booking.from} → ${booking.to}`;

/** The unified list on made-up stays, to look at it and to let Playwright and axe walk through every part of it. */
export default function ListViewPage() {
  const [bookings, setBookings] = useState<Booking[]>(INITIAL);
  const [params, setParams] = useSearchParams();
  const scenario: Scenario = SCENARIOS.find((candidate) => candidate === params.get('scenario')) ?? 'data';

  const setStatus = (ids: string[], status: BookingStatus | ((current: BookingStatus) => BookingStatus)) =>
    setBookings((current) =>
      current.map((booking) => (ids.includes(booking.id) ? { ...booking, status: typeof status === 'function' ? status(booking.status) : status } : booking)),
    );
  const restore = (previous: Booking[]) => setBookings((current) => current.map((booking) => previous.find((old) => old.id === booking.id) ?? booking));

  const list = useMemo(
    () =>
      defineList<Booking>({
        key: 'dev-bookings',
        title: 'Prenotazioni',
        rowKey: (booking) => booking.id,
        rowLabel: (booking) => booking.guest,
        columns: [
          {
            id: 'guest',
            label: 'Ospite e immobile',
            default: true,
            always: true,
            rowHeader: true,
            priority: 1,
            className: 'min-w-48',
            sort: (booking) => booking.guest,
            render: (booking, cell) => (
              <div className="min-w-0">
                {cell.open(<span>{booking.guest}</span>)}
                <div className="text-xs font-normal text-foreground/70">{PROPERTY_NAME[booking.property]}</div>
              </div>
            ),
            csv: (booking) => `${booking.guest} · ${PROPERTY_NAME[booking.property]}`,
          },
          { id: 'dates', label: 'Date', default: true, priority: 3, sort: (booking) => booking.from, render: (booking) => <span className="whitespace-nowrap">{range(booking)}</span>, csv: range },
          { id: 'channel', label: 'Canale', default: true, priority: 5, render: (booking) => CHANNEL_NAME[booking.channel], csv: (booking) => CHANNEL_NAME[booking.channel] },
          {
            id: 'status',
            label: 'Stato',
            default: true,
            priority: 2,
            cardStatus: true,
            sort: (booking) => BOARD_ORDER.indexOf(booking.status),
            render: (booking) => <StatusBadge kind="booking" status={booking.status} />,
            csv: (booking) => booking.status,
          },
          { id: 'total', label: 'Totale', default: true, align: 'end', priority: 4, sort: (booking) => booking.total, render: (booking) => `€ ${booking.total}`, csv: (booking) => booking.total },
          { id: 'email', label: 'Email', priority: 6, render: (booking) => booking.email },
          { id: 'guests', label: 'Persone', align: 'end', sort: (booking) => booking.guests, render: (booking) => booking.guests },
          { id: 'code', label: 'Codice', render: (booking) => <code>{booking.id}</code>, csv: (booking) => booking.id },
        ],
        search: { label: 'Cerca prenotazioni', placeholder: 'Cerca ospite, codice o email', text: (booking) => `${booking.guest} ${booking.id} ${booking.email} ${PROPERTY_NAME[booking.property]}` },
        chips: [
          { id: 'all', label: 'Tutte', test: () => true },
          { id: 'pending', label: 'Da confermare', urgent: true, hint: 'Richieste che aspettano la tua risposta', test: (booking) => booking.status === 'Pending' },
          { id: 'upcoming', label: 'In arrivo', test: (booking) => booking.status === 'Pending' || booking.status === 'Confirmed' },
          { id: 'inProgress', label: 'In corso', test: (booking) => booking.status === 'CheckedIn' },
          { id: 'done', label: 'Concluse', test: (booking) => booking.status === 'CheckedOut' },
          { id: 'cancelled', label: 'Cancellate', test: (booking) => booking.status === 'Cancelled' },
        ],
        defaultChip: 'upcoming',
        defaultSort: 'dates:asc',
        filters: [
          {
            id: 'property',
            label: 'Immobile',
            type: 'select',
            allLabel: 'Tutti gli immobili',
            options: Object.entries(PROPERTY_NAME).map(([value, label]) => ({ value, label })),
            test: (booking, value) => booking.property === value,
          },
          {
            id: 'channel',
            label: 'Canale',
            type: 'multi',
            options: Object.entries(CHANNEL_NAME).map(([value, label]) => ({ value, label })),
            test: (booking, values) => values.includes(booking.channel),
          },
          {
            id: 'arrival',
            label: 'Arrivo tra le date',
            type: 'date',
            test: (booking, { from, to }) => (!from || booking.from >= from) && (!to || booking.from <= to),
          },
        ],
        views: [
          { id: 'week', label: 'Arrivi dei prossimi 7 giorni', state: { chip: 'upcoming', filters: { arrival: '2026-10-09..2026-10-16' } } },
          { id: 'direct', label: 'Solo prenotazioni dirette', state: { chip: 'all', filters: { channel: 'direct' } } },
        ],
        primaryAction: (booking) => {
          const next = NEXT[booking.status];
          if (!next) return null;
          const label = booking.status === 'Pending' ? 'Accetta' : booking.status === 'Confirmed' ? 'Registra arrivo' : 'Registra partenza';
          const icon = booking.status === 'Pending' ? CalendarCheck : booking.status === 'Confirmed' ? DoorOpen : LogOut;
          return {
            id: 'advance',
            label,
            icon,
            variant: booking.status === 'Pending' ? 'default' : 'secondary',
            onSelect: () => {
              setStatus([booking.id], next);
              toastUndo(`${booking.guest}: ${label.toLowerCase()}`, { undo: () => setStatus([booking.id], booking.status) });
            },
          };
        },
        menu: (booking) => [
          { id: 'write', label: 'Scrivi all’ospite', icon: MessageSquare, onSelect: () => toast.info(`Messaggio a ${booking.guest}`) },
          { id: 'page', label: 'Apri la scheda', href: '/dev/primitives' },
          'separator',
          { id: 'cancel', label: 'Cancella la prenotazione', icon: Trash2, danger: true, disabled: booking.status === 'Cancelled', onSelect: () => toast.warning(`Cancellata: ${booking.guest}`) },
        ],
        bulk: [
          {
            id: 'send-link',
            label: 'Invia il link di check-in',
            icon: Send,
            run: () => undefined,
            undo: () => undefined,
            doneMessage: (count) => `Link inviato a ${count} ${count === 1 ? 'ospite' : 'ospiti'}`,
          },
          {
            id: 'cancel',
            label: 'Cancella',
            icon: Trash2,
            run: (rows) => setStatus(rows.map((row) => row.id), 'Cancelled'),
            confirm: {
              title: (count) => `Cancellare ${count} ${count === 1 ? 'prenotazione' : 'prenotazioni'}?`,
              description: 'Gli ospiti vengono avvisati con un’email.',
              confirmLabel: 'Cancella le prenotazioni',
              destructive: true,
            },
          },
          'export',
        ],
        swipe: (booking) => {
          const next = NEXT[booking.status];
          return {
            left: next
              ? { id: 'advance', label: booking.status === 'Pending' ? 'Accetta' : booking.status === 'Confirmed' ? 'Arrivo' : 'Partenza', icon: CalendarCheck, tone: 'success', onSelect: () => setStatus([booking.id], next) }
              : null,
            right: { id: 'write', label: 'Scrivi', icon: MessageSquare, tone: 'neutral', onSelect: () => toast.info(`Messaggio a ${booking.guest}`) },
          };
        },
        detail: {
          title: (booking) => booking.guest,
          description: (booking) => `${PROPERTY_NAME[booking.property]} · ${range(booking)}`,
          pageHref: () => '/dev/primitives',
          render: (booking) => (
            <div className="space-y-4" data-testid="dev-detail">
              <StatusBadge kind="booking" status={booking.status} size="lg" />
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-foreground/70">Codice</dt>
                <dd>{booking.id}</dd>
                <dt className="text-foreground/70">Email</dt>
                <dd className="break-words">{booking.email}</dd>
                <dt className="text-foreground/70">Canale</dt>
                <dd>{CHANNEL_NAME[booking.channel]}</dd>
                <dt className="text-foreground/70">Persone</dt>
                <dd>{booking.guests}</dd>
                <dt className="text-foreground/70">Totale</dt>
                <dd>€ {booking.total}</dd>
              </dl>
            </div>
          ),
        },
        board: {
          defaultChip: 'all',
          columns: [
            { id: 'Pending', label: BOARD_LABEL.Pending, tone: 'warning', test: (booking) => booking.status === 'Pending', empty: 'Nessuna richiesta da approvare' },
            { id: 'Confirmed', label: BOARD_LABEL.Confirmed, tone: 'success', test: (booking) => booking.status === 'Confirmed', empty: 'Nessuna prenotazione in arrivo' },
            { id: 'CheckedIn', label: BOARD_LABEL.CheckedIn, tone: 'info', test: (booking) => booking.status === 'CheckedIn', empty: 'Nessun ospite in casa' },
            { id: 'CheckedOut', label: BOARD_LABEL.CheckedOut, tone: 'neutral', test: (booking) => booking.status === 'CheckedOut', empty: 'Nessun soggiorno concluso' },
          ],
          onMove: (booking, to) => {
            const target = to as BookingStatus;
            if (NEXT[booking.status] !== target) {
              return {
                ok: false,
                title: 'Non si può spostare qui',
                reason: target === 'CheckedOut' ? 'Il soggiorno si conclude dopo la partenza: prima registra l’arrivo.' : 'Una prenotazione avanza di un passo alla volta: richiesta, confermata, in corso, conclusa.',
              };
            }
            setStatus([booking.id], target);
            return { ok: true, title: `${booking.guest} è ora in «${BOARD_LABEL[target]}»`, undo: () => setStatus([booking.id], booking.status) };
          },
        },
        rowTone: (booking) => (booking.status === 'Pending' ? 'urgent' : booking.status === 'CheckedOut' || booking.status === 'Cancelled' ? 'done' : undefined),
        // With a sidebar the room is less than the screen: the table is for 1280 px and more, as in the real pages.
        cardsUntil: 'xl',
        csv: { fileName: 'prenotazioni' },
        empty: { title: 'Qui arrivano tutte le tue prenotazioni', description: 'Dal tuo sito, da Airbnb e Booking.com, o inserite a mano.', action: { label: 'Crea prenotazione', onClick: () => toast.info('Crea prenotazione') } },
        noResults: { title: 'Nessuna prenotazione con questi filtri', description: 'Prova a togliere un filtro, a cambiare filtro rapido o a cercare per codice.' },
        countLabel: (count) => `${count} ${count === 1 ? 'prenotazione' : 'prenotazioni'}`,
      }),
    [],
  );

  const shownRows = scenario === 'empty' ? [] : bookings;

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 pb-40 sm:p-6" data-testid="list-view-page">
      <h1 className="text-2xl font-semibold">Elenco unico</h1>

      <div role="group" aria-label="Stato dell’elenco" className="flex flex-wrap gap-2">
        {SCENARIOS.map((name) => (
          <Button
            key={name}
            type="button"
            size="sm"
            variant={scenario === name ? 'default' : 'outline'}
            aria-pressed={scenario === name}
            data-testid={`scenario-${name}`}
            onClick={() =>
              setParams(
                (current) => {
                  const next = new URLSearchParams(current);
                  if (name === 'data') next.delete('scenario');
                  else next.set('scenario', name);
                  return next;
                },
                { replace: true, preventScrollReset: true },
              )
            }
          >
            {name}
          </Button>
        ))}
        <Button type="button" size="sm" variant="ghost" onClick={() => restore(INITIAL)} data-testid="dev-reset-data">
          Ripristina i dati
        </Button>
      </div>

      <ListView
        list={list}
        rows={shownRows}
        isLoading={scenario === 'loading'}
        isRefreshing={scenario === 'refreshing'}
        isError={scenario === 'error'}
        error={scenario === 'error' ? new Error('boom') : undefined}
        onRetry={() => toast.info('Riprova')}
        viewsScope={{ userId: 'dev-user', context: 'dev' }}
        testId="dev-list"
      />
    </main>
  );
}
