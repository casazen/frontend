import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { addDays } from '@/lib/stay-dates';
import { StayCalendar } from '../stay-calendar';
import type { CalendarDay, StayRange } from '../stay-calendar-model';
import type { StayCalendarData } from '../use-public-calendar';

/**
 * The calendar of the stay (DB-20), clicked as a guest does: the arrival, then the departure. What it hands to `onChange` is
 * what the checkout will be asked to book, so a taken night inside a stay, or too few nights, must never get through.
 */
const TODAY = '2026-11-02';

function data(overrides: Record<string, Partial<CalendarDay>> = {}): StayCalendarData {
  const days = Array.from({ length: 120 }, (_, offset) => {
    const date = addDays(TODAY, offset);
    return { date, available: true, priceCents: 15000, minNights: 1, ...overrides[date] };
  });
  return { status: 'ready', days, today: TODAY, end: addDays(TODAY, 120), currency: 'EUR', onRetry: () => undefined };
}

function Harness({ calendar, onChange }: { calendar: StayCalendarData; onChange: (value: StayRange) => void }) {
  const [value, setValue] = useState<StayRange>({ checkIn: '', checkOut: '' });
  return (
    <I18nextProvider i18n={i18n}>
      <StayCalendar
        value={value}
        data={calendar}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
    </I18nextProvider>
  );
}

const day = (date: string) => document.querySelector<HTMLElement>(`button[data-date="${date}"]`)!;
const status = () => screen.getByTestId('stay-calendar-status').textContent;

describe('StayCalendar', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('StayCalendar_ArrivalThenDeparture_HandsOverTheRangeAndSaysItsNights', () => {
    const onChange = vi.fn();
    render(<Harness calendar={data()} onChange={onChange} />);

    fireEvent.click(day('2026-11-10'));
    expect(onChange).toHaveBeenLastCalledWith({ checkIn: '2026-11-10', checkOut: '' });
    fireEvent.click(day('2026-11-13'));

    expect(onChange).toHaveBeenLastCalledWith({ checkIn: '2026-11-10', checkOut: '2026-11-13' });
    expect(status()).toContain('3 notti');
  });

  it('StayCalendar_TakenNightInsideTheStay_IsRefusedWithTheReason', () => {
    const onChange = vi.fn();
    render(<Harness calendar={data({ '2026-11-12': { available: false } })} onChange={onChange} />);

    fireEvent.click(day('2026-11-10'));
    fireEvent.click(day('2026-11-14'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(status()).toBe(i18n.t('stayPickers.problem.busyBetween'));
  });

  it('StayCalendar_TakenNightAsTheDayOfDeparture_IsAccepted', () => {
    const onChange = vi.fn();
    render(<Harness calendar={data({ '2026-11-12': { available: false } })} onChange={onChange} />);

    fireEvent.click(day('2026-11-10'));
    fireEvent.click(day('2026-11-12'));

    expect(onChange).toHaveBeenLastCalledWith({ checkIn: '2026-11-10', checkOut: '2026-11-12' });
  });

  it('StayCalendar_FewerNightsThanTheMinimumOfThatArrival_IsRefusedWithTheMinimum', () => {
    const onChange = vi.fn();
    render(<Harness calendar={data({ '2026-11-20': { minNights: 3 } })} onChange={onChange} />);

    fireEvent.click(day('2026-11-20'));
    fireEvent.click(day('2026-11-21'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(status()).toContain('3 notti');
  });

  it('StayCalendar_NightClosedToArrival_IsMarkedWithAnIconAndAnAccessibleNameNotOnlyAColor', () => {
    render(<Harness calendar={data({ '2026-11-10': { closedToArrival: true } })} onChange={vi.fn()} />);

    const closed = day('2026-11-10');
    expect(closed).toHaveAttribute('data-closed-arrival', 'true');
    expect(closed.getAttribute('aria-label')).toContain(i18n.t('stayPickers.day.closedToArrival'));
    expect(closed.getAttribute('aria-label')).toContain('arrivi chiusi');
    expect(closed.querySelector('svg')).not.toBeNull();
    // The legend explains the door, and only because the calendar has a night that carries it.
    expect(screen.getByText(i18n.t('stayPickers.calendar.legendClosedToArrival'))).toBeInTheDocument();

    const open = day('2026-11-11');
    expect(open).not.toHaveAttribute('data-closed-arrival');
    expect(open.getAttribute('aria-label')).not.toContain('arrivi chiusi');
    expect(open.querySelector('svg')).toBeNull();
  });

  it('StayCalendar_NoNightClosedToArrival_ShowsNoDoorAndNoLegendForIt', () => {
    render(<Harness calendar={data()} onChange={vi.fn()} />);

    expect(document.querySelector('[data-closed-arrival]')).toBeNull();
    expect(screen.queryByText(i18n.t('stayPickers.calendar.legendClosedToArrival'))).not.toBeInTheDocument();
  });

  it('StayCalendar_NightClosedToArrivalThatIsTaken_IsOnlySaidTaken', () => {
    render(<Harness calendar={data({ '2026-11-12': { available: false, closedToArrival: true } })} onChange={vi.fn()} />);

    expect(day('2026-11-12')).not.toHaveAttribute('data-closed-arrival');
    expect(day('2026-11-12').getAttribute('aria-label')).toContain(i18n.t('stayPickers.calendar.busyNight'));
  });

  it('StayCalendar_ClickOnANightClosedToArrival_IsRefusedWithTheDayAndNothingIsChosen', () => {
    const onChange = vi.fn();
    render(<Harness calendar={data({ '2026-11-10': { closedToArrival: true } })} onChange={onChange} />);

    fireEvent.click(day('2026-11-10'));

    expect(onChange).not.toHaveBeenCalled();
    expect(status()).toBe('Gli arrivi sono chiusi il 10 novembre: scegli un altro giorno di arrivo.');
  });

  it('StayCalendar_NightClosedToArrivalAsTheDayOfDeparture_IsAccepted', () => {
    const onChange = vi.fn();
    render(<Harness calendar={data({ '2026-11-10': { closedToArrival: true } })} onChange={onChange} />);

    fireEvent.click(day('2026-11-08'));
    fireEvent.click(day('2026-11-10'));

    expect(onChange).toHaveBeenLastCalledWith({ checkIn: '2026-11-08', checkOut: '2026-11-10' });
  });

  it('StayCalendar_DepartureOnADayClosedToDeparture_IsRefusedKeepsTheArrivalAndSaysTheDay', () => {
    const onChange = vi.fn();
    render(<Harness calendar={data({ '2026-11-14': { closedToDeparture: true } })} onChange={onChange} />);

    fireEvent.click(day('2026-11-10'));
    fireEvent.click(day('2026-11-14'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({ checkIn: '2026-11-10', checkOut: '' });
    expect(status()).toBe('Le partenze sono chiuse il 14 novembre: scegli un altro giorno di partenza.');
  });

  it('StayCalendar_StayLongerThanTheMaximumOfItsArrival_IsRefusedWithTheMaximumAndTheLastDayToLeave', () => {
    const onChange = vi.fn();
    render(<Harness calendar={data({ '2026-11-10': { maxNights: 2 } })} onChange={onChange} />);

    fireEvent.click(day('2026-11-10'));
    fireEvent.click(day('2026-11-13'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(status()).toBe('Il soggiorno massimo è di 2 notti: scegli una partenza entro il 12 novembre.');
  });

  it('StayCalendar_ArrivalCloserThanTheMinimumAdvance_IsRefusedWithItsOwnSentence', () => {
    const onChange = vi.fn();
    // Today is the 2nd: the 3rd is one day ahead and its rule asks for three.
    render(<Harness calendar={data({ '2026-11-03': { minAdvanceDays: 3 } })} onChange={onChange} />);

    fireEvent.click(day('2026-11-03'));

    expect(onChange).not.toHaveBeenCalled();
    expect(status()).toBe('Questo arrivo non si può prenotare con questo anticipo: scegli un altro giorno di arrivo.');
  });

  it('StayCalendar_TwoClicksBeforeTheParentHasRendered_BuildOnTheFirst', () => {
    // The parent writes the address and the router renders it later: the second click must not start a new stay.
    const onChange = vi.fn();
    render(<StayCalendar value={{ checkIn: '', checkOut: '' }} data={data()} onChange={onChange} />);

    fireEvent.click(day('2026-11-10'));
    fireEvent.click(day('2026-11-13'));

    expect(onChange).toHaveBeenLastCalledWith({ checkIn: '2026-11-10', checkOut: '2026-11-13' });
  });
});
