import { LogIn, LogOut, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CalendarDayInfo } from '@/types/calendar-days.types';
import { dayCellText } from '../lib/day-layer';
import './host-calendar.css';

interface DayCellContentProps {
  info: CalendarDayInfo;
  currency: string;
  /** How many days the Timeline shows (a month is too narrow for more than the price); the month, the week and the day pass 1. */
  zoom: number;
}

/**
 * What a free night of the future shows in its cell (E08/F05/US03/T01): the price (whole units without decimals when the cents are zero) and, from two nights, the minimum
 * stay; a closed arrival and a closed departure by an icon and a short name each, and a mark when the night has a rule of its own. The Timeline and the month, the week and the
 * day draw it the same, so the host reads the same text wherever the calendar is.
 */
export function DayCellContent({ info, currency, zoom }: DayCellContentProps) {
  const { t, i18n } = useTranslation();
  const text = dayCellText(info, currency, i18n.language, zoom);

  return (
    <span className="day-cell" data-testid="day-cell">
      <span className="day-cell__price" title={t('booking.calendar.day.price', { price: text.price })} data-testid="day-cell-price">
        {text.price}
      </span>
      {text.minNights ? (
        <span className="day-cell__min" data-testid="day-cell-min">
          {t('booking.calendar.day.minShort', { count: text.minNights })}
        </span>
      ) : null}
      {info.closedToArrival ? (
        <span className="day-cell__flag" title={t('booking.calendar.day.closedToArrival')} data-testid="day-cell-closed-arrival">
          <LogIn aria-hidden="true" />
          <span className="day-cell__flag-name">{t('booking.calendar.day.closedToArrivalShort')}</span>
        </span>
      ) : null}
      {info.closedToDeparture ? (
        <span className="day-cell__flag" title={t('booking.calendar.day.closedToDeparture')} data-testid="day-cell-closed-departure">
          <LogOut aria-hidden="true" />
          <span className="day-cell__flag-name">{t('booking.calendar.day.closedToDepartureShort')}</span>
        </span>
      ) : null}
      {info.hasRule ? (
        <span className="day-cell__rule" title={t('booking.calendar.day.hasRule')} data-testid="day-cell-rule">
          <SlidersHorizontal aria-hidden="true" />
        </span>
      ) : null}
    </span>
  );
}
