import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { useRevenue } from '@/queries/use-payments';
import { useProperties } from '@/queries/use-properties';
import { LATE_EVENING_UTC, NOON_UTC, freezeClock, withBrowserTimeZone } from '@/test/clock';
import { RevenuePage } from '../revenue-page';

vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/queries/use-payments', () => ({ useRevenue: vi.fn() }));
vi.mock('@/queries/use-properties', () => ({ useProperties: vi.fn() }));

function renderPage() {
  render(
    <MemoryRouter>
      <RevenuePage />
    </MemoryRouter>,
  );
}

function dateInput(labelKey: string): HTMLInputElement {
  return screen.getByLabelText(i18n.t(labelKey)) as HTMLInputElement;
}

describe('RevenuePage default period (QA-CLOCK-FE)', () => {
  // In Rome a local midnight is the day before in UTC: the old toISOString() range started on the last day of the
  // previous month.
  withBrowserTimeZone('Europe/Rome');

  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    vi.mocked(useProperties).mockReturnValue({
      data: [{ id: 'p1', name: 'Casa Roma' }],
    } as unknown as ReturnType<typeof useProperties>);
    vi.mocked(useRevenue).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as unknown as ReturnType<typeof useRevenue>);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('RevenuePage_At2330UtcOf24September_UsesTodayInRome', () => {
    freezeClock(LATE_EVENING_UTC);

    renderPage();

    expect(dateInput('revenue.startDate')).toHaveValue('2026-09-01');
    expect(dateInput('revenue.endDate')).toHaveValue('2026-09-25');
    expect(useRevenue).toHaveBeenLastCalledWith(
      expect.objectContaining({ propertyId: 'p1', startDate: '2026-09-01', endDate: '2026-09-25' }),
    );
  });

  it('RevenuePage_AtNoonUtc_UsesTheSameDate', () => {
    freezeClock(NOON_UTC);

    renderPage();

    expect(dateInput('revenue.startDate')).toHaveValue('2026-09-01');
    expect(dateInput('revenue.endDate')).toHaveValue('2026-09-24');
  });

  it('RevenuePage_FirstNightOfTheMonthInRome_StartsFromTheNewMonth', () => {
    // 22:30 UTC of 30 September is 00:30 of 1 October in Rome.
    freezeClock('2026-09-30T22:30:00Z');

    renderPage();

    expect(dateInput('revenue.startDate')).toHaveValue('2026-10-01');
    expect(dateInput('revenue.endDate')).toHaveValue('2026-10-01');
  });

  it('RevenuePage_ResetFilters_RestoresTodayInRome', () => {
    freezeClock(LATE_EVENING_UTC);
    renderPage();
    fireEvent.change(dateInput('revenue.startDate'), { target: { value: '2026-01-01' } });
    fireEvent.change(dateInput('revenue.endDate'), { target: { value: '2026-01-31' } });

    fireEvent.click(screen.getByRole('button', { name: i18n.t('revenue.resetFilters') }));

    expect(dateInput('revenue.startDate')).toHaveValue('2026-09-01');
    expect(dateInput('revenue.endDate')).toHaveValue('2026-09-25');
  });
});
