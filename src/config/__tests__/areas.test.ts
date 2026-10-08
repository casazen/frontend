import { describe, expect, it } from 'vitest';
import it_ from '@/i18n/locales/it.json';
import en from '@/i18n/locales/en.json';
import { NAV_ICONS } from '@/lib/nav-icons';
import { AREAS, AREA_ORDER, getAccessibleAreas, getArea } from '../areas';
import { ROUTE_MANIFEST, type AppContextKey } from '../route-manifest';

type Tree = { [key: string]: string | Tree };

function lookup(tree: Tree, dotted: string): string | undefined {
  const value = dotted.split('.').reduce<string | Tree | undefined>((node, part) => (typeof node === 'object' ? node[part] : undefined), tree);
  return typeof value === 'string' ? value : undefined;
}

const CONTEXTS: AppContextKey[] = ['short-rent', 'long-rent', 'supplier', 'admin'];

describe('areas (UI-04a)', () => {
  it('defines every area the manifest has a context for, in the order of the selector', () => {
    expect(Object.keys(AREAS).sort()).toEqual([...CONTEXTS].sort());
    expect([...AREA_ORDER]).toEqual(['short-rent', 'long-rent', 'supplier', 'admin']);
    expect(new Set(ROUTE_MANIFEST.map((entry) => entry.context))).toEqual(new Set(CONTEXTS));
  });

  it.each(CONTEXTS)('%s: name, description, icon and accent exist', (key) => {
    const area = getArea(key);
    expect(area.key).toBe(key);
    expect(area.accent).toBe(key);
    expect(NAV_ICONS[area.icon]).toBeDefined();
    for (const locale of [it_, en] as Tree[]) {
      expect(lookup(locale, area.nameKey), `${area.nameKey}`).toBeTruthy();
      expect(lookup(locale, area.descriptionKey), `${area.descriptionKey}`).toBeTruthy();
      if (area.footerKey) expect(lookup(locale, area.footerKey), area.footerKey).toBeTruthy();
    }
  });

  it('names the areas as the demo does, and keeps the staff console as it is today', () => {
    const names = Object.fromEntries(CONTEXTS.map((key) => [key, lookup(it_ as Tree, AREAS[key].nameKey)]));
    expect(names).toEqual({
      'short-rent': 'Affitti brevi',
      'long-rent': 'Affitti lunghi',
      supplier: 'Portale fornitori',
      // `/app/admin` is the staff console, not the customer's "Amministrazione" of the demo (decision D1): same name as before.
      admin: 'Amministrazione',
    });
    expect(lookup(it_ as Tree, AREAS['short-rent'].descriptionKey)).toBe('Prenotazioni, calendario, prezzi e sito diretto');
    expect(lookup(it_ as Tree, AREAS['long-rent'].descriptionKey)).toBe('Contratti, inquilini, scadenze e canoni');
    expect(lookup(it_ as Tree, AREAS.supplier.descriptionKey)).toBe('Richieste, disponibilità, servizi e vetrina');
  });

  it('has a different name in each language', () => {
    for (const key of CONTEXTS) {
      expect(lookup(en as Tree, AREAS[key].nameKey)).not.toBe(lookup(it_ as Tree, AREAS[key].nameKey));
    }
  });

  it('lists the areas of the contexts of the user, in the order of the selector', () => {
    const contexts = [{ contextKey: 'admin' }, { contextKey: 'short-rent' }, { contextKey: 'unknown' }, { contextKey: 'supplier' }];
    expect(getAccessibleAreas(contexts).map((area) => area.key)).toEqual(['short-rent', 'supplier', 'admin']);
    expect(getAccessibleAreas([])).toEqual([]);
  });
});
