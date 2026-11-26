import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { addDays } from '@/lib/stay-dates';
import { StayCalendar } from '../stay-calendar';
import type { StayRange } from '../stay-calendar-model';
import type { StayCalendarData } from '../use-public-calendar';

/**
 * CHF-MONEY, the calendar of the stay: the price of each night, the label of the day and the total of the stay are written in the currency the calendar says
 * (francs for a home in Switzerland). A calendar whose data says none (no currency, or a code that is not one) still draws and still can be chosen on: the prices
 * are written with no symbol and the phrase that says the currency is not available, never a euro that nobody said, and nothing throws.
 */
const TODAY = '2026-11-02';

function data(currency: string | null | undefined, overrides: Partial<StayCalendarData> = {}): StayCalendarData {
  const days = Array.from({ length: 120 }, (_, offset) => ({ date: addDays(TODAY, offset), available: true, priceCents: 15000, minNights: 1 }));
  // `currency` is a text in the answer of the server: what these tests give it is what a malformed answer would carry.
  return { status: 'ready', days, today: TODAY, end: addDays(TODAY, 120), currency: currency as string | null, onRetry: () => undefined, ...overrides };
}

function Harness({ calendar }: { calendar: StayCalendarData }) {
  const [value, setValue] = useState<StayRange>({ checkIn: '', checkOut: '' });
  return (
    <I18nextProvider i18n={i18n}>
      <StayCalendar value={value} data={calendar} onChange={setValue} />
    </I18nextProvider>
  );
}

const day = (date: string) => document.querySelector<HTMLElement>(`button[data-date="${date}"]`)!;
const price = (date: string) => day(date).querySelector('.stay-cal__p')?.textContent;
const status = () => screen.getByTestId('stay-calendar-status').textContent;

describe('StayCalendar currency', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(async () => {
    cleanup();
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  it.each([
    ['empty', ''],
    ['missing', undefined],
    ['null', null],
    ['not a code (XX1)', 'XX1'],
  ] as const)('StayCalendar_Currency%s_WritesTheNumberAloneInTheCellAndTheNameOfTheDayAndTheTotalSayTheCurrencyIsNotAvailable', (_name, currency) => {
    render(<Harness calendar={data(currency)} />);

    // A cell has no room for the phrase: the number alone, with no symbol (a long phrase would run over the days next to it)...
    expect(price('2026-11-10')).toBe('150');
    expect(document.querySelector('[data-testid="stay-calendar"] .stay-cal__p')?.textContent).not.toContain('valuta');
    // ...and the phrase is where there is room for it: the name of the day (what a screen reader says) and the total of the stay.
    expect(day('2026-11-10').getAttribute('aria-label')).toContain('150 (valuta non disponibile) a notte');

    fireEvent.click(day('2026-11-10'));
    fireEvent.click(day('2026-11-13'));
    expect(status()).toContain('3 notti, 450 (valuta non disponibile).');
    expect(screen.getByTestId('stay-calendar').textContent).not.toMatch(/EUR|€/);
  });

  it('StayCalendar_NoCurrencyInEnglish_SaysItInEnglish', async () => {
    await i18n.changeLanguage('en');
    render(<Harness calendar={data('')} />);

    expect(price('2026-11-10')).toBe('150');
    expect(day('2026-11-10').getAttribute('aria-label')).toContain('150 (currency not available)');
    fireEvent.click(day('2026-11-10'));
    fireEvent.click(day('2026-11-13'));
    expect(status()).toContain('3 nights, 450 (currency not available).');
  });

  it('StayCalendar_CurrencyOfTheHome_IsTheOneWritten', () => {
    render(<Harness calendar={data('CHF')} />);

    expect(price('2026-11-10')).toContain('CHF');
    expect(price('2026-11-10')).not.toContain('€');
    fireEvent.click(day('2026-11-10'));
    fireEvent.click(day('2026-11-13'));
    expect(status()).toContain('CHF');
    expect(status()).not.toContain('valuta non disponibile');
  });

  it('StayCalendar_NightsThatCouldNotBeRead_DrawWithNoCurrencyAndNoPrice', () => {
    // While the nights load, and when they cannot be read, the calendar has no currency (null, never a euro) and draws no price.
    const { unmount } = render(<Harness calendar={data(null, { status: 'loading', days: [], end: TODAY })} />);
    expect(screen.getByTestId('stay-calendar')).toBeInTheDocument();
    expect(document.querySelectorAll('.stay-cal__p')).toHaveLength(0);
    unmount();

    render(<Harness calendar={data(null, { status: 'error', days: [], errorMessage: 'Non riusciamo a leggere le date.' })} />);
    expect(screen.getByTestId('stay-calendar-error')).toBeInTheDocument();
    expect(document.querySelectorAll('.stay-cal__p')).toHaveLength(0);
    expect(screen.getByTestId('stay-calendar').textContent).not.toMatch(/EUR|€/);
  });
});
