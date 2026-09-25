import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from '@/i18n/config';
import { useSupplierAvailability, useUpdateSupplierAvailability } from '@/queries/use-supplier';
import { LATE_EVENING_UTC, NOON_UTC, freezeClock, withBrowserTimeZone } from '@/test/clock';
import { SupplierAvailabilityPage } from '../supplier-availability-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/queries/use-supplier', () => ({
  useSupplierAvailability: vi.fn(),
  useUpdateSupplierAvailability: vi.fn(),
}));

const mutateAsync = vi.fn();

describe('SupplierAvailabilityPage today (QA-CLOCK-FE)', () => {
  // A browser far from Rome: neither the UTC date nor the browser date is "today".
  withBrowserTimeZone('America/New_York');

  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    mutateAsync.mockResolvedValue({ updated: 14 });
    vi.mocked(useSupplierAvailability).mockReturnValue({
      data: { dates: [{ date: '2026-09-25', available: false }] },
      isLoading: false,
    } as unknown as ReturnType<typeof useSupplierAvailability>);
    vi.mocked(useUpdateSupplierAvailability).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateSupplierAvailability>);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('SupplierAvailabilityPage_At2330UtcOf24September_StartsFromTodayInRome', async () => {
    freezeClock(LATE_EVENING_UTC);

    render(<SupplierAvailabilityPage />);

    expect(useSupplierAvailability).toHaveBeenCalledWith('2026-09-25', '2026-10-08');
    expect(screen.queryByTestId('availability-2026-09-24')).not.toBeInTheDocument();
    expect(screen.getByTestId('availability-2026-09-25')).toHaveTextContent(i18n.t('supplier.notAvailable'));
    expect(screen.getByTestId('availability-2026-09-25')).toHaveTextContent('ven 25 set');

    fireEvent.click(screen.getByRole('button', { name: i18n.t('supplier.saveAvailability') }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const dates = mutateAsync.mock.calls[0][0] as { date: string; available: boolean }[];
    expect(dates).toHaveLength(14);
    expect(dates[0]).toEqual({ date: '2026-09-25', available: false });
    expect(dates[13]).toEqual({ date: '2026-10-08', available: true });
  });

  it('SupplierAvailabilityPage_AtNoonUtc_StartsFromTheSameDate', () => {
    freezeClock(NOON_UTC);

    render(<SupplierAvailabilityPage />);

    expect(useSupplierAvailability).toHaveBeenCalledWith('2026-09-24', '2026-10-07');
    expect(screen.getByTestId('availability-2026-09-24')).toBeInTheDocument();
  });
});
