import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { FROM_TABLET_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import { usePortalRootProps } from '../site-appearance';
import { DestinationPicker, type Destination } from './destination-picker';
import { GuestsPicker } from './guests-picker';
import { StayCalendar } from './stay-calendar';
import { formatStayRange, guestsSummary, siteLocale } from './stay-format';
import { StaySheet, type StayValue } from './stay-sheet';
import type { StayCalendarData } from './use-public-calendar';
import './stay-pickers.css';

export interface SearchProps {
  /** The id of the destination chosen; empty for all. */
  destination: string;
  onDestinationChange: (id: string) => void;
  destinations: readonly Destination[];
  stay: StayValue;
  onStayChange: (patch: Partial<StayValue>) => void;
  /** The nights of the site: for each day the lowest price among its homes, taken when none is free. */
  calendar: StayCalendarData;
  maxGuests?: number;
  petsAllowed?: boolean;
  /** The "Dove" field: not for a site with one home. */
  showDestination?: boolean;
  /** Called by the search button when the dates are chosen. */
  onSearch: () => void;
}

/** What the three fields say, in words. */
function useSearchSummary({ destination, destinations, stay }: Pick<SearchProps, 'destination' | 'destinations' | 'stay'>) {
  const { t, i18n } = useTranslation();
  const locale = siteLocale(i18n.language);
  const place = destinations.find((item) => item.id === destination)?.label ?? t('stayPickers.destination.all');
  const when = formatStayRange(stay.checkIn, stay.checkOut, locale);
  const who = guestsSummary(t, stay.adults, stay.children, stay.pets);
  return { place, when, who };
}

function FieldFace({ label, value, empty }: { label: string; value: string; empty?: boolean }) {
  return (
    <>
      <span className="stay-search__label">{label}</span>
      <span className={cn('stay-search__value', empty && 'is-empty')}>{value}</span>
    </>
  );
}

/**
 * The search of the site (DB-20), "Dove · Quando · Chi": on a tablet or a desktop three fields in a bar, each opening its own
 * popover under it (the places, the calendar with the prices, the guests) and a button that searches; on a phone it is a
 * `SearchTrigger`, one field that opens a sheet with the three one under the other. The state is the page's (the address): this
 * only shows it and reports a change. Searching without dates does not search: a sentence says to choose them, and the
 * calendar opens.
 */
export function SearchBar(props: SearchProps) {
  const fromTablet = useMediaQuery(FROM_TABLET_QUERY);
  return fromTablet ? <DesktopSearchBar {...props} /> : <SearchTrigger {...props} />;
}

function DesktopSearchBar({
  destination,
  onDestinationChange,
  destinations,
  stay,
  onStayChange,
  calendar,
  maxGuests,
  petsAllowed,
  showDestination = true,
  onSearch,
}: SearchProps) {
  const { t } = useTranslation();
  const portal = usePortalRootProps();
  const { place, when, who } = useSearchSummary({ destination, destinations, stay });
  const [open, setOpen] = useState<'where' | 'when' | 'who' | null>(null);
  const [message, setMessage] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!stay.checkIn || !stay.checkOut) {
      setMessage(t('stayPickers.search.needDates'));
      setOpen('when');
      return;
    }
    setMessage('');
    setOpen(null);
    onSearch();
  };

  const toggle = (which: 'where' | 'when' | 'who') => (next: boolean) => setOpen(next ? which : null);

  return (
    <form
      role="search"
      aria-label={t('stayPickers.search.label')}
      className="stay-search"
      data-single={showDestination ? undefined : ''}
      onSubmit={submit}
      noValidate
      data-testid="search-bar"
    >
      {showDestination ? (
        <Popover open={open === 'where'} onOpenChange={toggle('where')}>
          <PopoverTrigger asChild>
            <button type="button" className="stay-search__field" data-field="where">
              <FieldFace label={t('stayPickers.search.where')} value={place} empty={!destination} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            {...portal}
            className={cn(portal.className, 'stay-pop')}
            data-section="where"
            align="start"
            aria-label={t('stayPickers.destination.label')}
          >
            <DestinationPicker
              destinations={destinations}
              value={destination}
              label={t('stayPickers.destination.label')}
              onChange={(id) => {
                onDestinationChange(id);
                setOpen('when');
              }}
            />
          </PopoverContent>
        </Popover>
      ) : null}

      <StaySheet
        section="dates"
        open={open === 'when'}
        onOpenChange={toggle('when')}
        title={t('stayPickers.search.datesTitle')}
        trigger={
          <button type="button" className="stay-search__field" data-field="when">
            <FieldFace label={t('stayPickers.search.when')} value={when || t('stayPickers.search.addDates')} empty={!when} />
          </button>
        }
        value={stay}
        onChange={onStayChange}
        calendar={calendar}
        onRangeComplete={() => setOpen('who')}
      />

      <StaySheet
        section="guests"
        open={open === 'who'}
        onOpenChange={toggle('who')}
        title={t('stayPickers.search.guestsTitle')}
        trigger={
          <button type="button" className="stay-search__field" data-field="who">
            <FieldFace label={t('stayPickers.search.who')} value={who} />
          </button>
        }
        value={stay}
        onChange={onStayChange}
        calendar={calendar}
        maxGuests={maxGuests}
        petsAllowed={petsAllowed}
      />

      <Button type="submit" className="stay-search__go public-site-cta border-0">
        <Search aria-hidden="true" className="mr-2 h-5 w-5" />
        {t('stayPickers.search.go')}
      </Button>
      <p className="stay-search__msg" role="status" aria-live="polite">
        {message}
      </p>
    </form>
  );
}

/**
 * The field of a phone (DB-20): one button that says where, when and who in two lines and opens a sheet that fills the screen
 * with the three one under the other (the one in use open, the others closed with their value on the right) and "Cerca
 * disponibilità" at the bottom.
 */
export function SearchTrigger({
  destination,
  onDestinationChange,
  destinations,
  stay,
  onStayChange,
  calendar,
  maxGuests,
  petsAllowed,
  showDestination = true,
  onSearch,
}: SearchProps) {
  const { t } = useTranslation();
  const portal = usePortalRootProps();
  const uid = useId();
  const { place, when, who } = useSearchSummary({ destination, destinations, stay });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [section, setSection] = useState<'where' | 'when' | 'who'>('when');
  const [message, setMessage] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!stay.checkIn || !stay.checkOut) {
      setMessage(t('stayPickers.search.needDates'));
      setSection('when');
      return;
    }
    setMessage('');
    setSheetOpen(false);
    onSearch();
  };

  const sections: { id: 'where' | 'when' | 'who'; title: string; value: string }[] = [
    ...(showDestination ? [{ id: 'where' as const, title: t('stayPickers.search.where'), value: place }] : []),
    { id: 'when', title: t('stayPickers.search.when'), value: when || t('stayPickers.search.addDates') },
    { id: 'who', title: t('stayPickers.search.who'), value: who },
  ];

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetTrigger asChild>
        <button type="button" className="stay-search-m" data-testid="search-trigger">
          <Search aria-hidden="true" />
          <span className="stay-search-m__text">
            <strong>{when || t('stayPickers.search.whenPhone')}</strong>
            <small>
              {when ? '' : `${t('stayPickers.search.addDates')} · `}
              {who}
            </small>
          </span>
          <span className="stay-search-m__go">{t('stayPickers.search.go')}</span>
        </button>
      </SheetTrigger>
      <SheetContent
        {...portal}
        side="bottom"
        className={cn(portal.className, 'stay-sheet stay-sheet--full')}
        data-testid="search-sheet"
      >
        <SheetTitle className="stay-sheet__title">{t('stayPickers.search.whenPhone')}</SheetTitle>
        <SheetDescription className="stay-sheet__desc">{t('stayPickers.search.sheetDescription')}</SheetDescription>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit} noValidate>
          <div className="stay-sheet__body">
            {sections.map((item) => {
              const isOpen = section === item.id;
              return (
                <section key={item.id} className="stay-acc" data-open={isOpen}>
                  <h3>
                    <button
                      type="button"
                      className="stay-acc__head"
                      aria-expanded={isOpen}
                      aria-controls={`${uid}-${item.id}`}
                      onClick={() => setSection(item.id)}
                    >
                      <span>{item.title}</span>
                      <span className="stay-acc__value">{item.value}</span>
                    </button>
                  </h3>
                  <div id={`${uid}-${item.id}`} className="stay-acc__body" hidden={!isOpen}>
                    {item.id === 'where' ? (
                      <DestinationPicker
                        destinations={destinations}
                        value={destination}
                        label={t('stayPickers.destination.label')}
                        onChange={(id) => {
                          onDestinationChange(id);
                          setSection('when');
                        }}
                      />
                    ) : null}
                    {item.id === 'when' && isOpen ? (
                      <StayCalendar
                        value={stay}
                        onChange={onStayChange}
                        data={calendar}
                        layout="scroll"
                        months={1}
                      />
                    ) : null}
                    {item.id === 'who' ? (
                      <GuestsPicker value={stay} onChange={onStayChange} maxGuests={maxGuests} petsAllowed={petsAllowed} />
                    ) : null}
                  </div>
                </section>
              );
            })}
            <p className="stay-search__msg" role="status" aria-live="polite">
              {message}
            </p>
          </div>
          <div className="stay-sheet__foot">
            <Button type="submit" className="public-site-cta border-0">
              <Search aria-hidden="true" className="mr-2 h-5 w-5" />
              {t('stayPickers.search.goLong')}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
