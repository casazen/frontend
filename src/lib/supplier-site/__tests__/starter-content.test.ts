import { describe, expect, it } from 'vitest';
import { starterContentFor, type StarterContent } from '../starter-content';

const TRADES = ['cleaning', 'laundry', 'linen', 'plumbing', 'electrical', 'gardening', 'check-in', 'maintenance'];
const startersOf = (): StarterContent[] => TRADES.map((trade) => starterContentFor([trade])).filter((starter): starter is StarterContent => starter !== null);

/**
 * What a text of CasaZen on a page of the supplier must never say (`ANALISI.md` §16, VT-D20): a certification, a guarantee, an insurance,
 * years or experience, a time, a price, a rating, a promise or an adjective nobody measures.
 */
const FORBIDDEN =
  /assicura|certific|garanz|garantit|\banni\b|esperien|espert|professional|qualific|\d+\s*(ore|h|giorni|minuti)|\b24\b|\bentro\b|€|\beuro\b|prezzo|gratis|gratuit|\bsempre\b|miglior|recension|stelle|\bvoto\b|leader|ottim|rapid|veloc|economic|convenien|affidabil|puntual|conformit/i;

describe('the starter texts of the showcase editor', () => {
  it('exist for the trades that have a text and for no other', () => {
    expect(startersOf()).toHaveLength(TRADES.length);
    for (const trade of ['events', 'rental', 'excursions', 'unknown']) expect(starterContentFor([trade])).toBeNull();
    expect(starterContentFor(undefined)).toBeNull();
    expect(starterContentFor([])).toBeNull();
  });

  it('take the first category of the profile that has one', () => {
    expect(starterContentFor(['events', 'plumbing', 'cleaning'])).toBe(starterContentFor(['plumbing']));
  });

  it('fit the limits of the server', () => {
    for (const starter of startersOf()) {
      expect(starter.tagline.length).toBeGreaterThanOrEqual(12);
      expect(starter.tagline.length).toBeLessThanOrEqual(90);
      expect(starter.intro.length).toBeLessThanOrEqual(180);
      expect(starter.prep.length).toBeLessThanOrEqual(6);
      for (const tip of starter.prep) expect(tip.length).toBeLessThanOrEqual(160);
    }
  });

  it('say what the work is and nothing that has to be true of the supplier: no certification, guarantee, insurance, time, price or rating', () => {
    for (const starter of startersOf()) {
      for (const text of [starter.tagline, starter.intro, ...starter.prep]) expect(text).not.toMatch(FORBIDDEN);
    }
  });
});
