import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useBookingSearchParams } from '../use-booking-search-params';

function renderBookingParams(initialUrl: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialUrl]}>{children}</MemoryRouter>
  );
  return renderHook(() => ({ booking: useBookingSearchParams(), location: useLocation() }), { wrapper });
}

describe('useBookingSearchParams', () => {
  afterEach(() => {
    cleanup();
  });

  it('setParams_TwoUpdatesBeforeRerender_KeepsBothDates', () => {
    const { result } = renderBookingParams('/book/demo/property/p1');

    act(() => {
      result.current.booking.setParams({ checkIn: '2026-10-01' });
      result.current.booking.setParams({ checkOut: '2026-10-04' });
    });

    expect(result.current.booking.params).toMatchObject({ checkIn: '2026-10-01', checkOut: '2026-10-04' });
    const search = new URLSearchParams(result.current.location.search);
    expect(search.get('checkin')).toBe('2026-10-01');
    expect(search.get('checkout')).toBe('2026-10-04');
  });

  it('params_LegacyLink_ReadsDatesAndRewritesThemOnUpdate', () => {
    const { result } = renderBookingParams('/book/demo/property/p1?checkIn=2026-10-01&checkOut=2026-10-04&guests=3');

    expect(result.current.booking.params).toEqual({ checkIn: '2026-10-01', checkOut: '2026-10-04', guests: 3, children: 0 });

    act(() => {
      result.current.booking.setParams({ guests: 4 });
    });

    expect(result.current.location.search).toBe('?checkin=2026-10-01&checkout=2026-10-04&guests=4');
  });
});
