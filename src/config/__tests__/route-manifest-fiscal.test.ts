import { describe, it, expect } from 'vitest';
import { getSecondaryNavEntries } from '../route-manifest';

describe('route-manifest fiscal nav (#3)', () => {
  it('exposes fiscal dashboard under compliance secondary nav', () => {
    const secondary = getSecondaryNavEntries('short-rent', () => true);
    const fiscal = secondary.find((e) => e.path === '/app/short-rent/fiscal');
    expect(fiscal?.navKey).toBe('nav.fiscal');
    expect(fiscal?.navGroup).toBe('compliance');
    expect(fiscal?.icon).toBe('FileText');
  });
});
