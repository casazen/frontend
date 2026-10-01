import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, AA_TEXT_CONTRAST } from '@/lib/public-site-colors';
import {
  PUBLIC_SITE_THEMES,
  PUBLIC_SITE_THEME_PALETTES,
  type PublicSiteThemeId,
} from '@/lib/public-site-themes';

/**
 * The three lists of themes (BK-12) and the quality bar of the tokens (BK-13): the CSS is parsed, so a theme added
 * or recolored in one place only, or a pair of colors under WCAG AA, fails here.
 */
const read = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');
const tokensCss = read('src/styles/public-tokens.css');
const fontsCss = read('src/styles/public-fonts.css');

/** Declarations of every `[data-theme='x'] { ... }` block (the media-query blocks add or override tokens). */
function parseThemes(css: string): Record<string, Record<string, string>> {
  const themes: Record<string, Record<string, string>> = {};
  for (const match of css.matchAll(/\[data-theme='([\w-]+)'\]\s*\{([^}]*)\}/g)) {
    const [, id, body] = match;
    themes[id] ??= {};
    for (const declaration of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      themes[id][declaration[1]] = declaration[2].trim();
    }
  }
  return themes;
}

const themes = parseThemes(tokensCss);

describe('public-tokens.css', () => {
  it('Themes_CssAndFrontendList_AreTheSameThree', () => {
    expect(Object.keys(themes).sort()).toEqual([...PUBLIC_SITE_THEMES].sort());
  });

  it.each(PUBLIC_SITE_THEMES)('Palette_%s_MirrorsTheCssTokens', (themeId) => {
    const css = themes[themeId];
    const palette = PUBLIC_SITE_THEME_PALETTES[themeId];

    expect({
      primary: css['--cz-public-primary'],
      onPrimary: css['--cz-public-on-primary'],
      primaryText: css['--cz-public-primary-text'],
      bg: css['--cz-public-bg'],
      surface: css['--cz-public-surface'],
      text: css['--cz-public-text'],
      muted: css['--cz-public-muted'],
    }).toEqual(palette);
  });

  it.each(PUBLIC_SITE_THEMES)('Theme_%s_EveryTextPairMeetsWcagAA', (themeId) => {
    const css = themes[themeId];
    const pairs: [string, string, string][] = [
      ['text', '--cz-public-text', '--cz-public-bg'],
      ['text on card', '--cz-public-text', '--cz-public-surface'],
      ['muted text', '--cz-public-muted', '--cz-public-bg'],
      ['muted text on card', '--cz-public-muted', '--cz-public-surface'],
      ['text on primary', '--cz-public-on-primary', '--cz-public-primary'],
      ['primary as text', '--cz-public-primary-text', '--cz-public-bg'],
      ['primary as text on card', '--cz-public-primary-text', '--cz-public-surface'],
    ];

    for (const [label, foreground, background] of pairs) {
      const ratio = contrastRatio(css[foreground], css[background]);
      expect(ratio, `${themeId}: ${label} (${css[foreground]} on ${css[background]})`).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
    }
  });

  it.each(['--cz-public-primary', '--cz-public-bg', '--cz-public-text', '--cz-public-font-display', '--cz-public-radius', '--cz-public-shadow-card', '--cz-public-section-y'])(
    'Themes_Token_%s_DiffersBetweenThemes',
    (token) => {
      const values = PUBLIC_SITE_THEMES.map((id: PublicSiteThemeId) => themes[id][token]);
      expect(values.every(Boolean)).toBe(true);
      expect(new Set(values).size).toBe(PUBLIC_SITE_THEMES.length);
    },
  );

  it.each(PUBLIC_SITE_THEMES)('Theme_%s_DefinesEveryToken', (themeId) => {
    const required = [
      '--cz-public-font-display',
      '--cz-public-font-body',
      '--cz-public-display-weight',
      '--cz-public-display-tracking',
      '--cz-public-primary',
      '--cz-public-on-primary',
      '--cz-public-primary-text',
      '--cz-public-bg',
      '--cz-public-surface',
      '--cz-public-text',
      '--cz-public-muted',
      '--cz-public-border',
      '--cz-public-radius',
      '--cz-public-shadow-card',
      '--cz-public-shadow-widget',
      '--cz-public-section-y',
    ];
    expect(required.filter((token) => !themes[themeId][token])).toEqual([]);
  });

  it('Fonts_EveryFirstFamilyOfTheStacks_IsSelfHostedWithAnExistingFile', () => {
    const declared = new Map<string, string>();
    for (const face of fontsCss.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
      const family = /font-family:\s*'([^']+)'/.exec(face[1])?.[1];
      const file = /url\('([^']+)'\)/.exec(face[1])?.[1];
      if (family && file) declared.set(family, file);
    }

    for (const themeId of PUBLIC_SITE_THEMES) {
      for (const token of ['--cz-public-font-display', '--cz-public-font-body']) {
        const family = /^'([^']+)'/.exec(themes[themeId][token])?.[1];
        expect(family, `${themeId} ${token}`).toBeDefined();
        const file = declared.get(family!);
        expect(file, `@font-face of ${family}`).toBeDefined();
        expect(() => readFileSync(resolve(process.cwd(), 'src/styles', file!)), `${file} exists`).not.toThrow();
      }
    }
  });

  it('Fonts_NoThirdPartyFontServer_IsReferenced', () => {
    expect(`${tokensCss}\n${fontsCss}`).not.toMatch(/fonts\.googleapis|fonts\.gstatic|typekit|use\.fontawesome/i);
    expect(read('index.html')).not.toMatch(/fonts\.googleapis|fonts\.gstatic/i);
  });
});
