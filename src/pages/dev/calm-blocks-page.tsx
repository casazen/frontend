/* eslint-disable i18next/no-literal-string -- A page for developers and for the Playwright runs, not a screen of the product: it is not in the production build (see routes/dev-routes.tsx), so its words are not translated. */
import { useState } from 'react';
import { Wrench } from 'lucide-react';
import {
  ActivityList,
  CALM_TONES,
  ChecklistCompact,
  DayList,
  FocusBlock,
  NextStepCard,
  PlainSection,
  StatStrip,
  StatTile,
  TodayList,
  WeekStrip,
  type ActivityItem,
  type CalmAction,
  type CalmTone,
  type DayListItem,
  type TodayListItem,
  type WeekStripDay,
} from '@/components/shared/calm';
import { addDays, startOfWeek, todayInRome } from '@/lib/stay-dates';

const TONE_NAME: Record<CalmTone, string> = {
  neutral: 'neutro (il colore dell’area)',
  info: 'informazione',
  success: 'tutto a posto',
  warning: 'attenzione',
  danger: 'urgente',
};

const TODAY_LABELS = { today: 'Oggi', tomorrow: 'Domani', later: 'Più avanti' };

/** A name with no space in it, as a property or a file has: it must wrap, not push the page sideways. */
const LONG_NAME = 'Casa_Vacanze_Trullo_dei_Sogni_Alberobello_Via_Roma_12_interno_3';

/** The calm blocks of UI-16 on one page, in every variant, to look at them and to let Playwright and axe walk through them. */
export default function CalmBlocksPage() {
  const today = todayInRome();
  const [lastAction, setLastAction] = useState('nessuna');
  const done = (what: string) => () => setLastAction(what);

  const [day, setDay] = useState(today);
  const monday = startOfWeek(today);
  const week: WeekStripDay[] = Array.from({ length: 7 }, (_, index) => ({ date: addDays(monday, index), count: [2, 0, 1, 4, 0, 0, 3][index] }));

  const writeToSupplier: CalmAction = { label: 'Scrivi al fornitore o scegline un altro per questo intervento', onClick: done('scrivi al fornitore') };

  // The date of a row is worked out from its day ("12 ott"); a time of the day is the row's own words.
  const deadlines: DayListItem[] = [
    { id: 'registration', day: addDays(today, 12), title: 'Registrazione del contratto Rossi', subtitle: 'Elisa Rossi · Via Roma 12, Bari', meta: 'tra 12 giorni', href: '/dev/calm-blocks?aperto=rossi' },
    { id: 'late-rent', day: addDays(today, -11), title: 'Canone di ottobre · Bianchi', subtitle: 'Marco Bianchi · Corso Vittorio 3', meta: 'in ritardo di 11 giorni', tone: 'danger', onOpen: done('apri canone Bianchi'), action: { label: 'Invia il sollecito', ariaLabel: 'Invia il sollecito: canone Bianchi', onClick: done('sollecito Bianchi') } },
    { id: 'deposit', day: addDays(today, 18), title: 'Restituzione del deposito · Verdi', subtitle: 'Giulia Verdi · Via Sparano 40', meta: 'da preparare', tone: 'warning', action: { label: 'Prepara', ariaLabel: 'Prepara: restituzione deposito Verdi', href: '/dev/calm-blocks?aperto=verdi' } },
    { id: 'plain', day: addDays(today, 25), title: 'Una riga solo da leggere, con un titolo molto lungo che deve andare a capo senza spingere la pagina di lato', subtitle: 'Nessuna azione' },
    { id: 'long-name', day: addDays(today, 30), title: LONG_NAME, subtitle: `${LONG_NAME}, scala B`, href: '/dev/calm-blocks?aperto=nome-lungo' },
  ];

  const todayItems: TodayListItem[] = [
    { id: 't1', day: today, date: '09:30', dateTime: `${today}T09:30`, title: 'Arrivo · Anna Neri', subtitle: 'Casa Bianca · 2 notti', action: { label: 'Fai il check-in', ariaLabel: 'Fai il check-in: Anna Neri', onClick: done('check-in Neri') } },
    { id: 't2', day: today, date: '11:00', dateTime: `${today}T11:00`, title: 'Pulizia · Trullo dei Sogni', subtitle: 'Splendore Pulizie', meta: 'in corso', onOpen: done('apri pulizia') },
    { id: 't3', day: addDays(today, 1), date: '15:00', dateTime: `${addDays(today, 1)}T15:00`, title: 'Partenza · Luigi Verdi', subtitle: 'Masseria Ulivi', href: '/dev/calm-blocks?aperto=partenza' },
    { id: 't4', day: addDays(today, 3), title: 'Manutenzione caldaia', subtitle: 'Termoidraulica Rossi', meta: 'da confermare', tone: 'warning', href: '/dev/calm-blocks?aperto=caldaia' },
  ];

  const activity: ActivityItem[] = [
    { id: 'a1', at: '2026-10-16T08:12:00Z', actor: 'Elisa', text: 'ha firmato il contratto di Casa Bianca' },
    { id: 'a2', at: '2026-10-15T16:40:00Z', actor: 'Tu', text: 'hai invitato Marco come collaboratore' },
    { id: 'a3', at: '2026-10-15T09:05:00Z', actor: 'CasaZen', text: 'ha registrato i dati degli ospiti su Alloggiati Web', when: 'ieri alle 11:05' },
    { id: 'a4', at: '2026-10-14T18:30:00Z', actor: 'Giulia', text: 'ha caricato il certificato energetico' },
    { id: 'a5', at: '2026-10-13T10:00:00Z', text: 'Canone di settembre incassato' },
    { id: 'a6', at: '2025-10-11T12:20:00Z', actor: 'Tu', text: 'hai aggiunto l’immobile Trullo dei Sogni' },
  ];

  return (
    <main className="mx-auto max-w-3xl space-y-12 p-4 pb-32 sm:p-6" data-testid="calm-blocks-page">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Blocchi calmi</h1>
        <p className="text-sm text-foreground/70">
          Galleria dei blocchi di UI-16. Qui ce ne sono molti insieme per vederli tutti; in una pagina vera c’è un solo FocusBlock, al massimo tre sezioni, al massimo tre o quattro numeri.
        </p>
        <p className="text-sm" data-testid="last-action">
          Ultima azione: {lastAction}
        </p>
      </div>

      <section aria-labelledby="dev-focus" className="space-y-4">
        <h2 id="dev-focus" className="text-lg font-semibold">
          FocusBlock: i cinque toni
        </h2>
        {CALM_TONES.map((tone) => (
          <FocusBlock
            key={tone}
            tone={tone}
            data-testid={`focus-${tone}`}
            kicker={tone === 'neutral' ? 'Adesso' : tone === 'danger' ? 'Da sistemare subito' : 'Per te'}
            title={`Tono ${TONE_NAME[tone]}`}
            body={tone === 'info' ? undefined : 'Una frase, o due, per dire di che cosa si tratta e perché conviene farlo adesso.'}
            who={tone === 'neutral' || tone === 'warning' ? 'Tocca a te' : undefined}
            when={tone === 'neutral' || tone === 'warning' ? 'Circa 5 minuti' : undefined}
            then={tone === 'neutral' ? 'Poi: il conduttore firma e noi registriamo il contratto' : undefined}
            primary={tone === 'warning' ? { label: 'Registra il contratto', onClick: done('primaria avviso') } : { label: 'Vai al passo', href: `/dev/calm-blocks?tono=${tone}` }}
            secondary={tone === 'neutral' ? { label: 'Più tardi', onClick: done('più tardi') } : undefined}
          />
        ))}
        <FocusBlock
          data-testid="focus-long"
          tone="warning"
          icon={Wrench}
          kicker="Un intervento aspetta una risposta del fornitore"
          title="Hai chiesto una riparazione della caldaia a Casa Bianca e il fornitore non ha ancora risposto alla tua richiesta di venerdì"
          body="Indirizzo: Via_Francesco_Maria_Giuseppe_Montefeltro_della_Rovere_1234567890, interno 12, scala B, Montefiascone."
          who="Tocca al fornitore, Termoidraulica Fratelli Montefeltro della Rovere"
          when="Risposta attesa entro venerdì 18 ottobre alle 12:00"
          then="Poi: scegli un altro fornitore se non risponde entro lunedì"
          primary={writeToSupplier}
          secondary={{ label: 'Vedi la richiesta con tutti i dettagli', href: '/dev/calm-blocks?aperto=richiesta' }}
        />
      </section>

      <section aria-labelledby="dev-stats" className="space-y-6">
        <h2 id="dev-stats" className="text-lg font-semibold">
          StatStrip e StatTile
        </h2>
        <StatStrip label="Tre numeri dei canoni" data-testid="strip-3">
          <StatTile label="Incassati a ottobre su 4.800 € attesi" value="3.600 €" delta="+6% su settembre" />
          <StatTile label="In ritardo · 2 canoni" value="1.200 €" tone="danger" delta="Uno da più di 10 giorni" href="/dev/calm-blocks?numeri=ritardo" />
          <StatTile label="Ancora da incassare" value="0 €" tone="success" />
        </StatStrip>
        <StatStrip label="Quattro numeri, uno per tono" data-testid="strip-4">
          <StatTile label="Occupazione" value="78%" delta="−4 punti su settembre" />
          <StatTile label="Prenotazioni in arrivo" value={12} tone="info" href="/dev/calm-blocks?numeri=arrivi" />
          <StatTile label="Da approvare" value={3} tone="warning" />
          <StatTile label="Ricavi del mese" value="12.480 €" tone="success" delta="+9% su settembre" />
        </StatStrip>
        <StatStrip label="Due numeri" data-testid="strip-2">
          <StatTile label="Richieste aperte" value={5} />
          <StatTile label="Risposta media" value="2 ore e 40 minuti" delta="Più veloce del 15% rispetto a settembre" />
        </StatStrip>
      </section>

      <section aria-labelledby="dev-plain" className="space-y-6">
        <h2 id="dev-plain" className="text-lg font-semibold">
          PlainSection
        </h2>
        <PlainSection title="Con un link di sezione" actionLabel="Tutti i contratti" href="/dev/calm-blocks?sezione=contratti" data-testid="plain-link">
          <p className="text-sm text-foreground/80">Il contenuto è libero: un elenco, un paragrafo, un’altra riga di numeri. Niente scatola attorno.</p>
        </PlainSection>
        <PlainSection title="Con un’azione e un numero" count={3} actionLabel="Segna tutto come letto" onAction={done('sezione: segna tutto')} data-testid="plain-action">
          <p className="text-sm text-foreground/80">L’azione di sezione è un pulsante quando fa qualcosa invece di andare altrove.</p>
        </PlainSection>
        <PlainSection title="Senza azione" data-testid="plain-bare">
          <p className="text-sm text-foreground/80">Solo il titolo e il contenuto.</p>
        </PlainSection>
        <PlainSection title={LONG_NAME} count={12} actionLabel="Vedi la scheda completa dell’immobile" href="/dev/calm-blocks?sezione=immobile" data-testid="plain-long">
          <p className="text-sm text-foreground/80">Il titolo non ha spazi e a 360 px va a capo senza far scorrere la pagina.</p>
        </PlainSection>
      </section>

      <section aria-labelledby="dev-days" className="space-y-6">
        <h2 id="dev-days" className="text-lg font-semibold">
          DayList, TodayList e WeekStrip
        </h2>
        <PlainSection title="Scadenze e rinnovi" actionLabel="Tutte le scadenze" href="/dev/calm-blocks?sezione=scadenze">
          <DayList items={deadlines} data-testid="day-list" />
        </PlainSection>
        <PlainSection title="Oggi e nei prossimi giorni">
          <TodayList items={todayItems} labels={TODAY_LABELS} today={today} data-testid="today-list" />
        </PlainSection>
        <PlainSection title="La tua settimana">
          <WeekStrip days={week} value={day} onValueChange={setDay} today={today} data-testid="week-strip" />
          <p className="text-sm text-foreground/70" data-testid="week-selected">
            Giorno scelto: {day}
          </p>
        </PlainSection>
      </section>

      <section aria-labelledby="dev-activity" className="space-y-6">
        <h2 id="dev-activity" className="text-lg font-semibold">
          ActivityList
        </h2>
        <PlainSection title="Attività recente">
          <ActivityList items={activity} more={{ limit: 3, label: 'Mostra altro' }} data-testid="activity-list" />
        </PlainSection>
        <PlainSection title="Cronologia del contratto, dalla prima voce">
          <ActivityList items={activity.slice(0, 3)} order="oldest" label="Cronologia del contratto" data-testid="activity-oldest" />
        </PlainSection>
      </section>

      <section aria-labelledby="dev-guide" className="space-y-4">
        <h2 id="dev-guide" className="text-lg font-semibold">
          NextStepCard e ChecklistCompact
        </h2>
        <NextStepCard
          data-testid="next-step"
          kicker="Prossimo passo"
          title="Collega il tuo conto per ricevere i pagamenti"
          detail="Servono pochi minuti: Stripe ti chiede i dati dell’attività e l’IBAN."
          position="Passo 3 di 7"
          cta={{ label: 'Collega Stripe', href: '/dev/calm-blocks?passo=stripe', testId: 'next-step-cta' }}
        />
        <NextStepCard data-testid="next-step-bare" kicker="Per ora" titleAs="h3" title="Aspetta che il conduttore compili i suoi dati" detail="Non hai niente da fare: ti avvisiamo noi." />
        <ChecklistCompact
          data-testid="checklist"
          title="Configura Affitti brevi"
          done={2}
          total={5}
          progress="2 di 5"
          next="Prossimo: Collega Stripe · 5 minuti"
          primary={{ label: 'Continua', href: '/dev/calm-blocks?passo=continua' }}
          secondary={{ label: 'Tutti i passi', onClick: done('tutti i passi') }}
        />
        <ChecklistCompact data-testid="checklist-long" title={`Configura ${LONG_NAME}`} done={0} total={4} progress="0 di 4" next={`Prossimo: ${LONG_NAME}`} />
      </section>

      <section aria-labelledby="dev-home" className="space-y-6">
        <h2 id="dev-home" className="text-lg font-semibold">
          Una home composta
        </h2>
        <div className="space-y-6" data-testid="home-example">
          <FocusBlock
            tone="warning"
            kicker="Adesso"
            title="Il canone di Bianchi non è arrivato"
            body="Doveva arrivare il 5 ottobre. Un sollecito gentile di solito basta."
            who="Tocca a te"
            when="In ritardo di 11 giorni"
            then="Poi: se non paga entro il 25, puoi avviare la diffida"
            primary={{ label: 'Invia il sollecito', onClick: done('home: sollecito') }}
            secondary={{ label: 'Vedi il contratto', href: '/dev/calm-blocks?aperto=bianchi' }}
          />
          <PlainSection title="Da fare" count={2} actionLabel="Vedi tutto" actionAriaLabel="Vedi tutto: da fare" href="/dev/calm-blocks?sezione=da-fare">
            <DayList
              items={[
                { id: 'h1', day: addDays(today, -4), title: 'Firma del contratto Neri', subtitle: 'Aspetta la firma del conduttore', onOpen: done('home: contratto Neri'), action: { label: 'Ricorda', ariaLabel: 'Ricorda: firma contratto Neri', onClick: done('home: ricorda') } },
                { id: 'h2', day: addDays(today, 2), title: 'Registrazione del contratto Rossi', subtitle: 'Scade tra 2 giorni', meta: 'tra 2 giorni', tone: 'warning', href: '/dev/calm-blocks?aperto=rossi' },
              ]}
            />
          </PlainSection>
          <StatStrip label="I canoni del mese">
            <StatTile label="Incassati" value="3.600 €" delta="+6% su settembre" />
            <StatTile label="In ritardo" value="1.200 €" tone="danger" href="/dev/calm-blocks?numeri=ritardo" />
            <StatTile label="Da incassare" value="0 €" />
          </StatStrip>
          <PlainSection title="Cosa è successo di recente" actionLabel="Vedi tutto" actionAriaLabel="Vedi tutto: cosa è successo di recente" href="/dev/calm-blocks?sezione=attivita">
            <ActivityList items={activity.slice(0, 2)} />
          </PlainSection>
          <ChecklistCompact
            title="Configura Affitti lunghi"
            done={3}
            total={6}
            progress="3 di 6"
            next="Prossimo: Carica il modello di contratto"
            primary={{ label: 'Continua', href: '/dev/calm-blocks?passo=modello' }}
          />
        </div>
      </section>
    </main>
  );
}
