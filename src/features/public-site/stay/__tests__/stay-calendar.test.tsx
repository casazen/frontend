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

  it('StayCalendar_TwoClicksBeforeTheParentHasRendered_BuildOnTheFirst', () => {
    // The parent writes the address and the router renders it later: the second click must not start a new stay.
    const onChange = vi.fn();
    render(<StayCalendar value={{ checkIn: '', checkOut: '' }} data={data()} onChange={onChange} />);

    fireEvent.click(day('2026-11-10'));
    fireEvent.click(day('2026-11-13'));

    expect(onChange).toHaveBeenLastCalledWith({ checkIn: '2026-11-10', checkOut: '2026-11-13' });
  });
});
