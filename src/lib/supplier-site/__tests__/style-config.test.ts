import { describe, expect, it } from 'vitest';
import { AA_TEXT_CONTRAST, contrastRatio } from '@/lib/public-site-colors';
import {
  recommendedStyleFor,
  resolveSiteFont,
  resolveSiteStyle,
  SITE_STYLE_IDS,
  SITE_STYLES,
  siteButtonColor,
  siteColorVars,
  styleForCategories,
  suggestReadableColor,
} from '../style-config';

describe('the four styles of a supplier showcase: the color of their buttons', () => {
  it.each(SITE_STYLE_IDS)('%s holds white text at AA (4.5:1) and is accepted as a color of its own', (id) => {
    const { cta } = SITE_STYLES[id];
    expect(contrastRatio(cta, '#ffffff')).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
    expect(siteButtonColor(cta)).toBe(cta);
  });

  it('draws the sample of each style on a page color that is its own and light enough for the sample to read', () => {
    for (const id of SITE_STYLE_IDS) {
      const { bg, cta } = SITE_STYLES[id];
      expect(bg).toMatch(/^#[0-9a-f]{6}$/);
      expect(contrastRatio(cta, bg)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('siteButtonColor: the color a supplier chose for its buttons', () => {
  it('takes a color white text reads on at 4.5:1, in six digits and lower case', () => {
    expect(siteButtonColor('#0B5FA5')).toBe('#0b5fa5');
    expect(siteButtonColor('  #1F2933 ')).toBe('#1f2933');
    // The shorthand is read as six digits (the server refuses the three-digit form, the editor sends it complete).
    expect(siteButtonColor('#036')).toBe('#003366');
  });

  it('refuses a color white text cannot read on, and a value that is no color', () => {
    expect(siteButtonColor('#ffcc00')).toBeNull();
    expect(siteButtonColor('#ffffff')).toBeNull();
    expect(siteButtonColor('azzurro')).toBeNull();
    expect(siteButtonColor('#12345')).toBeNull();
    expect(siteButtonColor('')).toBeNull();
    expect(siteButtonColor(null)).toBeNull();
    expect(siteButtonColor(undefined)).toBeNull();
  });
});

describe('suggestReadableColor: the same hue, darker', () => {
  it('gives back a color that is already readable, unchanged', () => {
    expect(suggestReadableColor('#0b5fa5')).toBe('#0b5fa5');
  });

  it('darkens an unreadable color until white text reads on it at AA', () => {
    for (const color of ['#ffcc00', '#66bb6a', '#4fc3f7', '#f4a261']) {
      const suggested = suggestReadableColor(color);
      expect(contrastRatio(suggested, '#ffffff'), color).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
      expect(siteButtonColor(suggested), color).toBe(suggested);
    }
  });

  it('falls back to the color of a style for a value that is no color', () => {
    expect(suggestReadableColor('azzurro')).toBe(SITE_STYLES.fresco.cta);
    expect(suggestReadableColor('azzurro', '#0b5fa5')).toBe('#0b5fa5');
  });
});

describe('the style that fits a trade', () => {
  it('recommends one for the trades that have a style of their own, none for the others', () => {
    expect(recommendedStyleFor(['cleaning'])).toBe('fresco');
    expect(recommendedStyleFor(['plumbing'])).toBe('acqua');
    expect(recommendedStyleFor(['electrical'])).toBe('scintilla');
    expect(recommendedStyleFor(['gardening'])).toBe('naturale');
    expect(recommendedStyleFor(['events', 'rental', 'excursions'])).toBeNull();
    expect(recommendedStyleFor([])).toBeNull();
  });

  it('takes the first category of the profile that has one', () => {
    expect(recommendedStyleFor(['events', 'gardening', 'plumbing'])).toBe('naturale');
  });

  it('resolves to the default style when a trade has none, and to the recommended one when the supplier chose none or a name nobody knows', () => {
    expect(styleForCategories(['events'])).toBe('fresco');
    expect(resolveSiteStyle(undefined, ['gardening'])).toBe('naturale');
    expect(resolveSiteStyle('bogus', ['plumbing'])).toBe('acqua');
    expect(resolveSiteStyle('scintilla', ['plumbing'])).toBe('scintilla');
  });

  it('resolves the typeface to the one of the style unless the supplier chose another', () => {
    expect(resolveSiteFont(undefined, 'naturale')).toBe(SITE_STYLES.naturale.font);
    expect(resolveSiteFont('moderno', 'naturale')).toBe('moderno');
    expect(resolveSiteFont('inventato', 'acqua')).toBe(SITE_STYLES.acqua.font);
  });
});

describe('siteColorVars: the shades derived from a color', () => {
  it('sets the four variables the stylesheet reads, the color itself first', () => {
    const vars = siteColorVars('#0b5fa5');
    expect(Object.keys(vars).sort()).toEqual(['--vz-cta', '--vz-cta-hover', '--vz-cta-ink', '--vz-cta-soft']);
    expect(vars['--vz-cta']).toBe('#0b5fa5');
  });
});
