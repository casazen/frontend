import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';

/**
 * `t('compliance.cockpit.kicker')` once shipped although that key is an object ({ fine, start, chore }): i18next then
 * renders "key '… (it)' returned an object instead of string." as the text. Every `t()` call with a literal key must
 * point at a leaf (a string), in every locale.
 */
const ROOT = join(process.cwd(), 'src');
/** Read on purpose as an object: `t(key, { returnObjects: true })`. */
const RETURN_OBJECTS = new Set(['productGuide.sections']);
/** Known offenders, not part of the cockpit fix: remove an entry when its call site is fixed. */
const KNOWN_OFFENDERS = new Set(['pages/CampaignsPage.tsx: campaigns.segment']);
const PLURAL_FORM = /_(zero|one|two|few|many|other)$/;

function isPluralGroup(value: object): boolean {
  return Object.keys(value).some((name) => PLURAL_FORM.test(name));
}

const LITERAL_KEY = /\bt\(\s*(['"])([A-Za-z0-9_.-]+)\1/g;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return entry === 'locales' ? [] : sources(path);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) && !path.includes('__tests__') ? [path] : [];
  });
}

describe('i18n keys', () => {
  it('literalTKeys_NeverResolveToAnObject', { timeout: 30_000 }, () => {
    const offending: string[] = [];
    for (const file of sources(ROOT)) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(LITERAL_KEY)) {
        const key = match[2];
        for (const lng of ['it', 'en']) {
          const value = i18n.getResource(lng, 'translation', key);
          if (value === null || typeof value !== 'object' || RETURN_OBJECTS.has(key) || isPluralGroup(value)) continue;
          const where = `${relative(ROOT, file).split('\\').join('/')}: ${key}`;
          if (!KNOWN_OFFENDERS.has(where)) offending.push(`${where} (${lng})`);
        }
      }
    }
    expect(offending).toEqual([]);
  });
});
