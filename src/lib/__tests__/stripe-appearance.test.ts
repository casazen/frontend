import { describe, expect, it } from 'vitest';
import { PUBLIC_SITE_THEMES, PUBLIC_SITE_THEME_PALETTES } from '../public-site-themes';
import { publicSiteColorVars } from '../public-site-colors';
import { stripeAppearance, stripeLocale } from '../stripe-appearance';

describe('stripeAppearance', () => {
  it.each(PUBLIC_SITE_THEMES)('stripeAppearance_%s_UsesThePaletteOfTheTheme', (themeId) => {
    const palette = PUBLIC_SITE_THEME_PALETTES[themeId];
    const { variables } = stripeAppearance(themeId);

    expect(variables).toMatchObject({
      colorPrimary: palette.primary,
      colorBackground: palette.surface,
      colorText: palette.text,
      colorTextSecondary: palette.muted,
    });
  });

  it('stripeAppearance_HostColor_WinsOverTheColorOfTheTheme', () => {
    const hostVars = publicSiteColorVars('#1A6B8F', 'terra');

    expect(stripeAppearance('terra', hostVars).variables?.colorPrimary).toBe('#1a6b8f');
    expect(stripeAppearance('terra', null).variables?.colorPrimary).toBe(PUBLIC_SITE_THEME_PALETTES.terra.primary);
  });

  it('stripeAppearance_Themes_HaveTheirOwnFieldRadius', () => {
    const radii = PUBLIC_SITE_THEMES.map((themeId) => stripeAppearance(themeId).variables?.borderRadius);

    expect(new Set(radii).size).toBe(PUBLIC_SITE_THEMES.length);
  });
});

describe('stripeLocale', () => {
  it.each([
    ['en', 'en'],
    ['en-GB', 'en'],
    [' EN ', 'en'],
    ['it', 'it'],
    ['it-IT', 'it'],
    ['fr', 'it'],
    [null, 'it'],
    [undefined, 'it'],
  ])('stripeLocale_%s_Returns%s', (language, expected) => {
    expect(stripeLocale(language)).toBe(expected);
  });
});
