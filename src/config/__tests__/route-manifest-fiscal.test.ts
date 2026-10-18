import { describe, it, expect } from 'vitest';
import { getSecondaryNavEntries } from '../route-manifest';

describe('route-manifest fiscal nav (#3)', () => {
  // UI-04a: the secondary entries are the ones of "Altro"; they have no named group.
  it('exposes fiscal dashboard among the entries of "Altro"', () => {
    const secondary = getSecondaryNavEntries('short-rent', () => true);
    const fiscal = secondary.find((e) => e.path === '/app/short-rent/fiscal');
    expect(fiscal?.navKey).toBe('nav.fiscal');
    expect(fiscal?.navPlacement).toBe('secondary');
    expect(fiscal?.navGroup).toBeUndefined();
    expect(fiscal?.icon).toBe('FileText');
  });
});
