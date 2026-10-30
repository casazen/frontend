import { useRef, useState, type ReactElement, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { FROM_TABLET_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import { usePortalRootProps } from '../site-appearance-context';
import { GuestsPicker, type GuestsValue } from './guests-picker';
import type { StayRange } from './stay-calendar-model';
import { StayCalendar } from './stay-calendar';
import type { StayCalendarData } from './use-public-calendar';
import './stay-pickers.css';

/** The stay as the pickers handle it: the dates and the guests. */
export interface StayValue extends StayRange, GuestsValue {}

/** What a sheet holds: the calendar, the guests, or both. */
export type StaySection = 'dates' | 'guests' | 'both';

export interface StaySheetProps {
  section: StaySection;
  /** The element that opens it (one button): the focus comes back to it when it closes. */
  trigger: ReactElement;
  value: StayValue;
  onChange: (patch: Partial<StayValue>) => void;
  calendar: StayCalendarData;
  maxGuests?: number;
  petsAllowed?: boolean;
  childrenAges?: (number | null)[];
  onChildrenAgesChange?: (ages: (number | null)[]) => void;
  /** To open and close it from outside; without them it manages itself. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The title of the sheet of a phone (and the name of the popover for a screen reader). */
  title: string;
  description?: string;
  /** The label of the one button that closes it. */
  doneLabel?: string;
  /** Called when the person has chosen the arrival and the departure. */
  onRangeComplete?: () => void;
  /** Extra content at the end (the sheet of the search puts the button that searches there). */
  footer?: ReactNode;
}

/**
 * Where the dates and the guests are chosen (DB-20): a popover under the field on a tablet or a desktop, a sheet from the bottom
 * on a phone, with the same content and one "Fatto". It replaces the two forms with the same ids that the booking card drew
 * (one in the page, one in the sheet): every id here comes from `useId`. The popover and the sheet wear the theme of the site
 * (they are drawn outside its root) and the focus goes to the day that takes the tab stop of the calendar when they open.
 */
export function StaySheet({
  section,
  trigger,
  value,
  onChange,
  calendar,
  maxGuests,
  petsAllowed,
  childrenAges,
  onChildrenAgesChange,
  open: openProp,
  onOpenChange,
  title,
  description,
  doneLabel,
  onRangeComplete,
  footer,
}: StaySheetProps) {
  const { t } = useTranslation();
  const fromTablet = useMediaQuery(FROM_TABLET_QUERY);
  const portal = usePortalRootProps();
  const [innerOpen, setInnerOpen] = useState(false);
  const open = openProp ?? innerOpen;
  const contentRef = useRef<HTMLDivElement>(null);

  const setOpen = (next: boolean) => {
    setInnerOpen(next);
    onOpenChange?.(next);
  };

  const handleRange = (range: StayRange) => {
    onChange(range);
    if (range.checkIn && range.checkOut) onRangeComplete?.();
  };

  const body = (
    <>
      {section !== 'guests' ? (
        <StayCalendar
          value={value}
          onChange={handleRange}
          data={calendar}
          layout={fromTablet ? 'paged' : 'scroll'}
          months={fromTablet ? 2 : 1}
        />
      ) : null}
      {section === 'both' ? <div className="stay-sheet__sep my-3 border-t" aria-hidden="true" /> : null}
      {section !== 'dates' ? (
        <GuestsPicker
          value={value}
          onChange={(guests) => onChange(guests)}
          maxGuests={maxGuests}
          petsAllowed={petsAllowed}
          childrenAges={childrenAges}
          onChildrenAgesChange={onChildrenAgesChange}
        />
      ) : null}
    </>
  );

  // The focus goes where a person chooses: the day of the grid that takes the tab stop, else the first field.
  const focusInside = (event: Event) => {
    const target =
      contentRef.current?.querySelector<HTMLElement>('[data-date][tabindex="0"]') ??
      contentRef.current?.querySelector<HTMLElement>('button, input, [tabindex="0"]');
    if (!target) return;
    event.preventDefault();
    target.focus();
  };

  const done = (
    <Button type="button" className="public-site-cta border-0" onClick={() => setOpen(false)} data-testid="stay-sheet-done">
      {doneLabel ?? t('stayPickers.sheet.done')}
    </Button>
  );

  if (fromTablet) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          {...portal}
          ref={contentRef}
          className={cn(portal.className, 'stay-pop')}
          data-section={section}
          data-testid="stay-popover"
          align="start"
          aria-label={title}
          onOpenAutoFocus={focusInside}
        >
          {body}
          <div className="stay-pop__foot">
            {footer}
            {done}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        {...portal}
        ref={contentRef}
        side="bottom"
        className={cn(portal.className, 'stay-sheet')}
        data-testid="stay-sheet"
        onOpenAutoFocus={focusInside}
      >
        <SheetTitle className="stay-sheet__title">{title}</SheetTitle>
        <SheetDescription className={description ? 'stay-sheet__desc' : 'sr-only'}>
          {description ?? title}
        </SheetDescription>
        <div className="stay-sheet__body">{body}</div>
        <div className="stay-sheet__foot">
          {footer}
          {done}
        </div>
      </SheetContent>
    </Sheet>
  );
}
