import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import i18n from '@/i18n/config';
import { freezeClock } from '@/test/clock';
import type { CalendarDayInfo, CalendarDaysResponse } from '@/types/calendar-days.types';
import { toDayLayer } from '../../lib/day-layer';
import { extendSelection, startSelection } from '../../lib/day-selection';
import type { HostCalendarEvent } from '../../lib/host-calendar';
import { BookingCalendar } from '../booking-calendar';

const day = (date: string, changes: Partial<CalendarDayInfo> = {}): CalendarDayInfo => ({
  date,
  priceCents: 12000,
  priceSource: 'Base',
  minNights: 1,
  closedToArrival: false,
  closedToDeparture: false,
  hasRule: false,
  taken: false,
  ...changes,
});

const RESPONSE: CalendarDaysResponse = {
  today: '2026-09-12',
  properties: [
    {
      propertyId: 'p1',
      timezone: 'Europe/Rome',
      currency: 'EUR',
      mirrored: true,
      days: [
        day('2026-09-10'),
        day('2026-09-12', { minNights: 2, hasRule: true }),
        day('2026-09-13', { closedToArrival: true, priceCents: 12050 }),
        day('2026-09-14', { taken: true }),
        day('2026-09-15', { closedToDeparture: true }),
      ],
    },
  ],
};

const LAYER = toDayLayer(RESPONSE)?.get('p1');
const PROPERTY = { id: 'p1', name: 'Casa Mare' };

function bookingEvent(source: string | undefined): HostCalendarEvent {
  return {
    id: 'b-1',
    kind: 'booking',
    status: 'Confirmed',
    guestName: 'Sofia Marino',
    source,
    otaReviewReason: null,
    arrival: '2026-09-14',
    departure: '2026-09-16',
    nights: 2,
    start: new Date(2026, 8, 14),
    end: new Date(2026, 8, 16),
    allDay: true,
  };
}

function renderMonth(props: Partial<Parameters<typeof BookingCalendar>[0]> = {}) {
  return render(<BookingCalendar events={[]} date="2026-09-12" view="month" onNavigate={vi.fn()} onView={vi.fn()} property={PROPERTY} dayLayer={LAYER} {...props} />);
}

const cellOf = (date: string) => document.querySelector<HTMLElement>(`[data-day-cell="${date}"]`)?.closest('.rbc-day-bg') as HTMLElement;
const text = (element: HTMLElement | null) => (element?.textContent ?? '').replace(/\s/g, ' ');

describe('the month of the host calendar with the day layer (E08/F05/US03/T01, T02)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    freezeClock('2026-09-12T10:00:00Z');
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('BookingCalendar_MonthCells_ShowTheSameTextAsTheTimeline', () => {
    renderMonth({ onPressDay: vi.fn() });

    expect(text(within(cellOf('2026-09-12')).getByTestId('day-cell-price'))).toBe('120 €');
    expect(within(cellOf('2026-09-12')).getByTestId('day-cell-min')).toHaveTextContent('min 2');
    expect(within(cellOf('2026-09-12')).getByTestId('day-cell-rule')).toBeInTheDocument();
    expect(text(within(cellOf('2026-09-13')).getByTestId('day-cell-price'))).toBe('120,50 €');
    expect(within(cellOf('2026-09-13')).getByTestId('day-cell-closed-arrival')).toHaveTextContent('no arrivi');
    expect(within(cellOf('2026-09-15')).getByTestId('day-cell-closed-departure')).toHaveTextContent('no partenze');
    // A taken night and a past day show no price.
    expect(within(cellOf('2026-09-14')).queryByTestId('day-cell')).not.toBeInTheDocument();
    expect(within(cellOf('2026-09-10')).queryByTestId('day-cell')).not.toBeInTheDocument();
    expect(cellOf('2026-09-10')).toHaveClass('host-calendar-past');
  });

  it('BookingCalendar_WithoutTheDayLayerOrTheSelection_IsWhatItAlwaysWas', () => {
    renderMonth({ dayLayer: undefined });

    expect(screen.queryByTestId('day-cell')).not.toBeInTheDocument();
    expect(document.querySelector('[data-day-cell]')).toBeNull();
  });

  it('BookingCalendar_DayButtons_AreNamedInWordsAndOneTakesTheTabKey', () => {
    renderMonth({ onPressDay: vi.fn() });

    const buttons = Array.from(document.querySelectorAll<HTMLElement>('[data-day-cell]'));
    expect(buttons.filter((button) => button.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(document.querySelector('[data-day-cell="2026-09-12"]')).toHaveAttribute('tabindex', '0');
    expect((document.querySelector('[data-day-cell="2026-09-13"]')?.getAttribute('aria-label') ?? '').replace(/\s/g, ' ')).toBe('13 settembre, Casa Mare, 120,50 euro, arrivi chiusi');
  });

  it('BookingCalendar_Keyboard_EnterPressesTheDay_ArrowsMove_ShiftArrowExtends_EscapeClears', () => {
    const onPressDay = vi.fn();
    const onClearSelection = vi.fn();
    renderMonth({ onPressDay, onClearSelection, selection: startSelection('p1', '2026-09-12') });

    const button = (date: string) => document.querySelector<HTMLElement>(`[data-day-cell="${date}"]`)!;
    button('2026-09-12').focus();
    // Enter and Space make a click with no position: that is the keyboard's press (a mouse click is the library's).
    fireEvent.click(button('2026-09-12'), { detail: 0 });
    expect(onPressDay).toHaveBeenLastCalledWith('p1', '2026-09-12', false);
    fireEvent.click(button('2026-09-12'), { detail: 1 });
    expect(onPressDay).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(button('2026-09-12'), { key: 'ArrowRight' });
    expect(button('2026-09-13')).toHaveFocus();
    fireEvent.keyDown(button('2026-09-13'), { key: 'ArrowRight', shiftKey: true });
    expect(onPressDay).toHaveBeenLastCalledWith('p1', '2026-09-14', true, '2026-09-13');
    // Down is a week on.
    fireEvent.keyDown(button('2026-09-14'), { key: 'ArrowDown' });
    expect(button('2026-09-21')).toHaveFocus();
    fireEvent.keyDown(button('2026-09-21'), { key: 'Escape' });
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('BookingCalendar_SelectedDays_AreMarked', () => {
    renderMonth({ onPressDay: vi.fn(), selection: extendSelection(startSelection('p1', '2026-09-12'), 'p1', '2026-09-13') });

    expect(cellOf('2026-09-12')).toHaveClass('is-selected');
    expect(cellOf('2026-09-13')).toHaveClass('is-selected');
    expect(cellOf('2026-09-15')).not.toHaveClass('is-selected');
  });

  it.each([
    ['Expedia', 'Expedia'],
    ['Vrbo', 'Vrbo'],
    ['TripAdvisor', 'Tripadvisor'],
    ['Agoda', 'Agoda'],
    ['Direct', 'Sito diretto'],
  ])('BookingCalendar_MonthEventFrom_%s_DrawsItsChannelIconAndName', (source, name) => {
    renderMonth({ events: [bookingEvent(source)], dayLayer: undefined });

    const channel = screen.getAllByTestId('calendar-event-channel')[0];
    expect(channel).toHaveTextContent(name);
    expect(channel.querySelector('svg')).not.toBeNull();
    // And in the tooltip of the entry.
    expect(screen.getAllByTitle(new RegExp(name)).length).toBeGreaterThan(0);
  });

  it('BookingCalendar_MonthEventWithoutASource_DrawsNoChannel', () => {
    renderMonth({ events: [bookingEvent(undefined)], dayLayer: undefined });

    expect(screen.queryByTestId('calendar-event-channel')).not.toBeInTheDocument();
  });
});
