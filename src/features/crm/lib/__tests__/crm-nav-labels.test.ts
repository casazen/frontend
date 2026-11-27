import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { getManifestEntry } from '@/config/route-manifest';
import i18n from '@/i18n/config';
import { getNavLabel, getNavTabLabel } from '@/lib/nav-labels';

const PATHS = ['/app/short-rent/crm/guests', '/app/short-rent/crm/segments', '/app/short-rent/crm/campaigns', '/app/short-rent/crm/merge'];

const NAMES = {
  it: { menu: 'Ospiti e marketing', tabs: ['Ospiti', 'Gruppi', 'Campagne', 'Schede doppie'] },
  en: { menu: 'Guests & marketing', tabs: ['Guests', 'Groups', 'Campaigns', 'Duplicate cards'] },
} as const;

describe('the section of the guests and the marketing is named in plain words', () => {
  it.each(['it', 'en'] as const)('the menu entry and the four tabs in %s', (language) => {
    const t = i18n.getFixedT(language) as TFunction;
    const entries = PATHS.map((path) => getManifestEntry(path));

    expect(entries.every(Boolean)).toBe(true);
    expect(getNavLabel(entries[0]!, t)).toBe(NAMES[language].menu);
    expect(entries.map((entry) => getNavTabLabel(entry!, t))).toEqual(NAMES[language].tabs);
  });
});
