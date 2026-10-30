import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ChevronLeft, ChevronRight, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FROM_TABLET_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { addDays, nightsBetween, startOfMonth } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import {
  CALENDAR_NAV_KEYS,
  arrivalProblem,
  buildCalendarIndex,
  calendarMonths,
  dayState,
  defaultFocusDate,
  minNightsAt,
  monthGrid,
  moveFocus,
  rangeProblem,
  selectDay,
  stayTotalCents,
  type CalendarIndex,
  type CalendarNavKey,
  type DayState,
  type RangeProblem,
  type StayRange,
} from './stay-calendar-model';
import {
  formatDayLong,
  formatDayMonth,
  formatMonthYear,
  formatPrice,
  siteLocale,
  weekdayInitials,
  weekdayName,
} from './stay-format';
import type { StayCalendarData } from './use-public-calendar';
import './stay-pickers.css';

export interface StayCalendarProps {
  /** The stay chosen. `checkOut` is empty while only the arrival is. */
  value: StayRange;
  onChange: (next: StayRange) => void;
  /** The nights: from `usePublicPropertyCalendar`, or from the calendar of a whole site. */
  data: StayCalendarData;
  /** Months side by side: two from a tablet up, one on a phone. */
  months?: 1 | 2;
  /** `paged`: arrows between the months. `scroll`: the months one under the other (the sheet of a phone). */
  layout?: 'paged' | 'scroll';
  /** The price of each night under its number. */
  showPrices?: boolean;
  className?: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** How a chosen day takes part in the stay. */
type StayRole = 'start' | 'end' | 'in' | 'none';

function stayRole(date: string, checkIn: string, checkOut: string): StayRole {
  if (date === checkIn) return 'start';
  if (date === checkOut) return 'end';
  return checkIn && checkOut && date > checkIn && date < checkOut ? 'in' : 'none';
}

interface DayCellProps {
  date: string;
  state: DayState;
  priceCents: number | null;
  currency: string;
  locale: string;
  showPrice: boolean;
  isToday: boolean;
  role: StayRole;
  preview: boolean;
  tabStop: boolean;
  onChoose: (date: string) => void;
  onHover: (date: string) => void;
  register: (date: string, element: HTMLButtonElement | null) => void;
}

/**
 * One day (the night that starts on it). A day that is over or not known is not a button; every other day is, taken ones
 * included (a taken night can still be a check-out day, and a click on one as an arrival says why it cannot be). Its name tells
 * everything a color tells: free or taken, the price, whether it is the arrival or the departure.
 */
const DayCell = memo(function DayCell({
  date,
  state,
  priceCents,
  currency,
  locale,
  showPrice,
  isToday,
  role,
  preview,
  tabStop,
  onChoose,
  onHover,
  register,
}: DayCellProps) {
  const { t } = useTranslation();
  const dayNumber = Number(date.slice(8, 10));

  let label = formatDayLong(date, locale);
  if (state === 'past') label += `, ${t('stayPickers.calendar.past')}`;
  else if (state === 'unknown') label += `, ${t('stayPickers.calendar.unknown')}`;
  else if (state === 'busy') label += `, ${t('stayPickers.calendar.busyNight')}`;
  else {
    label += `, ${t('stayPickers.calendar.freeNight')}`;
    if (showPrice && priceCents !== null) {
      label += `, ${t('stayPickers.calendar.perNight', { price: formatPrice(priceCents, currency, locale) })}`;
    }
  }
  if (role === 'start') label += `, ${t('stayPickers.calendar.arrivalChosen')}`;
  if (role === 'end') label += `, ${t('stayPickers.calendar.departureChosen')}`;

  if (state === 'past' || state === 'unknown') {
    return (
      <div role="gridcell" aria-disabled="true" className="stay-cal__cell">
        <span className={cn('stay-cal__day', state === 'past' ? 'is-past' : 'is-unknown')}>
          <span className="stay-cal__n" aria-hidden="true">
            {dayNumber}
          </span>
          <span className="sr-only">{label}</span>
        </span>
      </div>
    );
  }

  const busy = state === 'busy';
  return (
    <div role="gridcell" aria-selected={role === 'none' ? undefined : true} className="stay-cal__cell">
      <button
        type="button"
        ref={(element) => register(date, element)}
        data-date={date}
        data-state={busy ? 'busy' : 'free'}
        tabIndex={tabStop ? 0 : -1}
        aria-label={label}
        aria-current={isToday ? 'date' : undefined}
        className={cn(
          'stay-cal__day',
          busy && 'is-busy',
          role === 'start' && 'is-start',
          role === 'end' && 'is-end',
          role === 'in' && 'is-in',
          preview && role === 'none' && 'is-pre',
        )}
        onClick={() => onChoose(date)}
        onMouseEnter={() => onHover(date)}
        onFocus={() => onHover(date)}
      >
        <span className="stay-cal__n">{dayNumber}</span>
        {showPrice && !busy && priceCents !== null ? (
          <span className="stay-cal__p">{formatPrice(priceCents, currency, locale)}</span>
        ) : null}
      </button>
    </div>
  );
});

interface MonthProps {
  month: string;
  index: CalendarIndex;
  value: StayRange;
  hover: string;
  tabStop: string;
  showPrices: boolean;
  loading: boolean;
  locale: string;
  currency: string;
  titleId: string;
  initials: string[];
  names: string[];
  onChoose: (date: string) => void;
  onHover: (date: string) => void;
  register: (date: string, element: HTMLButtonElement | null) => void;
}

/** A month: its name, the days of the week and the weeks that start on Monday. */
function CalendarMonth({
  month,
  index,
  value,
  hover,
  tabStop,
  showPrices,
  loading,
  locale,
  currency,
  titleId,
  initials,
  names,
  onChoose,
  onHover,
  register,
}: MonthProps) {
  const { leadingBlanks, dates } = useMemo(() => monthGrid(month), [month]);
  const cells: (string | null)[] = [...Array<null>(leadingBlanks).fill(null), ...dates];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
  const { checkIn, checkOut } = value;

  return (
    <div className="min-w-0" data-month={month}>
      <h3 id={titleId} className="stay-cal__title">
        {formatMonthYear(month, locale)}
      </h3>
      <div role="grid" aria-labelledby={titleId} aria-busy={loading || undefined}>
        <div role="row" className="stay-cal__row">
          {initials.map((initial, column) => (
            <span key={column} role="columnheader" aria-label={names[column]} className="stay-cal__dow">
              <span aria-hidden="true">{initial}</span>
            </span>
          ))}
        </div>
        {weeks.map((week, weekIndex) => (
          <div role="row" className="stay-cal__row" key={weekIndex}>
            {week.map((date, column) => {
              if (date === null) return <div key={column} role="gridcell" aria-hidden="true" className="stay-cal__cell" />;
              if (loading) {
                return (
                  <div key={date} role="gridcell" aria-disabled="true" className="stay-cal__cell">
                    <div className="stay-cal__skel" />
                  </div>
                );
              }
              return (
                <DayCell
                  key={date}
                  date={date}
                  state={dayState(index, date)}
                  priceCents={index.days.get(date)?.priceCents ?? null}
                  currency={currency}
                  locale={locale}
                  showPrice={showPrices && !index.unverified}
                  isToday={date === index.today}
                  role={stayRole(date, checkIn, checkOut)}
                  preview={Boolean(checkIn && !checkOut && hover && date > checkIn && date <= hover)}
                  tabStop={date === tabStop}
                  onChoose={onChoose}
                  onHover={onHover}
                  register={register}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The sentence a problem of the stay is told with. */
function problemSentence(t: TFunction, problem: RangeProblem, locale: string): string {
  switch (problem.kind) {
    case 'past':
      return t('stayPickers.problem.past');
    case 'unknown':
      return t('stayPickers.problem.unknown');
    case 'busyArrival':
      return t('stayPickers.problem.busyArrival', { date: formatDayMonth(problem.date, locale) });
    case 'busyBetween':
      return t('stayPickers.problem.busyBetween');
    case 'minNights':
      return t('stayPickers.problem.minNights', {
        count: problem.minNights,
        date: formatDayMonth(problem.earliestCheckOut, locale),
      });
  }
}

/**
 * The range calendar of the public site (DB-20): one component for the search, the property page and the checkout. It is
 * controlled (`value`, `onChange`) and draws what the data says: the price of each night, the nights that are taken (struck
 * through and named "occupata" for a screen reader, never only a color), and why a stay cannot be had (a taken night inside it,
 * fewer nights than the minimum of that arrival). The arrival is chosen first, then the departure: a click on a day before the
 * arrival, or with a whole stay already chosen, starts again.
 *
 * Keyboard: the arrows move by a day or a week, Home and End to the ends of the week, Page up and Page down by a month; Enter
 * or Space chooses. What changes is said in a `status` area: the stay with its nights and what they cost together, or what is
 * wrong. While the nights load there is a skeleton; when they cannot be read the days can still be chosen, with a note that the
 * dates are checked before the payment (and with no price, as today). Offline, the last read stays, with a note.
 */
export function StayCalendar({
  value,
  onChange,
  data,
  months,
  layout = 'paged',
  showPrices = true,
  className,
}: StayCalendarProps) {
  const { t, i18n } = useTranslation();
  const locale = siteLocale(i18n.language);
  const uid = useId();
  const online = useOnlineStatus();
  const fromTablet = useMediaQuery(FROM_TABLET_QUERY);

  const loading = data.status === 'loading';
  const unverified = data.status === 'error';
  const index = useMemo(
    () => buildCalendarIndex(data.days, data.today, data.end, unverified),
    [data.days, data.today, data.end, unverified],
  );
  const monthList = useMemo(() => calendarMonths(index), [index]);
  const scroll = layout === 'scroll';
  const shown = scroll ? monthList.length : (months ?? (fromTablet ? 2 : 1));

  // The first month in view: the one the person paged to, else the one of the arrival, else the current one.
  const [pageChoice, setPageChoice] = useState<number | null>(null);
  const arrivalMonth = monthList.indexOf(startOfMonth(value.checkIn || index.today));
  const maxPage = Math.max(0, monthList.length - shown);
  const page = clamp(pageChoice ?? Math.max(0, arrivalMonth), 0, maxPage);
  const visibleMonths = scroll ? monthList : monthList.slice(page, page + shown);

  const [problem, setProblem] = useState<RangeProblem | null>(null);
  const [hover, setHover] = useState('');
  const [focusChoice, setFocusChoice] = useState<string | null>(null);
  const lastDay = addDays(index.end, -1);

  // The day that takes the tab stop of the grid: where the focus was, else the arrival, else the first free day. If that is
  // not in a month in view, the first day in view.
  const wanted =
    focusChoice && focusChoice >= index.today && focusChoice <= lastDay ? focusChoice : defaultFocusDate(index, value);
  const firstInView = visibleMonths[0] && visibleMonths[0] > index.today ? visibleMonths[0] : index.today;
  const tabStop = visibleMonths.includes(startOfMonth(wanted)) ? wanted : firstInView;

  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);
  const register = useCallback((date: string, element: HTMLButtonElement | null) => {
    if (element) buttons.current.set(date, element);
    else buttons.current.delete(date);
  }, []);

  // After a move by keyboard the target may be in a month that was not drawn: focus it once it is there.
  useLayoutEffect(() => {
    const date = pendingFocus.current;
    const element = date ? buttons.current.get(date) : undefined;
    if (element) {
      element.focus();
      pendingFocus.current = null;
    }
  });

  const focusDay = (date: string) => {
    pendingFocus.current = date;
    setFocusChoice(date);
    if (!scroll) {
      const target = monthList.indexOf(startOfMonth(date));
      if (target >= 0 && (target < page || target >= page + shown)) {
        setPageChoice(target < page ? target : target - shown + 1);
      }
    }
  };

  // The stay as the last click left it. The parent writes it in the address and the router renders it a moment later: a second
  // click that comes before then (a quick hand, a test) must build on the first one, not on the value that was there.
  const latest = useRef<StayRange>(value);
  useEffect(() => {
    latest.current = { checkIn: value.checkIn, checkOut: value.checkOut };
  }, [value.checkIn, value.checkOut]);

  const choose = useCallback(
    (date: string) => {
      const result = selectDay(index, latest.current, date);
      setProblem(result.problem);
      setFocusChoice(date);
      if (!result.problem) {
        latest.current = result.value;
        onChange(result.value);
      }
    },
    [index, onChange],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(CALENDAR_NAV_KEYS as readonly string[]).includes(event.key)) return;
    const current = (event.target as HTMLElement).closest<HTMLElement>('[data-date]')?.dataset.date;
    if (!current) return;
    event.preventDefault();
    const target = moveFocus(current, event.key as CalendarNavKey);
    const bounded = target < index.today ? index.today : target > lastDay ? lastDay : target;
    if (bounded !== current) focusDay(bounded);
  };

  // The preview of the stay follows the pointer and the focus: when both leave the grid it goes.
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHover('');
  };

  const move = (delta: number) => setPageChoice(clamp(page + delta, 0, maxPage));
  const clear = () => {
    setProblem(null);
    latest.current = { checkIn: '', checkOut: '' };
    onChange({ checkIn: '', checkOut: '' });
  };

  const initials = useMemo(() => weekdayInitials(locale), [locale]);
  const names = useMemo(() => Array.from({ length: 7 }, (_, column) => weekdayName(column, locale)), [locale]);

  const nights = nightsBetween(value.checkIn, value.checkOut);
  const valueProblem =
    !loading && value.checkIn
      ? value.checkOut
        ? rangeProblem(index, value.checkIn, value.checkOut)
        : arrivalProblem(index, value.checkIn)
      : null;
  const total = nights > 0 && showPrices && !unverified ? stayTotalCents(index, value.checkIn, value.checkOut) : null;
  const shownProblem = problem ?? valueProblem;

  let status: string;
  if (loading) status = t('stayPickers.calendar.loading');
  else if (shownProblem) status = problemSentence(t, shownProblem, locale);
  else if (nights > 0) {
    status =
      total === null
        ? t('stayPickers.calendar.range', {
            checkIn: formatDayMonth(value.checkIn, locale),
            checkOut: formatDayMonth(value.checkOut, locale),
            count: nights,
          })
        : t('stayPickers.calendar.rangeTotal', {
            checkIn: formatDayMonth(value.checkIn, locale),
            checkOut: formatDayMonth(value.checkOut, locale),
            count: nights,
            total: formatPrice(total, data.currency, locale),
          });
  } else if (value.checkIn) {
    status = t('stayPickers.calendar.chooseDeparture', {
      date: formatDayMonth(value.checkIn, locale),
      count: minNightsAt(index, value.checkIn),
    });
  } else status = t('stayPickers.calendar.chooseArrival');

  const monthsLabel = visibleMonths.map((month) => formatMonthYear(month, locale)).join(' · ');
  const columns = scroll ? 1 : Math.min(shown, visibleMonths.length || 1);

  return (
    <div
      className={cn('stay-cal', className)}
      data-layout={layout}
      data-testid="stay-calendar"
      style={{ '--stay-cal-cols': columns } as CSSProperties}
    >
      {unverified ? (
        <div role="alert" className="stay-cal__notice stay-cal__notice--error" data-testid="stay-calendar-error">
          <AlertCircle aria-hidden="true" />
          <div className="min-w-0">
            <p>{data.errorMessage ?? t('stayPickers.calendar.loadError')}</p>
            <p>{t('stayPickers.calendar.checkedAtCheckout')}</p>
            <Button type="button" variant="outline" size="sm" className="public-site-outline mt-2" onClick={data.onRetry}>
              {t('stayPickers.calendar.retry')}
            </Button>
          </div>
        </div>
      ) : null}
      {!online && !unverified && !loading ? (
        <p className="stay-cal__notice stay-cal__notice--info" data-testid="stay-calendar-offline">
          <WifiOff aria-hidden="true" />
          <span>{t('stayPickers.calendar.offline')}</span>
        </p>
      ) : null}

      <div onKeyDown={handleKeyDown} onMouseLeave={() => setHover('')} onBlur={handleBlur} className="relative">
        {!scroll && monthList.length > shown ? (
          <div className="stay-cal__nav">
            <button
              type="button"
              className="stay-cal__nav-btn"
              aria-label={t('stayPickers.calendar.previousMonth')}
              disabled={page === 0}
              onClick={() => move(-1)}
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <button
              type="button"
              className="stay-cal__nav-btn"
              aria-label={t('stayPickers.calendar.nextMonth')}
              disabled={page >= maxPage}
              onClick={() => move(1)}
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        ) : null}
        <div className="stay-cal__months">
          {visibleMonths.map((month) => (
            <CalendarMonth
              key={month}
              month={month}
              index={index}
              value={value}
              hover={hover}
              tabStop={tabStop}
              showPrices={showPrices}
              loading={loading}
              locale={locale}
              currency={data.currency}
              titleId={`${uid}-${month}`}
              initials={initials}
              names={names}
              onChoose={choose}
              onHover={setHover}
              register={register}
            />
          ))}
        </div>
      </div>

      <p className="sr-only" aria-live="polite" data-testid="stay-calendar-months">
        {monthsLabel}
      </p>

      <div className="stay-cal__foot">
        <div className="stay-cal__legend" aria-hidden="true">
          <span>
            <i className="stay-cal__key" />
            {t('stayPickers.calendar.legendFree')}
          </span>
          <span>
            <i className="stay-cal__key is-busy" />
            <s>{t('stayPickers.calendar.legendBusy')}</s>
          </span>
          <span>
            <i className="stay-cal__key is-sel" />
            {t('stayPickers.calendar.legendMine')}
          </span>
        </div>
        {value.checkIn ? (
          <button type="button" className="stay-cal__link" onClick={clear} data-testid="stay-calendar-clear">
            {t('stayPickers.calendar.clear')}
          </button>
        ) : null}
      </div>

      <p role="status" aria-live="polite" className="stay-cal__status" data-testid="stay-calendar-status">
        {status}
      </p>
    </div>
  );
}
