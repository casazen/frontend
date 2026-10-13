import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import i18n from '@/i18n/config';
import { withBrowserTimeZone } from '@/test/clock';
import { AvailabilityCalendar } from '../AvailabilityCalendar';

function renderCalendar() {
  render(
    <AvailabilityCalendar
      bookedDates={new Set(['2026-09-26'])}
      status="ready"
      onRetry={vi.fn()}
      today="2026-09-25"
      rangeEnd="2027-09-25"
    />,
  );
}

function dayCells(): HTMLElement[] {
  return within(screen.getByTestId('availability-days'))
    .getAllByRole('listitem')
    .filter((cell) => cell.dataset.date);
}

describe.each(['America/Los_Angeles', 'Europe/Rome', 'Pacific/Kiritimati'])(
  'AvailabilityCalendar days in a browser in %s (QA-CLOCK-FE)',
  (timeZone) => {
    withBrowserTimeZone(timeZone);

    beforeEach(async () => {
      await i18n.changeLanguage('it');
    });

    afterEach(() => {
      cleanup();
    });

    it('AvailabilityCalendar_AnyBrowserTimeZone_ListsTheCalendarDaysOfTheMonth', () => {
      renderCalendar();

      const dates = dayCells().map((cell) => cell.dataset.date);
      expect(dates).toHaveLength(30);
      expect(dates[0]).toBe('2026-09-01');
      expect(dates[29]).toBe('2026-09-30');
    });

    it('AvailabilityCalendar_TodayInRome_EarlierDaysArePastAndTodayIsKnown', () => {
      renderCalendar();

      const cell = (date: string) => dayCells().find((c) => c.dataset.date === date);
      expect(cell('2026-09-24')).not.toHaveAttribute('data-booked');
      expect(cell('2026-09-25')).toHaveAttribute('data-booked', 'false');
      expect(cell('2026-09-26')).toHaveAttribute('data-booked', 'true');
      expect(cell('2026-09-25')).toHaveTextContent('25');
    });
  },
);
