import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INTEGRATION_GROUPS } from '../integrations-catalog';

describe('INTEGRATION_GROUPS', () => {
  it('groups_haveNamedEntriesWithoutDuplicatesInAGroup', () => {
    for (const group of INTEGRATION_GROUPS) {
      expect(group.entries.length).toBeGreaterThan(0);
      const names = group.entries.map((entry) => entry.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('groups_includeTheMainSalesChannels', () => {
    const ota = INTEGRATION_GROUPS.find((group) => group.id === 'ota')?.entries.map((entry) => entry.name) ?? [];
    expect(ota).toEqual(expect.arrayContaining(['Booking.com', 'Airbnb', 'Expedia', 'Vrbo']));
  });

  it('logos_pointToFilesKeptOnOurOwnHost', () => {
    const logos = INTEGRATION_GROUPS.flatMap((group) => group.entries.flatMap((entry) => (entry.logo ? [entry.logo] : [])));
    expect(logos.length).toBeGreaterThan(0);
    for (const logo of logos) {
      expect(logo).toMatch(/^\/integrations\/[a-z]+\/[a-z0-9-]+\.webp$/);
      expect(existsSync(join(process.cwd(), 'public', logo))).toBe(true);
    }
  });

  it('catalogue_neverNamesTheProviderOfTheList', () => {
    expect(JSON.stringify(INTEGRATION_GROUPS).toLowerCase()).not.toContain('octorate');
  });
});
