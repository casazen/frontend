import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { CalendarDayInfo, CalendarDaysResponse } from '@/types/calendar-days.types';
import type { HostCalendarProperty, HostCalendarResponse } from '@/types/host-calendar.types';
import { toDayLayer } from '../../lib/day-layer';
import { buildTimelineRows } from '../../lib/host-timeline';
import { extendSelection, startSelection } from '../../lib/day-selection';
import { HostTimeline } from '../host-timeline';

const PROPERTY: HostCalendarProperty = {
  id: 'p1', name: 'Casa Mare', city: 'Rimini', rentalMode: 'Short', status: 'Active', minNights: 1, baseRateCents: 10000, weekendSurchargePercent: 0, cleaningFeeCents: 0,
};
const TODAY = '2026-09-12';
const START = '2026-09-10';

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

function calendar(channel: 'Direct' | 'Expedia' | 'Vrbo' | 'TripAdvisor' | 'Agoda' = 'Expedia'): HostCalendarResponse {
  return {
    timezone: 'Europe/Rome', utcOffsetMinutes: 120, today: TODAY, from: START, to: '2026-09-16', propertiesTotal: 1, properties: [PROPERTY],
    items: [{ type: 'Booking', id: 'b-1', propertyId: 'p1', from: '2026-09-14', to: '2026-09-16', status: 'Confirmed', guestName: 'Sofia Marino', channel }],
  };
}

const LAYER_RESPONSE: CalendarDaysResponse = {
  today: TODAY,
  properties: [
    {
      propertyId: 'p1',
      timezone: 'Europe/Rome',
      currency: 'EUR',
      mirrored: false,
      days: [
        day('2026-09-10'),
        day('2026-09-11'),
        day('2026-09-12', { minNights: 2, hasRule: true, priceSource: 'DayRule' }),
        day('2026-09-13', { closedToArrival: true, priceCents: 12050 }),
        day('2026-09-14', { taken: true }),
        day('2026-09-15', { taken: true }),
        day('2026-09-16', { closedToDeparture: true }),
      ],
    },
  ],
};

const DAYS = ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16'];

function renderTimeline(props: Partial<Parameters<typeof HostTimeline>[0]> = {}, channel?: Parameters<typeof calendar>[0]) {
  return render(
    <MemoryRouter>
      <HostTimeline
        rows={buildTimelineRows(calendar(channel), START, 7, TODAY)}
        days={DAYS}
        today={TODAY}
        focusId=""
        busy={false}
        onOpen={vi.fn()}
        dayLayer={toDayLayer(LAYER_RESPONSE)}
        {...props}
      />
    </MemoryRouter>,
  );
}

const cellOf = (date: string) => document.querySelector<HTMLElement>(`[data-testid="timeline-cell"][data-date="${date}"]`)!;
const text = (element: HTMLElement) => (element.textContent ?? '').replace(/\s/g, ' ');

describe('the Timeline with the day layer (E08/F05/US03/T01)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });
  afterEach(() => cleanup());

  it('HostTimeline_FreeFutureNights_ShowThePriceAndFromTwoNightsTheMinimum', () => {
    renderTimeline();

    expect(text(within(cellOf('2026-09-12')).getByTestId('day-cell-price'))).toBe('120 €');
    expect(within(cellOf('2026-09-12')).getByTestId('day-cell-min')).toHaveTextContent('min 2');
    // One night is no minimum worth saying.
    expect(within(cellOf('2026-09-13')).queryByTestId('day-cell-min')).not.toBeInTheDocument();
    expect(text(within(cellOf('2026-09-13')).getByTestId('day-cell-price'))).toBe('120,50 €');
  });

  it('HostTimeline_PastDaysAndTakenNights_ShowNoPrice', () => {
    renderTimeline();

    expect(within(cellOf('2026-09-10')).queryByTestId('day-cell')).not.toBeInTheDocument();
    expect(within(cellOf('2026-09-11')).queryByTestId('day-cell')).not.toBeInTheDocument();
    // A taken night shows its booking (the bar) only.
    expect(within(cellOf('2026-09-14')).queryByTestId('day-cell')).not.toBeInTheDocument();
    expect(screen.getByTestId('timeline-bar')).toHaveAttribute('data-item-id', 'b-1');
  });

  it('HostTimeline_ClosedArrivalAndDeparture_AreAnIconAndAName_AndARuleHasItsMark', () => {
    renderTimeline();

    const arrival = within(cellOf('2026-09-13')).getByTestId('day-cell-closed-arrival');
    expect(arrival).toHaveTextContent('no arrivi');
    expect(arrival.querySelector('svg')).not.toBeNull();
    const departure = within(cellOf('2026-09-16')).getByTestId('day-cell-closed-departure');
    expect(departure).toHaveTextContent('no partenze');
    expect(departure.querySelector('svg')).not.toBeNull();
    expect(within(cellOf('2026-09-12')).getByTestId('day-cell-rule')).toHaveAttribute('title', 'regola propria');
    expect(within(cellOf('2026-09-13')).queryByTestId('day-cell-rule')).not.toBeInTheDocument();
  });

  it('HostTimeline_AtTheZoomOfAMonth_ShowsThePriceOnly', () => {
    const month = Array.from({ length: 30 }, (_, index) => `2026-09-${String(1 + index).padStart(2, '0')}`);
    const response: CalendarDaysResponse = {
      today: TODAY,
      properties: [{ ...LAYER_RESPONSE.properties[0], days: month.map((date) => day(date, { minNights: 3 })) }],
    };
    render(
      <MemoryRouter>
        <HostTimeline
          rows={buildTimelineRows({ ...calendar(), items: [], from: '2026-09-01', to: '2026-09-30' }, '2026-09-01', 30, TODAY)}
          days={month}
          today={TODAY}
          focusId=""
          busy={false}
          onOpen={vi.fn()}
          dayLayer={toDayLayer(response)}
        />
      </MemoryRouter>,
    );

    expect(within(cellOf('2026-09-20')).getByTestId('day-cell-price')).toBeInTheDocument();
    expect(within(cellOf('2026-09-20')).queryByTestId('day-cell-min')).not.toBeInTheDocument();
  });

  it('HostTimeline_WithoutTheDayLayer_IsWhatItAlwaysWas', () => {
    renderTimeline({ dayLayer: undefined });

    expect(screen.queryByTestId('day-cell')).not.toBeInTheDocument();
    // The cells are decoration: nothing for a screen reader, no control.
    expect(screen.queryByRole('gridcell')).not.toBeInTheDocument();
    expect(screen.getByTestId('timeline-cells')).toHaveAttribute('aria-hidden', 'true');
  });

  it.each(['Expedia', 'Vrbo', 'TripAdvisor', 'Agoda'] as const)('HostTimeline_BookingFrom_%s_ShowsItsOwnIconAndName', (channel) => {
    renderTimeline({}, channel);

    const bar = screen.getByTestId('timeline-bar');
    const name = channel === 'TripAdvisor' ? 'Tripadvisor' : channel;
    expect(bar).toHaveTextContent(name);
    expect(bar.querySelector('.host-timeline-item__sub svg')).not.toBeNull();
    expect(bar).toHaveAttribute('aria-label', expect.stringContaining(name));
  });
});

describe('the days of the Timeline as controls (E08/F05/US03/T02)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });
  afterEach(() => cleanup());

  it('HostTimeline_DaysThatCanBeSelected_AreGridCellsNamedInWords', () => {
    renderTimeline({ onPressDay: vi.fn() });

    expect(screen.getByRole('grid', { name: 'Giorni di Casa Mare' })).toBeInTheDocument();
    const cell = cellOf('2026-09-13');
    expect(cell).toHaveAttribute('role', 'gridcell');
    expect((cell.getAttribute('aria-label') ?? '').replace(/\s/g, ' ')).toBe('13 settembre, Casa Mare, 120,50 euro, arrivi chiusi');
    expect(cellOf('2026-09-10')).toHaveAttribute('aria-label', '10 settembre, Casa Mare, giorno passato');
    expect(cellOf('2026-09-14')).toHaveAttribute('aria-label', '14 settembre, Casa Mare, notte occupata');
  });

  it('HostTimeline_AClickOrEnterOrSpace_PressesTheDay_AndShiftExtends', () => {
    const onPressDay = vi.fn();
    renderTimeline({ onPressDay });

    fireEvent.click(cellOf('2026-09-12'));
    expect(onPressDay).toHaveBeenLastCalledWith('p1', '2026-09-12', false);
    fireEvent.click(cellOf('2026-09-15'), { shiftKey: true });
    expect(onPressDay).toHaveBeenLastCalledWith('p1', '2026-09-15', true);
    fireEvent.keyDown(cellOf('2026-09-13'), { key: 'Enter' });
    expect(onPressDay).toHaveBeenLastCalledWith('p1', '2026-09-13', false);
    fireEvent.keyDown(cellOf('2026-09-13'), { key: ' ' });
    expect(onPressDay).toHaveBeenCalledTimes(4);
  });

  it('HostTimeline_Arrows_MoveFocusAndShiftArrowExtends_EscapeClears', () => {
    const onPressDay = vi.fn();
    const onClearSelection = vi.fn();
    renderTimeline({ onPressDay, onClearSelection, selection: startSelection('p1', '2026-09-12') });

    cellOf('2026-09-12').focus();
    fireEvent.keyDown(cellOf('2026-09-12'), { key: 'ArrowRight' });
    expect(cellOf('2026-09-13')).toHaveFocus();
    // Plain arrows only move; Shift plus arrow extends the selection of the row.
    expect(onPressDay).not.toHaveBeenCalled();
    fireEvent.keyDown(cellOf('2026-09-13'), { key: 'ArrowRight', shiftKey: true });
    expect(onPressDay).toHaveBeenCalledWith('p1', '2026-09-14', true);
    expect(cellOf('2026-09-14')).toHaveFocus();
    fireEvent.keyDown(cellOf('2026-09-14'), { key: 'Escape' });
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('HostTimeline_OnlyOneDayTakesTheTabKey_AndTheSelectedDaysAreMarked', () => {
    const selection = extendSelection(startSelection('p1', '2026-09-12'), 'p1', '2026-09-13');
    renderTimeline({ onPressDay: vi.fn(), selection });

    const cells = screen.getAllByRole('gridcell');
    expect(cells.filter((cell) => cell.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(cellOf('2026-09-12')).toHaveAttribute('tabindex', '0');
    expect(cellOf('2026-09-12')).toHaveAttribute('aria-selected', 'true');
    expect(cellOf('2026-09-13')).toHaveAttribute('aria-selected', 'true');
    expect(cellOf('2026-09-14')).toHaveAttribute('aria-selected', 'false');
  });
});
