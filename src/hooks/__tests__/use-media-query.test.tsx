import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { stubViewportWidth } from '@/test/viewport';
import { FROM_TABLET_QUERY, PHONE_QUERY, TABLET_QUERY, useMediaQuery } from '../use-media-query';

describe('useMediaQuery (UI-04b)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('useMediaQuery_NoMatchMediaInTheEnvironment_NothingMatches', () => {
    vi.stubGlobal('matchMedia', undefined);

    const { result } = renderHook(() => useMediaQuery(PHONE_QUERY));

    expect(result.current).toBe(false);
  });

  it.each([
    [360, { phone: true, fromTablet: false, tablet: false }],
    [767, { phone: true, fromTablet: false, tablet: false }],
    [768, { phone: false, fromTablet: true, tablet: true }],
    [1023, { phone: false, fromTablet: true, tablet: true }],
    [1024, { phone: false, fromTablet: true, tablet: false }],
    [1440, { phone: false, fromTablet: true, tablet: false }],
  ])('useMediaQuery_Window%ipxWide_MatchesTheBreakpointsOfTailwind', (width, expected) => {
    stubViewportWidth(width);

    const phone = renderHook(() => useMediaQuery(PHONE_QUERY));
    const fromTablet = renderHook(() => useMediaQuery(FROM_TABLET_QUERY));
    const tablet = renderHook(() => useMediaQuery(TABLET_QUERY));

    expect({ phone: phone.result.current, fromTablet: fromTablet.result.current, tablet: tablet.result.current }).toEqual(expected);
  });

  it('useMediaQuery_WindowResized_FollowsIt', () => {
    const viewport = stubViewportWidth(390);
    const { result } = renderHook(() => useMediaQuery(TABLET_QUERY));
    expect(result.current).toBe(false);

    act(() => viewport.resize(820));
    expect(result.current).toBe(true);

    act(() => viewport.resize(1280));
    expect(result.current).toBe(false);
  });

  it('useMediaQuery_Unmounted_StopsListening', () => {
    const viewport = stubViewportWidth(390);
    const { result, unmount } = renderHook(() => useMediaQuery(PHONE_QUERY));
    expect(result.current).toBe(true);

    unmount();

    // A resize after the unmount reaches nobody and breaks nothing.
    expect(() => viewport.resize(1280)).not.toThrow();
  });
});
