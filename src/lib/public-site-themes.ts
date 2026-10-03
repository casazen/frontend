/**
 * Themes of the public booking site (`Org.PublicThemeId`, spec US-023 AC2). Mirror of the backend
 * `Casazen.Core/Branding/PublicSiteThemes.cs` and of the `[data-theme]` blocks of `src/styles/public-tokens.css`:
 * keep the three in sync (`src/styles/__tests__/public-tokens.test.ts` checks the palette below against the CSS).
 */
export const PUBLIC_SITE_THEMES = ['mare', 'montagna', 'urban'] as const;

export type PublicSiteThemeId = (typeof PUBLIC_SITE_THEMES)[number];

/** Theme of an org that never chose one, and of any value this frontend does not support. */
export const DEFAULT_PUBLIC_SITE_THEME: PublicSiteThemeId = 'mare';

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
  /** `--cz-public-bg`: page background. */
  bg: string;
  /** `--cz-public-surface`: cards, header and widgets. */
  surface: string;
  /** `--cz-public-text`. */
  text: string;
  /** `--cz-public-muted`: secondary text. */
  muted: string;
}

export const PUBLIC_SITE_THEME_PALETTES: Record<PublicSiteThemeId, PublicSiteThemePalette> = {
  mare: {
    primary: '#b4492f',
    onPrimary: '#ffffff',
    primaryText: '#b4492f',
    bg: '#f6f1e7',
    surface: '#ffffff',
    text: '#16324f',
    muted: '#52606d',
  },
  montagna: {
    primary: '#2e6a4a',
    onPrimary: '#ffffff',
    primaryText: '#2e6a4a',
    bg: '#edf1ea',
    surface: '#fbfcfa',
    text: '#1c2b22',
    muted: '#4a5a50',
  },
  urban: {
    primary: '#2f3bd1',
    onPrimary: '#ffffff',
    primaryText: '#2f3bd1',
    bg: '#f1f2f4',
    surface: '#ffffff',
    text: '#111318',
    muted: '#555b66',
  },
};

export function isPublicSiteTheme(value: unknown): value is PublicSiteThemeId {
  return typeof value === 'string' && (PUBLIC_SITE_THEMES as readonly string[]).includes(value);
}

/** The theme to render for a stored value: the value when supported, otherwise the default theme. */
export function resolvePublicSiteTheme(value: string | null | undefined): PublicSiteThemeId {
  const normalized = value?.trim().toLowerCase();
  return isPublicSiteTheme(normalized) ? normalized : DEFAULT_PUBLIC_SITE_THEME;
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
