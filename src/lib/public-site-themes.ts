export const PUBLIC_SITE_THEMES = ['terra', 'mare', 'citta'] as const;

export type PublicSiteThemeId = (typeof PUBLIC_SITE_THEMES)[number];

export const DEFAULT_PUBLIC_SITE_THEME: PublicSiteThemeId = 'terra';

const LEGACY_THEME_ALIASES: Readonly<Record<string, PublicSiteThemeId>> = {
  montagna: 'terra',
  urban: 'citta',
};

export const PUBLIC_SITE_FONTS = ['editoriale', 'moderno', 'classico'] as const;

export type PublicSiteFontId = (typeof PUBLIC_SITE_FONTS)[number];

export const THEME_DEFAULT_FONT: Readonly<Record<PublicSiteThemeId, PublicSiteFontId>> = {
  terra: 'editoriale',
  mare: 'editoriale',
  citta: 'moderno',
};

export interface PublicSiteThemePalette {
  primary: string;
  onPrimary: string;
  primaryText: string;
  hover: string;
  ink: string;
  soft: string;
  bg: string;
  surface: string;
  surface2: string;
  surface3: string;
  text: string;
  muted: string;
  border: string;
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

export function resolvePublicSiteFont(value: string | null | undefined): PublicSiteFontId | null {
  const normalized = value?.trim().toLowerCase();
  return isPublicSiteFont(normalized) ? normalized : null;
}

const HEX_COLOR = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function normalizeHexColor(value: string | null | undefined): string | null {
  const match = HEX_COLOR.exec(value?.trim() ?? '');
  if (!match) return null;
  const hex = match[1].toLowerCase();
  return `#${hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex}`;
}
