import { describe, expect, it } from 'vitest';
import { isNotRedesignedMatch, NOT_REDESIGNED_ROUTE_HANDLE } from '@/lib/ui-version';

describe('isNotRedesignedMatch', () => {
  it('isNotRedesignedMatch_OneRouteMarkedNotRedesigned_IsTrue', () => {
    expect(NOT_REDESIGNED_ROUTE_HANDLE).toEqual({ redesign: false });
    expect(isNotRedesignedMatch([{ route: {} }, { route: { handle: NOT_REDESIGNED_ROUTE_HANDLE } }])).toBe(true);
  });

  it.each([
    null,
    [],
    [{ route: {} }],
    [{ route: { handle: { other: true } } }],
    [{ route: { handle: { redesign: true } } }],
    [{ route: { handle: { redesign: 'false' } } }],
    [{ route: { handle: 'redesign' } }],
  ])('isNotRedesignedMatch_%j_IsFalse', (matches) => {
    expect(isNotRedesignedMatch(matches)).toBe(false);
  });
});
