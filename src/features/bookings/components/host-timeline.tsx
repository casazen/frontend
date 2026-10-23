import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Briefcase, Building2, CalendarX2, Globe, House, Link2, Pencil, Sparkles, Wrench, type LucideIcon } from 'lucide-react';
import { propertyPath } from '@/features/properties/properties-paths';
import { getServiceRequestStatusLabel } from '@/lib/i18n-labels';
import { formatStayDate } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import type { HostCalendarItem, HostCalendarItemChannel } from '@/types/host-calendar.types';
import { calendarKindInfo } from '../lib/calendar-kinds';
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
import './host-calendar.css';
import './host-timeline.css';

/** A share of the area of the days, in percent to three decimals: bars and columns line up without a pixel of drift. */
const percent = (days: number, total: number) => Math.round((days / total) * 100_000) / 1000;

const CHANNEL_ICONS: Record<HostCalendarItemChannel, LucideIcon> = {
  Direct: Globe,
  Manual: Pencil,
  Airbnb: House,
  BookingCom: Building2,
  Other: Link2,
};

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
  const channel = item.type === 'Booking' ? channelLabel(item.channel, t) : '';
  const ChannelIcon = item.type === 'Booking' && item.channel ? CHANNEL_ICONS[item.channel] : null;
  const label = [title, propertyName, itemRangeText(item, t, i18n.language), t(info.labelKey), channel, conflict ? t('booking.calendar.timeline.conflict') : '']
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
}

/**
 * The Timeline of the host calendar (SR-02): every property is a row with its name on the left, every day a column; the stays and
 * the blocks are bars over their nights (on two lanes when they overlap) and the interventions marks under them. It is only to
 * read: a click or Enter on an entry opens its drawer. The strip scrolls sideways inside its own box, the names stay in place.
 * Its structure is a list of buttons per property, in the order of the days, so that Tab and a screen reader go through it
 * property by property.
 */
export function HostTimeline({ rows, days, today, focusId, busy, onOpen }: HostTimelineProps) {
  const { t, i18n } = useTranslation();
  const style = { '--n': days.length } as CSSProperties;

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
                  <div className="host-timeline__cells" aria-hidden="true">
                    {days.map((day) => (
                      <span
                        key={day}
                        className={cn(
                          'host-timeline__cell',
                          isWeekendDay(day) && 'is-weekend',
                          day < today && 'is-past',
                          day === today && 'is-today',
                        )}
                      />
                    ))}
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
