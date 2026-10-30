/* eslint-disable i18next/no-literal-string -- A page for developers and for the Playwright runs, not a screen of the product: it is not in the production build (see routes/dev-routes.tsx), so its words are not translated. */
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DestinationPicker, type Destination } from '@/features/public-site/stay/destination-picker';
import { GuestsPicker } from '@/features/public-site/stay/guests-picker';
import { SearchBar } from '@/features/public-site/stay/search-bar';
import type { CalendarDay } from '@/features/public-site/stay/stay-calendar-model';
import { StayCalendar } from '@/features/public-site/stay/stay-calendar';
import { StaySheet } from '@/features/public-site/stay/stay-sheet';
import { useStayState } from '@/features/public-site/stay/use-stay-state';
import { usePublicPropertyCalendar, type StayCalendarData } from '@/features/public-site/stay/use-public-calendar';
import { SiteAppearanceProvider } from '@/features/public-site/site-appearance';
import {
  PUBLIC_SITE_FONTS,
  PUBLIC_SITE_THEMES,
  type PublicSiteFontId,
  type PublicSiteThemeId,
} from '@/lib/public-site-themes';
import { addDays, todayInRome } from '@/lib/stay-dates';
import '@/styles/public-tokens.css';

const DESTINATIONS: Destination[] = [
  { id: 'itria', label: 'Valle d’Itria', sub: 'Trulli, ulivi e masserie' },
  { id: 'salento', label: 'Salento', sub: 'Mare, barocco e campagna' },
  { id: 'a-very-long-destination-name-that-must-wrap', label: 'Una destinazione con un nome lunghissimo che deve andare a capo senza spingere la pagina', sub: 'Con una riga di spiegazione lunga quanto basta per andare a capo' },
];

/** Made-up nights: a price that goes up on Friday and Saturday, some taken nights, a minimum stay on some arrivals. */
function fakeDays(today: string): CalendarDay[] {
  return Array.from({ length: 400 }, (_, offset) => {
    const date = addDays(today, offset);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const weekend = weekday === 5 || weekday === 6;
    return {
      date,
      available: !(offset % 19 === 6 || offset % 19 === 7 || offset % 19 === 8),
      priceCents: weekend ? 19000 : 16500,
      minNights: offset % 19 >= 12 && offset % 19 <= 14 ? 3 : 2,
    };
  });
}

type FakeStatus = StayCalendarData['status'];

/** The pickers of the public site (DB-20) on one page, on made-up data, to look at them and to let Playwright and axe walk through them. */
export default function StayPickersPage() {
  const today = todayInRome();
  const [status, setStatus] = useState<FakeStatus>('ready');
  const [themeId, setThemeId] = useState<PublicSiteThemeId>('terra');
  const [fontId, setFontId] = useState<PublicSiteFontId | null>(null);
  const [destination, setDestination] = useState('');
  const [searched, setSearched] = useState(0);
  const [sheetOpenCount, setSheetOpenCount] = useState(0);
  const { stay, problems, setStay, clearDates, linkTo } = useStayState({ maxGuests: 4, petsAllowed: true });

  // With `?site=<slug>&property=<slug or id>` the calendar of that property is read from the API (the real endpoint of DB-03b);
  // otherwise it is drawn on made-up nights.
  const [params] = useSearchParams();
  const real = usePublicPropertyCalendar(params.get('site') ?? undefined, params.get('property') ?? undefined);
  const useReal = Boolean(params.get('site') && params.get('property'));

  const days = useMemo(() => fakeDays(today), [today]);
  const fake = useMemo<StayCalendarData>(
    () => ({
      status,
      days: status === 'ready' ? days : [],
      today,
      end: addDays(today, 400),
      currency: 'EUR',
      onRetry: () => setStatus('ready'),
    }),
    [status, days, today],
  );
  const data = useReal ? real : fake;

  const range = { checkIn: stay.checkIn, checkOut: stay.checkOut };

  return (
    <SiteAppearanceProvider value={{ themeId, fontId }}>
      <div className="public-site-root min-h-screen px-4 py-6" data-theme={themeId} data-font={fontId ?? undefined} data-testid="stay-pickers-page">
        <div className="mx-auto max-w-5xl space-y-10">
          <header className="space-y-3">
            <h1 className="text-3xl">Selettori del soggiorno</h1>
            <p className="text-sm text-[var(--cz-public-muted)]">
              Prezzi e notti occupate sono inventati. Lo stato del soggiorno sta nell’indirizzo: <code data-testid="stay-query">{window.location.search}</code>
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Tema">
              {PUBLIC_SITE_THEMES.map((id) => (
                <button key={id} type="button" className="public-site-outline min-h-11 px-4" aria-pressed={themeId === id} onClick={() => setThemeId(id)}>
                  {id}
                </button>
              ))}
              {PUBLIC_SITE_FONTS.map((id) => (
                <button key={id} type="button" className="public-site-outline min-h-11 px-4" aria-pressed={fontId === id} onClick={() => setFontId(fontId === id ? null : id)}>
                  {id}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Stato dei dati">
              {(['ready', 'loading', 'error'] as const).map((value) => (
                <button key={value} type="button" className="public-site-outline min-h-11 px-4" aria-pressed={status === value} onClick={() => setStatus(value)}>
                  {value}
                </button>
              ))}
            </div>
          </header>

          <section aria-labelledby="dev-search" className="space-y-3">
            <h2 id="dev-search" className="text-xl">Barra «Dove · Quando · Chi»</h2>
            <SearchBar
              destination={destination}
              onDestinationChange={setDestination}
              destinations={DESTINATIONS}
              stay={stay}
              onStayChange={(patch) => setStay(patch)}
              calendar={data}
              maxGuests={4}
              petsAllowed
              onSearch={() => setSearched((count) => count + 1)}
            />
            <p className="text-sm" data-testid="search-count">Ricerche fatte: {searched}</p>
          </section>

          <section aria-labelledby="dev-calendar" className="space-y-3">
            <h2 id="dev-calendar" className="text-xl">Calendario con i prezzi</h2>
            <div className="public-site-card p-4 sm:p-6">
              <StayCalendar value={range} onChange={(next) => setStay(next)} data={data} />
            </div>
            <div className="public-site-card mx-auto max-w-sm p-4">
              <p className="mb-2 text-sm font-semibold">Un mese solo, in colonna</p>
              <StayCalendar value={range} onChange={(next) => setStay(next)} data={data} months={1} layout="scroll" showPrices={false} />
            </div>
          </section>

          <section aria-labelledby="dev-guests" className="space-y-3">
            <h2 id="dev-guests" className="text-xl">Ospiti (la casa ne ospita 4)</h2>
            <div className="public-site-card max-w-md p-4">
              <GuestsPicker value={stay} onChange={(next) => setStay(next)} maxGuests={4} petsAllowed />
            </div>
            {problems.length > 0 ? <p className="text-sm" data-testid="stay-problems">Problemi dell’indirizzo: {problems.join(', ')}</p> : null}
          </section>

          <section aria-labelledby="dev-sheet" className="space-y-3">
            <h2 id="dev-sheet" className="text-xl">Popover su tablet, foglio su telefono</h2>
            <div className="flex flex-wrap gap-3">
              <StaySheet
                section="both"
                title="Date e ospiti"
                trigger={<button type="button" className="public-site-outline min-h-11 px-4" data-testid="open-both">Date e ospiti</button>}
                value={stay}
                onChange={(patch) => setStay(patch)}
                calendar={data}
                maxGuests={4}
                petsAllowed
                onOpenChange={(open) => open && setSheetOpenCount((count) => count + 1)}
              />
              <button type="button" className="public-site-outline min-h-11 px-4" onClick={clearDates} data-testid="clear-dates">Cancella le date</button>
              <a className="public-site-link min-h-11 py-2" href={linkTo('/book/demo/property/casa')} data-testid="stay-link">Link con il soggiorno</a>
            </div>
            <p className="text-sm" data-testid="sheet-count">Aperture: {sheetOpenCount}</p>
          </section>

          <section aria-labelledby="dev-dest" className="space-y-3">
            <h2 id="dev-dest" className="text-xl">Destinazioni</h2>
            <div className="public-site-card max-w-md p-3">
              <DestinationPicker destinations={DESTINATIONS} value={destination} onChange={setDestination} label="Dove vuoi andare?" />
            </div>
          </section>
        </div>
      </div>
    </SiteAppearanceProvider>
  );
}
