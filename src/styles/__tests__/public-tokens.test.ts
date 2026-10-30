import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, AA_TEXT_CONTRAST } from '@/lib/public-site-colors';
import {
  PUBLIC_SITE_FONTS,
  PUBLIC_SITE_THEMES,
  PUBLIC_SITE_THEME_PALETTES,
  THEME_DEFAULT_FONT,
  type PublicSiteThemeId,
  type PublicSiteThemePalette,
} from '@/lib/public-site-themes';

/**
 * The lists of themes and font pairs (BK-12, DB-01) and the quality bar of the tokens (BK-13): the CSS is parsed, so a theme
 * added or recolored in one place only, or a pair of colors under WCAG AA, fails here.
 */
const read = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

type Tokens = Record<string, string>;

/**
 * Declarations of every rule of a stylesheet by selector. Comments and `@import` are dropped; a selector list is split (each
 * selector gets the declarations); the copies of a rule in a media query add to, and override, the first.
 */
function parseRules(css: string): Map<string, Tokens> {
  const rules = new Map<string, Tokens>();
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@import[^;]*;/g, '');
  for (const match of plain.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [, selectorList, body] = match;
    for (const selector of selectorList.split(',').map((s) => s.trim())) {
      const tokens = rules.get(selector) ?? {};
      for (const declaration of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
        tokens[declaration[1]] = declaration[2].trim();
      }
      rules.set(selector, tokens);
    }
  }
  return rules;
}

const tokensCss = read('src/styles/public-tokens.css');
const fontsCss = read('src/styles/public-fonts.css');
const tokenRules = parseRules(tokensCss);

const themes: Record<string, Tokens> = Object.fromEntries(
  PUBLIC_SITE_THEMES.map((id) => [id, tokenRules.get(`[data-theme='${id}']`) ?? {}]),
);
const fontPairs: Record<string, Tokens> = Object.fromEntries(
  PUBLIC_SITE_FONTS.map((id) => [id, tokenRules.get(`.public-site-root[data-font='${id}']`) ?? {}]),
);

/** The CSS token each field of the palette of `public-site-themes.ts` mirrors. */
const PALETTE_TOKENS: Record<keyof PublicSiteThemePalette, string> = {
  primary: '--cz-public-primary',
  onPrimary: '--cz-public-on-primary',
  primaryText: '--cz-public-primary-text',
  hover: '--cz-public-hover',
  ink: '--cz-public-ink',
  soft: '--cz-public-soft',
  bg: '--cz-public-bg',
  surface: '--cz-public-surface',
  surface2: '--cz-public-surface-2',
  surface3: '--cz-public-surface-3',
  text: '--cz-public-text',
  muted: '--cz-public-muted',
  border: '--cz-public-border',
  lineStrong: '--cz-public-line-strong',
};

/** Tokens of the states every page shows: the same on the three themes, set once for all of them. */
const STATE_TOKENS = [
  '--cz-public-ok',
  '--cz-public-ok-soft',
  '--cz-public-warn',
  '--cz-public-warn-soft',
  '--cz-public-err',
  '--cz-public-err-soft',
  '--cz-public-star',
];

/** Tokens every theme (and the brand block of `public-brand.css`) defines: the pages never depend on a default. */
const LAYOUT_TOKENS = [
  '--cz-public-font-display',
  '--cz-public-font-body',
  '--cz-public-display-weight',
  '--cz-public-display-tracking',
  ...Object.values(PALETTE_TOKENS),
  '--cz-public-radius-sm',
  '--cz-public-radius-md',
  '--cz-public-radius-lg',
  '--cz-public-radius-xl',
  '--cz-public-radius',
  '--cz-public-btn-radius',
  '--cz-public-shadow-card',
  '--cz-public-shadow-widget',
  '--cz-public-section-y',
];

describe('public-tokens.css', () => {
  it('Themes_CssAndFrontendList_AreTheSameThree', () => {
    const inCss = [...tokenRules.keys()]
      .map((selector) => /^\[data-theme='([\w-]+)'\]$/.exec(selector)?.[1])
      .filter((id): id is string => Boolean(id));
    expect(inCss.sort()).toEqual([...PUBLIC_SITE_THEMES].sort());
  });

  it('FontPairs_CssAndFrontendList_AreTheSameThree', () => {
    const inCss = [...tokenRules.keys()]
      .map((selector) => /^\.public-site-root\[data-font='([\w-]+)'\]$/.exec(selector)?.[1])
      .filter((id): id is string => Boolean(id));
    expect(inCss.sort()).toEqual([...PUBLIC_SITE_FONTS].sort());
  });

  it.each(PUBLIC_SITE_THEMES)('Palette_%s_MirrorsTheCssTokens', (themeId) => {
    const css = themes[themeId];
    const mirrored = Object.fromEntries(Object.entries(PALETTE_TOKENS).map(([field, token]) => [field, css[token]]));

    expect(mirrored).toEqual(PUBLIC_SITE_THEME_PALETTES[themeId]);
  });

  it.each(PUBLIC_SITE_THEMES)('Theme_%s_EveryTextPairMeetsWcagAA', (themeId) => {
    const css = themes[themeId];
    const pairs: [string, string, string][] = [
      ['text', '--cz-public-text', '--cz-public-bg'],
      ['text on card', '--cz-public-text', '--cz-public-surface'],
      ['text on tinted surface', '--cz-public-text', '--cz-public-surface-2'],
      ['muted text', '--cz-public-muted', '--cz-public-bg'],
      ['muted text on card', '--cz-public-muted', '--cz-public-surface'],
      ['muted text on tinted surface', '--cz-public-muted', '--cz-public-surface-2'],
      ['text on primary', '--cz-public-on-primary', '--cz-public-primary'],
      ['text on primary under the pointer', '--cz-public-on-primary', '--cz-public-hover'],
      ['primary as text', '--cz-public-primary-text', '--cz-public-bg'],
      ['primary as text on card', '--cz-public-primary-text', '--cz-public-surface'],
      ['ink on soft tint', '--cz-public-ink', '--cz-public-soft'],
      ['ink on page', '--cz-public-ink', '--cz-public-bg'],
      ['ink on card', '--cz-public-ink', '--cz-public-surface'],
      ['ok on its tint', '--cz-public-ok', '--cz-public-ok-soft'],
      ['ok on page', '--cz-public-ok', '--cz-public-bg'],
      ['ok on card', '--cz-public-ok', '--cz-public-surface'],
      ['warn on its tint', '--cz-public-warn', '--cz-public-warn-soft'],
      ['warn on page', '--cz-public-warn', '--cz-public-bg'],
      ['warn on card', '--cz-public-warn', '--cz-public-surface'],
      ['err on its tint', '--cz-public-err', '--cz-public-err-soft'],
      ['err on page', '--cz-public-err', '--cz-public-bg'],
      ['err on card', '--cz-public-err', '--cz-public-surface'],
    ];

    for (const [label, foreground, background] of pairs) {
      const ratio = contrastRatio(css[foreground], css[background]);
      expect(ratio, `${themeId}: ${label} (${css[foreground]} on ${css[background]})`).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
    }
  });

  it.each([
    '--cz-public-primary',
    '--cz-public-bg',
    '--cz-public-surface-2',
    '--cz-public-text',
    '--cz-public-radius-md',
    '--cz-public-btn-radius',
    '--cz-public-shadow-card',
    '--cz-public-section-y',
  ])('Themes_Token_%s_DiffersBetweenThemes', (token) => {
    const values = PUBLIC_SITE_THEMES.map((id: PublicSiteThemeId) => themes[id][token]);
    expect(values.every(Boolean)).toBe(true);
    expect(new Set(values).size).toBe(PUBLIC_SITE_THEMES.length);
  });

  it.each(PUBLIC_SITE_THEMES)('Theme_%s_DefinesEveryToken', (themeId) => {
    const missing = [...LAYOUT_TOKENS, ...STATE_TOKENS].filter((token) => !themes[themeId][token]);
    expect(missing).toEqual([]);
  });

  it.each(PUBLIC_SITE_THEMES)('Theme_%s_StartsWithTheFontPairOfItsDefault', (themeId) => {
    const pair = fontPairs[THEME_DEFAULT_FONT[themeId]];
    for (const token of ['--cz-public-font-display', '--cz-public-display-weight', '--cz-public-display-tracking']) {
      expect(pair[token], `${THEME_DEFAULT_FONT[themeId]} ${token}`).toBeTruthy();
      expect(themes[themeId][token], `${themeId} ${token}`).toBe(pair[token]);
    }
  });

  it('Brand_TheBlockOfCasazenPages_DefinesEveryTokenOfTheThemes', () => {
    // The brand pages (`public-brand.css`) set their own look on a root that also carries a theme: they must not inherit
    // any of the theme's colors by omission. The states (ok, warn, err, star) are the same everywhere and come from the theme.
    const brand = parseRules(read('src/styles/public-brand.css')).get(".public-site-root[data-brand='casazen']") ?? {};
    expect(LAYOUT_TOKENS.filter((token) => !brand[token])).toEqual([]);
  });

  it('Fonts_EveryFirstFamilyOfTheStacks_IsSelfHostedWithAnExistingFile', () => {
    const declared = new Map<string, string>();
    for (const face of fontsCss.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
      const family = /font-family:\s*'([^']+)'/.exec(face[1])?.[1];
      const file = /url\('([^']+)'\)/.exec(face[1])?.[1];
      if (family && file) declared.set(family, file);
    }

    const stacks = [...PUBLIC_SITE_THEMES.map((id) => themes[id]), ...PUBLIC_SITE_FONTS.map((id) => fontPairs[id])];
    for (const tokens of stacks) {
      for (const token of ['--cz-public-font-display', '--cz-public-font-body']) {
        if (!tokens[token]) continue;
        const family = /^'([^']+)'/.exec(tokens[token])?.[1];
        expect(family, token).toBeDefined();
        const file = declared.get(family!);
        expect(file, `@font-face of ${family}`).toBeDefined();
        expect(existsSync(resolve(process.cwd(), 'src/styles', file!)), `${file} exists`).toBe(true);
      }
    }
  });

  it('Fonts_NoThirdPartyFontServer_IsReferenced', () => {
    expect(`${tokensCss}\n${fontsCss}`).not.toMatch(/fonts\.googleapis|fonts\.gstatic|typekit|use\.fontawesome/i);
    expect(read('index.html')).not.toMatch(/fonts\.googleapis|fonts\.gstatic/i);
  });
});

/**
 * No fixed palette color (`bg-red-50`, `text-green-600`, `border-orange-200`...) in the pages of the public site: the colors come
 * from the tokens of the theme (`bg-[var(--cz-public-err-soft)]`, ...), so that a page reads on every theme and on a host's own
 * color. The files that still have some are listed with the page task that cleans them and a date: when the date passes with the
 * file still listed the test fails, and a file that no longer has any must leave the list.
 */
const FIXED_COLOR_SCOPE = ['src/features/public-booking', 'src/features/public-site'];

const FIXED_PALETTE_COLOR = new RegExp(
  `(?<![\\w-])(?:[a-z-]+:)*(?:bg|text|border|ring|fill|stroke|from|to|via|divide|outline|decoration|accent|caret|shadow|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d{2,3}(?:/\\d+)?`,
);

const FIXED_COLOR_EXCEPTIONS: Record<string, { task: string; until: string }> = {
  'src/features/public-booking/checkout-outcome-page.tsx': { task: 'DB-06b', until: '2027-01-31' },
  'src/features/public-booking/guest-bookings-page.tsx': { task: 'DB-06', until: '2027-01-31' },
  'src/features/public-booking/guest-messages-section.tsx': { task: 'DB-06', until: '2027-01-31' },
  'src/features/public-booking/onsite-request-confirm-page.tsx': { task: 'DB-06b', until: '2027-01-31' },
};

function sourceFiles(directory: string): string[] {
  return readdirSync(resolve(process.cwd(), directory), { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name).split('\\').join('/');
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path);
    return /\.(tsx?|css)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [path] : [];
  });
}

describe('fixed palette colors in the public site', () => {
  const withFixedColors = FIXED_COLOR_SCOPE.flatMap(sourceFiles).filter((file) =>
    read(file)
      .split('\n')
      .some((line) => FIXED_PALETTE_COLOR.test(line)),
  );

  it('FixedColors_PagesOfThePublicSite_UseTheTokensOrAreListedWithATask', () => {
    expect(withFixedColors.filter((file) => !FIXED_COLOR_EXCEPTIONS[file])).toEqual([]);
  });

  it('FixedColors_ListedFile_StillHasThem', () => {
    // A cleaned file must leave the list, or the list stops saying what is left to do.
    expect(Object.keys(FIXED_COLOR_EXCEPTIONS).filter((file) => !withFixedColors.includes(file))).toEqual([]);
  });

  it('FixedColors_ListedFile_IsNotPastItsDate', () => {
    const today = new Date().toISOString().slice(0, 10);
    const expired = Object.entries(FIXED_COLOR_EXCEPTIONS)
      .filter(([, { until }]) => today > until)
      .map(([file, { task, until }]) => `${file} (${task}, until ${until})`);
    expect(expired).toEqual([]);
  });
});
