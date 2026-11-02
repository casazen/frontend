/**
 * Themes and font pairs of the public booking site (`Org.PublicThemeId`, `Org.PublicFontId`, spec US-023 AC2, DB-01). Mirror
 * of the backend `Casazen.Core/Branding/PublicSiteThemes.cs` / `PublicSiteFonts.cs` and of the `[data-theme]` / `[data-font]`
 * blocks of `src/styles/public-tokens.css`: keep the three in sync (`src/styles/__tests__/public-tokens.test.ts` checks the
 * palette below against the CSS).
 */
export const PUBLIC_SITE_THEMES = ['terra', 'mare', 'citta'] as const;

export type PublicSiteThemeId = (typeof PUBLIC_SITE_THEMES)[number];

/** Theme of an org that never chose one, and of any value this frontend does not support. */
export const DEFAULT_PUBLIC_SITE_THEME: PublicSiteThemeId = 'terra';

/**
 * Ids of themes that existed before DB-01 and no longer name one, with the theme that replaces them. Read-only aliases for the
 * window between the migration of the backend (which rewrites the stored ids) and the deploy of this frontend, and for two
 * releases after it. `mare` is not here: the id is a supported theme again, with a new look.
 */
const LEGACY_THEME_ALIASES: Readonly<Record<string, PublicSiteThemeId>> = {
  montagna: 'terra',
  urban: 'citta',
};

/** The font pairs a host can choose, apart from the theme. */
export const PUBLIC_SITE_FONTS = ['editoriale', 'moderno', 'classico'] as const;

export type PublicSiteFontId = (typeof PUBLIC_SITE_FONTS)[number];

/** The font pair each theme starts with: what an org that never chose one gets (the same values the theme blocks of the CSS set). */
export const THEME_DEFAULT_FONT: Readonly<Record<PublicSiteThemeId, PublicSiteFontId>> = {
  terra: 'editoriale',
  mare: 'editoriale',
  citta: 'moderno',
};

/**
 * The colors of each theme, mirror of the `--cz-public-*` tokens of `public-tokens.css`. The CSS is what renders; this
 * copy lets the code compute contrast against the page and card colors (`src/lib/public-site-colors.ts`) when a host
 * chooses its own primary color.
 */
export interface PublicSiteThemePalette {
  /** `--cz-public-primary`: fill of buttons and accents. */
  primary: string;
  /** `--cz-public-on-primary`: text on a primary fill. */
  onPrimary: string;
  /** `--cz-public-primary-text`: the primary as text, link hover and focus ring. */
  primaryText: string;
  /** `--cz-public-hover`: the primary fill under the pointer. */
  hover: string;
  /** `--cz-public-ink`: the primary as text on its own soft tint (and on the page). */
  ink: string;
  /** `--cz-public-soft`: the faint tint of the primary (pills, selected rows). */
  soft: string;
  /** `--cz-public-bg`: page background. */
  bg: string;
  /** `--cz-public-surface`: cards, header and widgets. */
  surface: string;
  /** `--cz-public-surface-2`: tinted surface (sunken blocks, bars). */
  surface2: string;
  /** `--cz-public-surface-3`: the deeper tinted surface. */
  surface3: string;
  /** `--cz-public-text`. */
  text: string;
  /** `--cz-public-muted`: secondary text. */
  muted: string;
  /** `--cz-public-border`: the hairline. */
  border: string;
  /** `--cz-public-line-strong`: the line of a field or divider that has to show. */
  lineStrong: string;
}

export const PUBLIC_SITE_THEME_PALETTES: Record<PublicSiteThemeId, PublicSiteThemePalette> = {
  terra: {
    primary: '#a3431f',
    onPrimary: '#ffffff',
    primaryText: '#a3431f',
    hover: '#8c3819',
    ink: '#8c3819',
    soft: '#f6e2d7',
    bg: '#f6f1e9',
    surface: '#fffdf9',
    surface2: '#efe6d9',
    surface3: '#e7dccb',
    text: '#1f2a30',
    muted: '#56616a',
    border: '#e2d6c5',
    lineStrong: '#cfc0aa',
  },
  mare: {
    primary: '#0f5e73',
    onPrimary: '#ffffff',
    primaryText: '#0f5e73',
    hover: '#0b4a5b',
    ink: '#0b4a5b',
    soft: '#dceef1',
    bg: '#f3f7f6',
    surface: '#ffffff',
    surface2: '#e4eeec',
    surface3: '#d6e6e3',
    text: '#12303a',
    muted: '#4d6169',
    border: '#d3e2df',
    lineStrong: '#b4cfca',
  },
  citta: {
    primary: '#2e2a26',
    onPrimary: '#ffffff',
    primaryText: '#2e2a26',
    hover: '#171513',
    ink: '#2e2a26',
    soft: '#e9e4dd',
    bg: '#f5f3f0',
    surface: '#ffffff',
    surface2: '#eae6e0',
    surface3: '#ddd7cf',
    text: '#1e1c1a',
    muted: '#5a554f',
    border: '#dad4cb',
    lineStrong: '#bdb5a9',
  },
};

export function isPublicSiteTheme(value: unknown): value is PublicSiteThemeId {
  return typeof value === 'string' && (PUBLIC_SITE_THEMES as readonly string[]).includes(value);
}

/**
 * The theme to render for a stored value: the value when supported, the replacement of an id from before DB-01 (`montagna`,
 * `urban`), otherwise the default theme.
 */
export function resolvePublicSiteTheme(value: string | null | undefined): PublicSiteThemeId {
  const normalized = value?.trim().toLowerCase();
  if (isPublicSiteTheme(normalized)) return normalized;
  return (normalized ? LEGACY_THEME_ALIASES[normalized] : undefined) ?? DEFAULT_PUBLIC_SITE_THEME;
}

export function isPublicSiteFont(value: unknown): value is PublicSiteFontId {
  return typeof value === 'string' && (PUBLIC_SITE_FONTS as readonly string[]).includes(value);
}

/**
 * The font pair a host chose, or null for "the font of the theme" (nothing chosen, or a value this frontend does not know).
 * Only a supported id ever reaches the `data-font` attribute of the page.
 */
export function resolvePublicSiteFont(value: string | null | undefined): PublicSiteFontId | null {
  const normalized = value?.trim().toLowerCase();
  return isPublicSiteFont(normalized) ? normalized : null;
}

const HEX_COLOR = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * `#rrggbb` (lower case) for a hex color in `#rgb`/`#rrggbb` form, with or without `#`; null for anything else.
 * Mirror of `OrgBrandingRules.NormalizePrimaryColor`: only a hex color ever reaches a CSS custom property.
 */
export function normalizeHexColor(value: string | null | undefined): string | null {
  const match = HEX_COLOR.exec(value?.trim() ?? '');
  if (!match) return null;
  const hex = match[1].toLowerCase();
  return `#${hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex}`;
}
