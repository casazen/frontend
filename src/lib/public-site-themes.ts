/**
 * Themes of the public booking site (`Org.PublicThemeId`, spec US-023 AC2). Mirror of the backend
 * `Casazen.Core/Branding/PublicSiteThemes.cs` and of the `[data-theme]` blocks of `src/styles/public-tokens.css`:
 * keep the three in sync.
 */
export const PUBLIC_SITE_THEMES = ['mare', 'montagna', 'urban'] as const;

export type PublicSiteThemeId = (typeof PUBLIC_SITE_THEMES)[number];

/** Theme of an org that never chose one, and of any value this frontend does not support. */
export const DEFAULT_PUBLIC_SITE_THEME: PublicSiteThemeId = 'mare';

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
