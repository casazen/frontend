import { describe, it, expect } from 'vitest';
import { getNavChildren, getSecondaryNavEntries } from '../route-manifest';

describe('route-manifest fiscal nav (#3)', () => {
  // UI-04a: the fiscal regime is a tab of Incassi, not an entry of "Altro" (the menu is short because sections have tabs).
  it('exposes fiscal dashboard as a tab of Incassi', () => {
    const fiscal = getNavChildren('/app/short-rent/payments', () => true).find((e) => e.path === '/app/short-rent/fiscal');
    expect(fiscal?.navKey).toBe('nav.fiscal');
    expect(fiscal?.navParent).toBe('/app/short-rent/payments');
    expect(fiscal?.navPlacement).toBeUndefined();
    expect(fiscal?.navGroup).toBeUndefined();
    expect(fiscal?.icon).toBe('FileText');
    expect(getSecondaryNavEntries('short-rent', () => true).map((e) => e.path)).not.toContain('/app/short-rent/fiscal');
  });
});
