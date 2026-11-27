import { describe, expect, it } from 'vitest';
import en from '@/i18n/locales/en.json';
import it_ from '@/i18n/locales/it.json';

/**
 * The words of the Active tab, of its health and of the change and the deactivation of an activation (E09/F03/US02): in alphabetical order at every level and the same keys in both
 * languages (the rule of the locale files), no text of an integration that names the supplier of the channel manager, and the sentences that must not promise more than the data say.
 */
const LOCALES = [
  { language: 'it', locale: it_ },
  { language: 'en', locale: en },
] as const;

const ROOTS = ['mine', 'health', 'change', 'deactivate'] as const;

const alphabetical = (a: string, b: string) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0);

function unsortedLevels(node: unknown, path: string): string[] {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return [];
  const keys = Object.keys(node);
  const here = keys.join() === [...keys].sort(alphabetical).join() ? [] : [path];
  return [...here, ...keys.flatMap((key) => unsortedLevels((node as Record<string, unknown>)[key], `${path}.${key}`))];
}

function leaves(node: unknown, path: string): Array<[string, string]> {
  if (typeof node === 'string') return [[path, node]];
  if (node === null || typeof node !== 'object') return [];
  return Object.entries(node).flatMap(([key, value]) => leaves(value, `${path}.${key}`));
}

describe('the keys of the Active tab', () => {
  it.each(LOCALES)('$language: every level of marketplace.{mine,health,change,deactivate} is in alphabetical order', ({ locale }) => {
    for (const root of ROOTS) expect(unsortedLevels(locale.marketplace[root], `marketplace.${root}`)).toEqual([]);
  });

  it('both languages have the same keys', () => {
    for (const root of ROOTS) {
      expect(leaves(en.marketplace[root], root).map(([path]) => path)).toEqual(leaves(it_.marketplace[root], root).map(([path]) => path));
    }
  });

  it.each(LOCALES)('$language: no text names the supplier of the channel manager, and none is empty', ({ locale }) => {
    for (const root of ROOTS) {
      for (const [path, text] of leaves(locale.marketplace[root], root)) {
        expect(text.trim(), path).not.toBe('');
        expect(text, path).not.toMatch(/octorate/i);
      }
    }
  });
});

describe('what the words promise', () => {
  it.each(LOCALES)('$language: the badge says «Requested» as a status of its own', ({ locale }) => {
    expect(locale.marketplace.status.Requested).toBeTruthy();
    expect(locale.marketplace.status.Requested).not.toBe(locale.marketplace.status.Active);
  });

  it.each(LOCALES)('$language: the quota is the channel manager\'s: every sentence that names it says so, never «the quota of the channel»', ({ locale }) => {
    // «Canale» is a sales channel (Airbnb, Booking.com) in this interface; the quota is the one of the channel manager's API, as the sentence of the sync says (`…quotaLow`).
    const { label, units, unknown, usage, warn } = locale.marketplace.health.quota;
    for (const text of [label, units, unknown, usage, warn, locale.marketplace.mine.card.quotaWarn]) expect(text).toMatch(/channel manager/i);
  });

  it.each(LOCALES)('$language: the button of the panel only refreshes: it does not promise a new check on the channel manager', ({ locale }) => {
    // «Controlla di nuovo» / «Check again» is what the app says where the channel manager is asked again; the panel only reads the rows of CasaZen (the sync is a job of its own).
    expect(locale.marketplace.health.refresh).not.toMatch(/controlla|check/i);
    expect(locale.marketplace.health.description).toMatch(/ultimo controllo|last check/i);
  });

  it.each(LOCALES)('$language: «declared» never says «verified», and «verified» is a line of its own', ({ locale }) => {
    const { declared, declaredNoDate, verified } = locale.marketplace.mine.card;

    expect(declared).not.toMatch(/verific|verified/i);
    expect(declaredNoDate).not.toMatch(/verific|verified/i);
    expect(verified).toMatch(/verific|verified/i);
  });

  it.each(LOCALES)('$language: the deactivation is not worded as the main action, and the calm lines claim only what the server reports', ({ locale }) => {
    // «No problem reported», never «all fine»: the line says what the server said.
    expect(locale.marketplace.health.calm_one).toMatch(/segnalat|reported/i);
    expect(locale.marketplace.health.calm_other).toMatch(/segnalat|reported/i);
    expect(locale.marketplace.health.waiting_one).not.toMatch(/segnalat|reported|ordine|fine/i);
    expect(locale.marketplace.deactivate.keep).toBeTruthy();
  });
});
