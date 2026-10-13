/* eslint-disable i18next/no-literal-string -- A page for developers and for the Playwright runs, not a screen of the product: it is not in the production build (see routes/dev-routes.tsx), so its words are not translated. */
import { useState } from 'react';
import { Building2, CalendarDays, Home, LayoutList } from 'lucide-react';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { DataView, type DataColumn } from '@/components/ui/data-view';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { HelpTip } from '@/components/ui/help-tip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Qty } from '@/components/ui/qty';
import { Segmented } from '@/components/ui/segmented';
import { Tabs } from '@/components/ui/tabs';
import { toastUndo } from '@/lib/toast-undo';

interface Guest {
  id: string;
  name: string;
  email: string;
  city: string;
  nights: number;
}

const GUESTS: Guest[] = [
  { id: 'g1', name: 'Mario Rossi', email: 'mario.rossi@example.com', city: 'Roma', nights: 4 },
  { id: 'g2', name: 'Anna Bianchi', email: 'anna.bianchi.con.un.indirizzo.molto.lungo@esempio-di-dominio-lunghissimo.example.org', city: 'Torino', nights: 2 },
  { id: 'g3', name: 'Zenobia-Maria-Giuseppina Verdi-Montefeltro-Della-Rovere', email: 'z@example.com', city: 'Montefiascone', nights: 10 },
];

const COLUMNS: DataColumn<Guest>[] = [
  { key: 'name', header: 'Nome', rowHeader: true, sortable: true },
  { key: 'email', header: 'Email' },
  { key: 'city', header: 'Città', sortable: true },
  { key: 'nights', header: 'Notti', align: 'end', sortable: true },
];

type ListState = 'data' | 'loading' | 'empty' | 'error';

/** The primitives of UI-07 on one page, to look at them and to let Playwright and axe walk through them. */
export default function UiPrimitivesPage() {
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [regime, setRegime] = useState('cedolare');
  const [adults, setAdults] = useState(2);
  const [rooms, setRooms] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [listState, setListState] = useState<ListState>('data');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [archived, setArchived] = useState(false);
  const [held, setHeld] = useState<'idle' | 'pending' | 'done' | 'dropped'>('idle');

  return (
    <main className="mx-auto max-w-3xl space-y-10 p-4 pb-32 sm:p-6" data-testid="ui-primitives-page">
      <h1 className="text-2xl font-semibold">Primitive UI B</h1>

      <section aria-labelledby="dev-dialog" className="space-y-3">
        <h2 id="dev-dialog" className="text-lg font-semibold">
          Dialog responsive
        </h2>
        <div className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button data-testid="open-dialog">Apri il dialogo</Button>
            </DialogTrigger>
            <DialogContent data-testid="the-dialog">
              <DialogHeader>
                <DialogTitle>Collega il calendario</DialogTitle>
                <DialogDescription>Incolla il link iCal del tuo calendario.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="dev-ical">Link iCal</Label>
                  <HelpTip title="iCal" learnMoreHref="/help/ical">
                    Un indirizzo che il calendario aggiorna da solo: lo incolli qui una volta sola.
                  </HelpTip>
                </div>
                <Input id="dev-ical" placeholder="https://calendar.google.com/…" />
              </div>
              <DialogFooter>
                <Button variant="outline">Annulla</Button>
                <Button>Salva e sincronizza</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="open-long-dialog">
                Dialogo lungo
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="the-long-dialog" className="max-h-[90vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Condizioni di prenotazione</DialogTitle>
                <DialogDescription>Scorri fino in fondo.</DialogDescription>
              </DialogHeader>
              {Array.from({ length: 14 }, (_, index) => (
                <p key={index} className="text-sm">
                  Paragrafo {index + 1}. Le condizioni valgono per tutta la durata del soggiorno e si applicano a ogni ospite indicato nella prenotazione, salvo accordi scritti diversi tra le parti.
                </p>
              ))}
              <DialogFooter>
                <Button data-testid="long-dialog-accept">Ho letto</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="open-lightbox">
                Visore a tutto schermo
              </Button>
            </DialogTrigger>
            <DialogContent sheetOnPhone={false} data-testid="the-lightbox" className="max-w-4xl border-0 bg-black p-2">
              <DialogTitle className="sr-only">Foto</DialogTitle>
              <DialogDescription className="sr-only">Una foto grande.</DialogDescription>
              <div className="h-64 w-full rounded bg-neutral-700" />
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={() => setConfirmOpen(true)} data-testid="open-confirmation">
            Elimina l&apos;ospite…
          </Button>
        </div>
        <ConfirmationDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Eliminare l'ospite?"
          description="I suoi dati personali verranno rimossi."
          confirmLabel="Elimina"
          requireText="ELIMINA"
          consequences={['Le prenotazioni restano, senza il nome', 'Non si può tornare indietro']}
          onConfirm={() => undefined}
        />
      </section>

      <section aria-labelledby="dev-help" className="space-y-3">
        <h2 id="dev-help" className="text-lg font-semibold">
          HelpTip
        </h2>
        <p className="flex items-center gap-1.5 text-sm">
          Codice CIN
          <HelpTip title="Codice CIN" learnMoreHref="/help/ical">
            Il codice che identifica la casa in tutta Italia. Va esposto negli annunci.
          </HelpTip>
        </p>
        <p className="flex items-center gap-1.5 text-sm">
          Cedolare secca
          <HelpTip>Un&apos;imposta fissa sull&apos;affitto, al posto dell&apos;IRPEF.</HelpTip>
        </p>
      </section>

      <section aria-labelledby="dev-tabs" className="space-y-3">
        <h2 id="dev-tabs" className="text-lg font-semibold">
          Tabs
        </h2>
        <Tabs
          label="Sezioni della prenotazione"
          defaultValue="details"
          items={[
            { value: 'details', label: 'Dettagli', testId: 'tab-details' },
            { value: 'guest', label: 'Ospite', testId: 'tab-guest' },
            { value: 'requests', label: 'Richieste', count: 3, countLabel: 'da approvare', testId: 'tab-requests' },
            { value: 'alloggiati', label: 'Alloggiati', testId: 'tab-alloggiati' },
          ]}
          selectTestId="tabs-select"
          panelTestId="tabs-panel"
        >
          <p className="rounded-lg border p-4 text-sm">Il contenuto della scheda aperta.</p>
        </Tabs>
      </section>

      <section aria-labelledby="dev-segmented" className="space-y-3">
        <h2 id="dev-segmented" className="text-lg font-semibold">
          Segmented
        </h2>
        <Segmented
          label="Vista"
          value={view}
          onValueChange={setView}
          options={[
            { value: 'list', label: 'Elenco', icon: LayoutList, testId: 'view-list' },
            { value: 'calendar', label: 'Calendario', icon: CalendarDays, testId: 'view-calendar' },
          ]}
        />
        <p className="text-sm" data-testid="view-now">
          Vista: {view}
        </p>
      </section>

      <section aria-labelledby="dev-choices" className="space-y-3">
        <h2 id="dev-choices" className="text-lg font-semibold">
          ChoiceCard
        </h2>
        <ChoiceGroup legend="Quale regime fiscale?" legendVisible className="mb-6">
          <ChoiceCard
            name="regime"
            value="cedolare"
            title="Cedolare secca"
            description="Imposta fissa, niente registro"
            icon={Home}
            checked={regime === 'cedolare'}
            onChange={() => setRegime('cedolare')}
            data-testid="regime-cedolare"
          />
          <ChoiceCard
            name="regime"
            value="ordinario"
            title="Regime ordinario"
            description="IRPEF sul canone"
            icon={Building2}
            checked={regime === 'ordinario'}
            onChange={() => setRegime('ordinario')}
            data-testid="regime-ordinario"
          />
        </ChoiceGroup>
        <ChoiceGroup legend="Servizi extra" legendVisible>
          <ChoiceCard type="checkbox" name="servizi" value="pulizie" title="Pulizie" description="Dopo ogni soggiorno" data-testid="service-pulizie" />
          <ChoiceCard type="checkbox" name="servizi" value="lavanderia" title="Lavanderia" defaultChecked data-testid="service-lavanderia" />
        </ChoiceGroup>
      </section>

      <section aria-labelledby="dev-qty" className="space-y-3">
        <h2 id="dev-qty" className="text-lg font-semibold">
          Qty
        </h2>
        <div className="flex flex-wrap items-center gap-6">
          <Qty label="Adulti" value={adults} onChange={setAdults} min={1} max={4} testId="qty-adults" />
          <Qty label="Camere" value={rooms} onChange={setRooms} min={0} max={9} testId="qty-rooms" />
        </div>
        <p className="text-sm" data-testid="qty-now">
          Adulti: {adults}, camere: {rooms}
        </p>
      </section>

      <section aria-labelledby="dev-dataview" className="space-y-3">
        <h2 id="dev-dataview" className="text-lg font-semibold">
          DataView
        </h2>
        <Segmented
          label="Stato dell'elenco"
          value={listState}
          onValueChange={setListState}
          options={[
            { value: 'data', label: 'Dati' },
            { value: 'loading', label: 'Caricamento' },
            { value: 'empty', label: 'Vuoto' },
            { value: 'error', label: 'Errore' },
          ]}
        />
        <DataView<Guest>
          label="Ospiti di prova"
          rows={listState === 'empty' ? [] : GUESTS}
          columns={COLUMNS}
          rowKey={(guest) => guest.id}
          isLoading={listState === 'loading'}
          isError={listState === 'error'}
          errorTitle="Impossibile caricare gli ospiti"
          onRetry={() => setListState('data')}
          selectable
          selected={selected}
          onSelectedChange={setSelected}
          rowLabel={(guest) => `Seleziona ${guest.name}`}
          bulkActions={(rows) => <Button size="sm" variant="outline">Scrivi a {rows.length}</Button>}
          rowActions={(guest) => (
            <a href={`/dev/primitives#${guest.id}`} className="text-sm font-medium text-primary hover:underline">
              Apri
            </a>
          )}
          renderCard={(guest) => (
            <>
              <p className="break-words font-semibold">{guest.name}</p>
              <p className="break-words text-sm text-foreground/70">{guest.email}</p>
              <p className="mt-1 text-sm text-foreground/70">
                {guest.city} · {guest.nights} notti
              </p>
            </>
          )}
          empty={{ icon: Home, title: 'Nessun ospite', description: 'Gli ospiti arrivano con le prenotazioni.' }}
          testId="guests-view"
        />
      </section>

      <section aria-labelledby="dev-undo" className="space-y-3">
        <h2 id="dev-undo" className="text-lg font-semibold">
          toastUndo
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            data-testid="archive"
            onClick={() => {
              setArchived(true);
              toastUndo('Ospite archiviato', { undo: () => setArchived(false) });
            }}
          >
            Archivia (con Annulla)
          </Button>
          <Button
            variant="outline"
            data-testid="hold"
            onClick={() => {
              setHeld('pending');
              toastUndo('Verrà eliminato tra poco', {
                tone: 'info',
                undo: () => setHeld('dropped'),
                commit: () => setHeld('done'),
                duration: 3000,
              });
            }}
          >
            Elimina tra 3 secondi (con Annulla)
          </Button>
        </div>
        <p className="text-sm" data-testid="undo-state">
          Archiviato: {archived ? 'sì' : 'no'}; eliminazione: {held}
        </p>
      </section>
    </main>
  );
}
