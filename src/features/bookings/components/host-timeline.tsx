import { useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Briefcase, CalendarX2, Sparkles, Wrench } from 'lucide-react';
import { propertyPath } from '@/features/properties/properties-paths';
import { getServiceRequestStatusLabel } from '@/lib/i18n-labels';
import { formatStayDate } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import type { HostCalendarItem } from '@/types/host-calendar.types';
import { calendarKindInfo } from '../lib/calendar-kinds';
import { useUnreadMessagesOf } from '../lib/unread-messages-context';
import { UnreadMessagesBadge } from '@/components/shared/unread-messages-badge';
import { dayLabel, showsPrice, type DayLayer } from '../lib/day-layer';
import { isDaySelected, type DaySelection } from '../lib/day-selection';
import {
  channelLabel,
  isWeekendDay,
  itemRangeText,
  serviceItemTitle,
  serviceTimeText,
  stayItemTitle,
  type TimelineBar,
  type TimelineChip,
  type TimelineRow,
} from '../lib/host-timeline';
import { CHANNEL_ICONS, channelOf } from '../lib/ota-stay';
import { DayCellContent } from './day-cell-content';
import './host-calendar.css';
import './host-timeline.css';

/** A share of the area of the days, in percent to three decimals: bars and columns line up without a pixel of drift. */
const percent = (days: number, total: number) => Math.round((days / total) * 100_000) / 1000;

const SERVICE_ICONS = { Cleaning: Sparkles, Maintenance: Wrench, Other: Briefcase } as const;

type OpenItem = (item: HostCalendarItem, opener: HTMLElement) => void;

interface BarProps {
  bar: TimelineBar;
  propertyName: string;
  days: number;
  focused: boolean;
  onOpen: OpenItem;
}

/**
 * A stay, a portal's reservation or a block as a bar over its nights. Its kind is told by color, shape and icon; where a stay
 * comes from by the icon and the name of the channel; a night taken twice by a red frame and a flag. The label of the button
 * says all of it in words, so a screen reader gets what the eyes get.
 */
function StayBar({ bar, propertyName, days, focused, onOpen }: BarProps) {
  const { t, i18n } = useTranslation();
  const { item, span, lane, kind, conflict } = bar;
  const info = calendarKindInfo(kind);
  const Icon = conflict ? CalendarX2 : info.icon;
  const title = stayItemTitle(item, t);
  const unread = useUnreadMessagesOf(item.type === 'Booking' ? item.id : null);
  const channel = item.type === 'Booking' ? channelLabel(item.channel, t) : '';
  const ChannelIcon = item.type === 'Booking' && item.channel ? CHANNEL_ICONS[channelOf(item.channel)] : null;
  const label = [title, propertyName, itemRangeText(item, t, i18n.language), t(info.labelKey), channel, conflict ? t('booking.calendar.timeline.conflict') : '', unread > 0 ? t('booking.messages.unread', { count: unread }) : '']
    .filter(Boolean)
    .join(', ');
  const style = { left: `${percent(span.index, days)}%`, width: `${percent(span.length, days)}%`, '--lane': lane } as CSSProperties;

  return (
    <li style={style}>
      <button
        type="button"
        className={cn('host-timeline-item', `host-calendar-event--${kind}`)}
        data-testid="timeline-bar"
        data-kind={kind}
        data-item-id={item.id}
        data-conflict={conflict || undefined}
        data-focus={focused || undefined}
        data-clipped-start={span.clippedStart || undefined}
        data-clipped-end={span.clippedEnd || undefined}
        aria-label={label}
        title={label}
        onClick={(event) => onOpen(item, event.currentTarget)}
      >
        <Icon className={cn('host-timeline-item__icon', conflict && 'host-timeline-item__flag')} aria-hidden="true" />
        <span className="host-timeline-item__title">{title}</span>
        <UnreadMessagesBadge count={unread} />
        {channel ? (
          <span className="host-timeline-item__sub">
            {ChannelIcon ? <ChannelIcon aria-hidden="true" /> : null}
            {channel}
          </span>
        ) : null}
      </button>
    </li>
  );
}

interface ChipProps {
  chip: TimelineChip;
  propertyName: string;
  days: number;
  focused: boolean;
  onOpen: OpenItem;
}

/** An intervention of a supplier as a mark on the day of the work; the dashed edge is a request nobody has taken yet. */
function ServiceChip({ chip, propertyName, days, focused, onOpen }: ChipProps) {
  const { t, i18n } = useTranslation();
  const { item, index, slot } = chip;
  const Icon = SERVICE_ICONS[item.serviceKind ?? 'Other'];
  const title = serviceItemTitle(item, t);
  const when = serviceTimeText(item, i18n.language) || formatStayDate(item.from, i18n.language, { day: 'numeric', month: 'long' });
  const label = [title, propertyName, item.supplierName, getServiceRequestStatusLabel(item.serviceStatus ?? '', t), when].filter(Boolean).join(', ');
  const style = { left: `${percent(index, days)}%`, width: `${percent(1, days)}%`, '--slot': slot } as CSSProperties;

  return (
    <li style={style}>
      <button
        type="button"
        className="host-timeline-item host-timeline-chip host-calendar-event--service"
        data-testid="timeline-chip"
        data-item-id={item.id}
        data-status={item.serviceStatus}
        data-focus={focused || undefined}
        aria-label={label}
        title={label}
        onClick={(event) => onOpen(item, event.currentTarget)}
      >
        <Icon className="host-timeline-item__icon" aria-hidden="true" />
        <span className="host-timeline-item__title">{title}</span>
      </button>
    </li>
  );
}

interface HostTimelineProps {
  rows: readonly TimelineRow[];
  /** The days of the window, the first one included, one column each. */
  days: readonly string[];
  today: string;
  /** The id of the item the address points to (`?focus=`); empty for none. */
  focusId: string;
  /** The window is moving: what is on screen is still the last one. */
  busy: boolean;
  onOpen: OpenItem;
  /** The price and the rules of every day (E08/F05/US03/T01), when the caller may read them; without it the Timeline is what it always was. */
  dayLayer?: DayLayer;
  /** The days selected (E08/F05/US03/T02). */
  selection?: DaySelection | null;
  /** A press on a day (a click, Enter or Space; with `shift` it extends the selection). Without it the days are not controls: they cannot be selected. */
  onPressDay?: (propertyId: string, day: string, shift: boolean, origin?: string) => void;
  /** Escape on a day: nothing is selected. */
  onClearSelection?: () => void;
}

/**
 * The Timeline of the host calendar (SR-02): every property is a row with its name on the left, every day a column; the stays and
 * the blocks are bars over their nights (on two lanes when they overlap) and the interventions marks under them. It is only to
 * read: a click or Enter on an entry opens its drawer. The strip scrolls sideways inside its own box, the names stay in place.
 * Its structure is a list of buttons per property, in the order of the days, so that Tab and a screen reader go through it
 * property by property.
 */
export function HostTimeline({ rows, days, today, focusId, busy, onOpen, dayLayer, selection = null, onPressDay, onClearSelection }: HostTimelineProps) {
  const { t, i18n } = useTranslation();
  const style = { '--n': days.length } as CSSProperties;
  // The days are controls only where they can be selected; the one that takes the Tab key is the last the person was on, else today, else the first.
  const selectable = onPressDay !== undefined;
  // The name in words of every day of every row that has one, worked out once for the rows, the days and the layer on screen: moving the focus from day to day draws the Timeline again
  // (it holds the day that takes the Tab key), and must not work out fifteen hundred names each time.
  const labels = useMemo(() => {
    const names = new Map<string, string>();
    for (const { property } of rows) {
      const layer = dayLayer?.get(property.id);
      if (!selectable && !layer) continue;
      for (const day of days) {
        names.set(`${property.id}|${day}`, dayLabel({ date: day, propertyName: property.name, today, language: i18n.language, currency: layer?.currency, info: layer?.days.get(day) }, t));
      }
    }
    return names;
  }, [rows, days, dayLayer, today, i18n.language, t, selectable]);
  const [active, setActive] = useState<{ propertyId: string; day: string } | null>(null);
  const firstRow = rows[0]?.property.id;
  const stillThere = active !== null && rows.some((row) => row.property.id === active.propertyId) && days.includes(active.day);
  const tabbable = stillThere ? active : firstRow ? { propertyId: firstRow, day: days.includes(today) ? today : (days[0] ?? '') } : null;

  /** Moves the focus to a day of a row: the controls are found by what they say they are, not by their place in the page. */
  const focusDay = (root: HTMLElement, propertyId: string, day: string) => {
    const key = `${propertyId}|${day}`;
    Array.from(root.querySelectorAll<HTMLElement>('[data-cell]'))
      .find((cell) => cell.dataset.cell === key)
      ?.focus();
  };

  const handleCellKeyDown = (event: KeyboardEvent<HTMLElement>, propertyId: string, day: string) => {
    if (!onPressDay) return;
    const root = event.currentTarget.closest<HTMLElement>('[data-testid="host-timeline"]');
    if (!root) return;
    const index = days.indexOf(day);
    const rowIndex = rows.findIndex((row) => row.property.id === propertyId);
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowRight': {
        event.preventDefault();
        const target = days[index + (event.key === 'ArrowLeft' ? -1 : 1)];
        if (!target) return;
        // Shift plus arrow extends the selection of the row from where it was started (or from this day).
        if (event.shiftKey) onPressDay(propertyId, target, true, day);
        focusDay(root, propertyId, target);
        return;
      }
      case 'ArrowUp':
      case 'ArrowDown': {
        event.preventDefault();
        const other = rows[rowIndex + (event.key === 'ArrowUp' ? -1 : 1)];
        if (other) focusDay(root, other.property.id, day);
        return;
      }
      case 'Home':
      case 'End': {
        event.preventDefault();
        const target = event.key === 'Home' ? days[0] : days[days.length - 1];
        if (target) focusDay(root, propertyId, target);
        return;
      }
      case 'Enter':
      case ' ':
        event.preventDefault();
        onPressDay(propertyId, day, event.shiftKey);
        return;
      case 'Escape':
        if (selection) {
          event.preventDefault();
          onClearSelection?.();
        }
        return;
      default:
    }
  };

  return (
    <div className="host-timeline" style={style} data-zoom={days.length} data-testid="host-timeline" aria-busy={busy}>
      <div className="host-timeline__scroll" role="region" aria-label={t('booking.calendar.timeline.label')}>
        <div className="host-timeline__grid">
          <div className="host-timeline__head" aria-hidden="true">
            <div className="host-timeline__corner">{t('booking.calendar.timeline.corner')}</div>
            <div className="host-timeline__days">
              {days.map((day, index) => (
                <div key={day} className={cn('host-timeline__day', day === today && 'is-today')}>
                  {index === 0 || day.endsWith('-01') ? (
                    <span className="host-timeline__month">{formatStayDate(day, i18n.language, { month: 'short' })}</span>
                  ) : null}
                  <span>{formatStayDate(day, i18n.language, { weekday: 'short' })}</span>
                  <b>{Number(day.slice(8, 10))}</b>
                </div>
              ))}
            </div>
          </div>

          {rows.map(({ property, bars, lanes, chips, slots }) => {
            const paused = property.status === 'Paused';
            const rowStyle = { '--lanes': lanes, '--slots': slots } as CSSProperties;
            // The days of a row are told to a screen reader whenever they say something: they can be selected (a control named in words) or the row has its day layer (a cell named in
            // words, no control: a caller who may read the prices but not change them still hears what the eyes read). Without either they are decoration.
            const rowLayer = dayLayer?.get(property.id);
            const described = selectable || rowLayer !== undefined;
            return (
              <div
                key={property.id}
                role="group"
                aria-label={property.name}
                className="host-timeline__row"
                style={rowStyle}
                data-testid="timeline-row"
                data-property-id={property.id}
                data-paused={paused || undefined}
              >
                <div className="host-timeline__label">
                  <Link to={propertyPath(property.id)} className="host-timeline__name" title={property.name}>
                    {property.name}
                  </Link>
                  <span className="host-timeline__city">
                    {[property.city, paused ? t('booking.calendar.timeline.paused') : ''].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <div className="host-timeline__track">
                  <div
                    className="host-timeline__cells"
                    role={described ? 'grid' : undefined}
                    aria-label={described ? t('booking.calendar.day.gridLabel', { property: property.name }) : undefined}
                    aria-hidden={described ? undefined : true}
                    data-testid="timeline-cells"
                  >
                    {/* A row of the grid that takes no box of its own: the cells keep the columns of the days. */}
                    <div role={described ? 'row' : undefined} className="host-timeline__cells-row">
                      {days.map((day) => {
                        const layer = rowLayer;
                        const info = layer?.days.get(day);
                        const classes = cn(
                          'host-timeline__cell',
                          isWeekendDay(day) && 'is-weekend',
                          day < today && 'is-past',
                          day === today && 'is-today',
                          isDaySelected(selection, property.id, day) && 'is-selected',
                        );
                        const content = layer && showsPrice(info, day, today) ? <DayCellContent info={info} currency={layer.currency} zoom={days.length} /> : null;
                        if (!selectable) {
                          return described ? (
                            <div
                              key={day}
                              role="gridcell"
                              className={classes}
                              data-testid="timeline-cell"
                              data-date={day}
                              aria-label={labels.get(`${property.id}|${day}`)}
                            >
                              {content}
                            </div>
                          ) : (
                            <span key={day} className={classes} data-testid="timeline-cell" data-date={day}>
                              {content}
                            </span>
                          );
                        }
                        const isTabbable = tabbable?.propertyId === property.id && tabbable.day === day;
                        return (
                          <div
                            key={day}
                            role="gridcell"
                            tabIndex={isTabbable ? 0 : -1}
                            className={classes}
                            data-testid="timeline-cell"
                            data-cell={`${property.id}|${day}`}
                            data-date={day}
                            aria-selected={isDaySelected(selection, property.id, day)}
                            aria-label={labels.get(`${property.id}|${day}`)}
                            onFocus={() => setActive({ propertyId: property.id, day })}
                            onClick={(event) => onPressDay(property.id, day, event.shiftKey)}
                            onKeyDown={(event) => handleCellKeyDown(event, property.id, day)}
                          >
                            {content}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {bars.length > 0 ? (
                    <ul className="host-timeline__bars">
                      {bars.map((bar) => (
                        <StayBar
                          key={bar.item.id}
                          bar={bar}
                          propertyName={property.name}
                          days={days.length}
                          focused={bar.item.id === focusId}
                          onOpen={onOpen}
                        />
                      ))}
                    </ul>
                  ) : null}
                  {chips.length > 0 ? (
                    <ul className="host-timeline__chips">
                      {chips.map((chip) => (
                        <ServiceChip
                          key={chip.item.id}
                          chip={chip}
                          propertyName={property.name}
                          days={days.length}
                          focused={chip.item.id === focusId}
                          onOpen={onOpen}
                        />
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
