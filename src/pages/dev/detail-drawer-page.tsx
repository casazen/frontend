/* eslint-disable i18next/no-literal-string -- A page for developers and for the Playwright runs, not a screen of the product: it is not in the production build (see routes/dev-routes.tsx), so its words are not translated. */
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, CreditCard, Send, Wrench } from 'lucide-react';
import { DetailDrawerHost } from '@/components/shared/detail-drawer/detail-drawer-host';
import { registerDetail, type DetailContentProps, type DetailTitleProps } from '@/components/shared/detail-drawer/detail-registry';
import { useDetailDrawer } from '@/components/shared/detail-drawer/use-detail-drawer';
import { defineList } from '@/components/shared/list-view/define-list';
import { ListView } from '@/components/shared/list-view/list-view';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { Timeline, type TimelineEvent } from '@/components/shared/timeline/timeline';
import { Button } from '@/components/ui/button';
import { RouteTabs } from '@/components/ui/route-tabs';
import { SkeletonLine } from '@/components/ui/skeleton';
import { Tabs } from '@/components/ui/tabs';
import { toastUndo } from '@/lib/toast-undo';
import type { BookingStatus } from '@/types/booking.types';

interface DevBooking {
  id: string;
  guest: string;
  property: string;
  status: BookingStatus;
  from: string;
  to: string;
  total: number;
}

const BOOKINGS: DevBooking[] = [
  { id: 'ZS-1001', guest: 'Sofia Marino', property: 'Casa Bianca', status: 'Pending', from: '2026-10-12', to: '2026-10-15', total: 420 },
  { id: 'ZS-1002', guest: 'Elena Gatti', property: 'Trullo dei Sogni', status: 'Confirmed', from: '2026-10-14', to: '2026-10-18', total: 640 },
  { id: 'ZS-1003', guest: 'Anna Maria Giuseppina Bianchi Montefeltro Della Rovere', property: 'Masseria Ulivi', status: 'CheckedIn', from: '2026-10-16', to: '2026-10-23', total: 1480 },
  { id: 'ZS-1004', guest: 'Luigi Verdi', property: 'Trullo dei Sogni', status: 'CheckedOut', from: '2026-09-20', to: '2026-09-27', total: 1320 },
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The events of a made-up booking, with a little of every tone. */
function eventsOf(booking: DevBooking): TimelineEvent[] {
  const hours = (count: number) => new Date(Date.now() - count * 3_600_000).toISOString();
  return [
    { id: 'created', at: hours(80), title: 'Prenotazione creata', description: `Dal sito, ${booking.property}`, actor: 'Sito diretto' },
    { id: 'payment', at: hours(79), title: 'Acconto ricevuto', tone: 'success', icon: CreditCard, actor: 'Stripe' },
    { id: 'link', at: hours(50), title: 'Link di check-in inviato', tone: 'info', icon: Send, actor: 'CasaZen' },
    { id: 'reminder', at: hours(26), title: 'Documenti non ancora arrivati', description: 'Mandiamo un promemoria domani mattina.', tone: 'warning' },
    { id: 'clean', at: hours(5), title: 'Pulizia assegnata', icon: Wrench, href: '/dev/detail-drawer?from=timeline', actor: 'Splendore Pulizie' },
    { id: 'failed', at: hours(1), title: 'Pagamento del saldo rifiutato', description: 'La carta è stata rifiutata.', tone: 'danger', icon: CalendarCheck },
  ];
}

function useDevBooking(id: string) {
  return useQuery({
    queryKey: ['dev-detail-drawer', 'booking', id],
    queryFn: async () => {
      await delay(400);
      return BOOKINGS.find((booking) => booking.id === id) ?? null;
    },
  });
}

/** A title that comes with the data: the generic name stays until the guest is known. */
function DevBookingTitle({ id }: DetailTitleProps) {
  const { data } = useDevBooking(id);
  return <>{data ? data.guest : `Prenotazione ${id}`}</>;
}

function DevBookingContent({ id, close }: DetailContentProps) {
  const { data, isLoading } = useDevBooking(id);
  if (isLoading) return <SkeletonLine lines={5} label="Carico la prenotazione" />;
  if (!data) return <p>Prenotazione non trovata.</p>;
  return (
    <div className="space-y-6" data-testid="dev-booking-content">
      <div className="space-y-2">
        <StatusBadge kind="booking" status={data.status} size="lg" />
        <p className="text-sm text-foreground/70">
          {data.property} · {data.from} → {data.to} · € {data.total}
        </p>
      </div>
      <section aria-labelledby="dev-booking-history" className="space-y-3">
        <h3 id="dev-booking-history" className="text-sm font-semibold">
          Cronologia
        </h3>
        <Timeline events={eventsOf(data)} limit={4} label="Cronologia della prenotazione" />
      </section>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Nota (prova che il contenuto non si rimonta se giri il telefono)</span>
        <input className="h-11 w-full rounded-md border border-input bg-background px-3" data-testid="dev-booking-note" />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          data-testid="dev-booking-confirm"
          onClick={() => toastUndo('Prenotazione segnata come confermata', { undo: () => undefined })}
        >
          Conferma
        </Button>
        <Button variant="outline" onClick={close}>
          Chiudi dal contenuto
        </Button>
      </div>
    </div>
  );
}

function DevNoteContent({ id }: DetailContentProps) {
  return (
    <div className="space-y-4" data-testid="dev-note-content">
      <p className="text-sm text-foreground/70">Nota {id}: un testo lungo per provare lo scorrimento interno del cassetto, con il titolo che resta fermo.</p>
      {Array.from({ length: 24 }, (_, index) => (
        <p key={index} className="text-sm">
          Paragrafo {index + 1}. L&apos;ospite arriva nel pomeriggio, la chiave è nella cassetta all&apos;ingresso e la pulizia della partenza va concordata con il fornitore
          almeno il giorno prima.
        </p>
      ))}
    </div>
  );
}

// Two made-up kinds. A real feature registers its own at the top of its module; this page is the only place that uses these.
registerDetail('dev-booking', { title: DevBookingTitle, Content: DevBookingContent, pageHref: (id) => `/dev/detail-drawer?page=${id}` });
registerDetail('dev-note', { title: 'detailDrawer.fallbackTitle', Content: DevNoteContent, width: 'wide' });

function DevButtons() {
  const drawer = useDetailDrawer();
  const [answer, setAnswer] = useState('');
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button data-testid="open-booking" onClick={(event) => drawer.open('dev-booking', 'ZS-1002', { opener: event.currentTarget })}>
        Apri la prenotazione ZS-1002
      </Button>
      <Button variant="outline" data-testid="open-note" onClick={(event) => drawer.open('dev-note', 'n-1', { opener: event.currentTarget })}>
        Apri una nota lunga (largo)
      </Button>
      <Button
        variant="outline"
        data-testid="open-invalid"
        onClick={() => setAnswer(drawer.open('dev-booking', '../../admin') ? 'aperto (non dovrebbe)' : 'rifiutato: l’identificativo non è valido')}
      >
        Prova un identificativo non valido
      </Button>
      <Link className="text-sm underline underline-offset-4" to="?detail=dev-booking:ZS-1003" data-testid="shared-link">
        Un link condiviso (ZS-1003)
      </Link>
      <output className="text-sm text-foreground/70" data-testid="open-answer">
        {answer}
      </output>
      <output className="text-sm text-foreground/70" data-testid="current-drawer">
        Aperto: {drawer.current ? `${drawer.current.kind}:${drawer.current.id}` : 'nessuno'}
      </output>
    </div>
  );
}

const hoursAgo = (count: number) => new Date(Date.now() - count * 3_600_000).toISOString();

/** The global detail drawer (UI-15), the Timeline and the tabs between pages, on made-up data. */
export default function DetailDrawerPage() {
  const [params] = useSearchParams();
  const useLocalSlot = params.get('slot') === 'local';

  const list = useMemo(
    () =>
      defineList<DevBooking>({
        key: 'dev-detail-bookings',
        title: 'Prenotazioni',
        rowKey: (booking) => booking.id,
        rowLabel: (booking) => booking.guest,
        columns: [
          {
            id: 'guest',
            label: 'Ospite',
            default: true,
            always: true,
            rowHeader: true,
            priority: 1,
            render: (booking, cell) => cell.open(<span>{booking.guest}</span>),
            csv: (booking) => booking.guest,
          },
          { id: 'property', label: 'Immobile', default: true, priority: 3, render: (booking) => booking.property },
          { id: 'dates', label: 'Date', default: true, priority: 4, render: (booking) => `${booking.from} → ${booking.to}` },
          {
            id: 'status',
            label: 'Stato',
            default: true,
            priority: 2,
            cardStatus: true,
            render: (booking) => <StatusBadge kind="booking" status={booking.status} />,
            csv: (booking) => booking.status,
          },
        ],
        search: { label: 'Cerca prenotazioni', placeholder: 'Cerca ospite o immobile', text: (booking) => `${booking.guest} ${booking.property}` },
        chips: [{ id: 'all', label: 'Tutte', test: () => true }],
        // The same list opens the global drawer, or (with ?slot=local) its own panel, which is as it always was.
        detail: useLocalSlot
          ? {
              title: (booking) => booking.guest,
              render: (booking) => <p data-testid="dev-local-slot">Lo slot locale della lista: {booking.id}</p>,
              pageHref: (booking) => `/dev/detail-drawer?page=${booking.id}`,
            }
          : { drawerKind: 'dev-booking' },
        empty: { title: 'Nessuna prenotazione', description: 'Non ce n’è ancora nessuna.' },
        csv: false,
      }),
    [useLocalSlot],
  );

  return (
    <main className="mx-auto max-w-4xl space-y-10 p-4 md:p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Cassetto di dettaglio, Timeline e schede fra rotte</h1>
        <p className="text-sm text-foreground/70">
          UI-15, su dati finti. Il cassetto si apre da un pulsante fuori da ogni elenco, da una riga di un elenco e da un indirizzo condiviso (<code>?detail=tipo:id</code>);
          «indietro» lo chiude. Sotto <code>md</code> (768 px) è un foglio dal basso, da <code>md</code> un pannello a destra.
        </p>
      </header>

      <RouteTabs
        label="Sezioni della pagina di prova"
        items={[
          { label: 'Cassetto', href: '/dev/detail-drawer' },
          { label: 'Timeline', href: '/dev/detail-drawer?section=timeline', count: 2, countLabel: '2 da vedere', tone: 'warning' },
          { label: 'Schede', href: '/dev/detail-drawer?section=tabs', count: 1, countLabel: '1 con un errore', tone: 'danger' },
        ]}
      />

      <section aria-labelledby="dev-drawer-open" className="space-y-3">
        <h2 id="dev-drawer-open" className="text-lg font-semibold">
          Aprirlo da fuori di un elenco
        </h2>
        <DevButtons />
      </section>

      <section aria-labelledby="dev-drawer-list" className="space-y-3">
        <h2 id="dev-drawer-list" className="text-lg font-semibold">
          Aprirlo da un elenco
        </h2>
        <p className="text-sm text-foreground/70">
          {useLocalSlot ? 'Qui l’elenco apre il suo slot locale (come prima).' : 'Qui l’elenco ha detail: { drawerKind: "dev-booking" }.'}{' '}
          <Link className="underline underline-offset-4" to={useLocalSlot ? '/dev/detail-drawer' : '/dev/detail-drawer?slot=local'}>
            {useLocalSlot ? 'Torna al cassetto globale' : 'Prova lo slot locale'}
          </Link>
        </p>
        <ListView list={list} rows={BOOKINGS} testId="dev-detail-list" />
      </section>

      <section aria-labelledby="dev-timeline" className="space-y-6">
        <h2 id="dev-timeline" className="text-lg font-semibold">
          Timeline
        </h2>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Dal più recente, con «Mostra altri»</h3>
            <Timeline events={eventsOf(BOOKINGS[0])} limit={3} label="Cronologia, dal più recente" testId="dev-timeline-desc" />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Dal più vecchio</h3>
            <Timeline
              events={[
                { id: 'a', at: hoursAgo(30), title: 'Richiesta ricevuta' },
                { id: 'b', at: hoursAgo(3), title: 'Richiesta accettata', tone: 'success' },
                { id: 'c', at: hoursAgo(0.01), title: 'Appena successo', tone: 'info' },
              ]}
              order="asc"
              label="Cronologia, dal più vecchio"
              testId="dev-timeline-asc"
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Vuota</h3>
            <Timeline events={[]} testId="dev-timeline-empty" />
          </div>
        </div>
      </section>

      <section aria-labelledby="dev-tabs" className="space-y-3">
        <h2 id="dev-tabs" className="text-lg font-semibold">
          Il numero sulle schede, con il suo tono
        </h2>
        <Tabs
          label="Schede con il numero"
          items={[
            { value: 'a', label: 'Da approvare', count: 3, countLabel: '3 da approvare', tone: 'warning' },
            { value: 'b', label: 'Con un errore', count: 2, countLabel: '2 con un errore', tone: 'danger' },
            { value: 'c', label: 'Pronte', count: 5, countLabel: '5 pronte', tone: 'success' },
            { value: 'd', label: 'Novità', count: 1, countLabel: '1 nuova', tone: 'info' },
            { value: 'e', label: 'Senza tono', count: 4 },
          ]}
          param="scheda"
        >
          <p className="text-sm text-foreground/70">La scheda aperta si legge dall’indirizzo (<code>?scheda=</code>), come sempre.</p>
        </Tabs>
      </section>

      <DetailDrawerHost />
    </main>
  );
}
