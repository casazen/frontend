import { describe, expect, it } from 'vitest';
import {
  AA_TEXT_CONTRAST,
  analyzePrimaryColor,
  contrastRatio,
  publicSiteColorStyle,
  publicSiteColorVars,
  readableOnSurfaces,
  readableTextOn,
  relativeLuminance,
} from '../public-site-colors';
import { PUBLIC_SITE_THEMES, PUBLIC_SITE_THEME_PALETTES } from '../public-site-themes';

/** A coarse grid over the whole RGB cube (7 steps per channel = 343 colors) plus the greys and the extremes. */
const STEPS = [0, 42, 85, 128, 170, 213, 255];
const GRID_COLORS = STEPS.flatMap((r) =>
  STEPS.flatMap((g) => STEPS.map((b) => `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`)),
);

describe('contrastRatio', () => {
  it('contrastRatio_BlackOnWhite_Is21', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
  });

  it('contrastRatio_SameColor_Is1', () => {
    expect(contrastRatio('#e07a5f', '#e07a5f')).toBeCloseTo(1, 5);
  });

  it('contrastRatio_WhiteOnOldCtaColor_IsBelowAA_AsInTheAudit', () => {
    // A3-32: white on #e07a5f was 2.95:1.
    const ratio = contrastRatio('#ffffff', '#e07a5f');
    expect(ratio).toBeGreaterThan(2.9);
    expect(ratio).toBeLessThan(3);
  });

  it('relativeLuminance_ShortHexAndUpperCase_AreNormalized', () => {
    expect(relativeLuminance('#FFF')).toBeCloseTo(1, 5);
    expect(relativeLuminance('000')).toBeCloseTo(0, 5);
  });
});

describe('readableTextOn', () => {
  it('readableTextOn_DarkFill_ChoosesWhite', () => {
    expect(readableTextOn('#1a6b8f').color).toBe('#ffffff');
  });

  it('readableTextOn_OldCtaColor_ChoosesDarkTextMeetingAA', () => {
    const { color, ratio } = readableTextOn('#e07a5f');
    expect(color).not.toBe('#ffffff');
    expect(ratio).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
  });

  it('readableTextOn_MidToneWhereNearBlackIsNotEnough_FallsBackToPureBlack', () => {
    // Luminance about 0.19: white and #111827 both stay below 4.5:1, black does not.
    const { color, ratio } = readableTextOn('#7a7a7a');
    expect(contrastRatio('#ffffff', '#7a7a7a')).toBeLessThan(AA_TEXT_CONTRAST);
    expect(contrastRatio('#111827', '#7a7a7a')).toBeLessThan(AA_TEXT_CONTRAST + 1);
    expect(ratio).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
    expect(['#111827', '#000000']).toContain(color);
  });

  it('readableTextOn_AnyColorOfTheRgbGrid_MeetsAA', () => {
    for (const fill of GRID_COLORS) {
      const { color, ratio } = readableTextOn(fill);
      expect(ratio, `text ${color} on ${fill}`).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
      expect(contrastRatio(color, fill)).toBeCloseTo(ratio, 5);
    }
  });
});

describe('readableOnSurfaces', () => {
  it('readableOnSurfaces_ColorAlreadyReadable_IsReturnedUnchanged', () => {
    expect(readableOnSurfaces('#1a6b8f', ['#ffffff', '#f6f1e7'])).toBe('#1a6b8f');
  });

  it('readableOnSurfaces_ColorTooLight_IsDarkenedUntilItMeetsTheMinimumOnEverySurface', () => {
    const surfaces = ['#ffffff', '#f6f1e7'];
    const result = readableOnSurfaces('#ffd700', surfaces);

    expect(result).not.toBe('#ffd700');
    for (const surface of surfaces) {
      expect(contrastRatio(result, surface)).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
    }
  });

  it('readableOnSurfaces_AnyColorOfTheRgbGrid_MeetsAAOnEveryThemeBackgroundAndCard', () => {
    for (const themeId of PUBLIC_SITE_THEMES) {
      const { bg, surface } = PUBLIC_SITE_THEME_PALETTES[themeId];
      for (const color of GRID_COLORS) {
        const result = readableOnSurfaces(color, [bg, surface]);
        expect(contrastRatio(result, bg), `${color} -> ${result} on ${themeId} bg`).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
        expect(contrastRatio(result, surface), `${color} -> ${result} on ${themeId} card`).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
      }
    }
  });
});

describe('analyzePrimaryColor', () => {
  it('analyzePrimaryColor_NotHex_ReturnsNull', () => {
    expect(analyzePrimaryColor('red', 'mare')).toBeNull();
    expect(analyzePrimaryColor('', 'mare')).toBeNull();
  });

  it('analyzePrimaryColor_DarkColor_KeepsItAsTextAndUsesWhiteOnIt', () => {
    const analysis = analyzePrimaryColor('#1A6B8F', 'montagna');

    expect(analysis).toMatchObject({
      primary: '#1a6b8f',
      onPrimary: '#ffffff',
      primaryText: '#1a6b8f',
      primaryTextAdjusted: false,
    });
    expect(analysis!.onPrimaryRatio).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
  });

  it('analyzePrimaryColor_LightColor_ReportsTheDarkerTextVariant', () => {
    const analysis = analyzePrimaryColor('#f4d03f', 'mare');

    expect(analysis!.primary).toBe('#f4d03f');
    expect(analysis!.onPrimary).not.toBe('#ffffff');
    expect(analysis!.primaryTextAdjusted).toBe(true);
    expect(analysis!.primaryText).not.toBe('#f4d03f');
  });
});

describe('publicSiteColorVars', () => {
  it('publicSiteColorVars_NoColor_IsNullSoTheThemeColorsApply', () => {
    expect(publicSiteColorVars(null, 'mare')).toBeNull();
    expect(publicSiteColorVars(undefined, 'urban')).toBeNull();
    expect(publicSiteColorStyle(null, 'mare')).toBeUndefined();
  });

  it('publicSiteColorVars_NotHex_IsNullAndNeverReachesCss', () => {
    expect(publicSiteColorVars('red;background:url(x)', 'mare')).toBeNull();
  });

  it('publicSiteColorVars_HostColor_SetsColorTextOnItAndReadableVariant', () => {
    expect(publicSiteColorVars('#E07A5F', 'mare')).toEqual({
      '--cz-public-primary': '#e07a5f',
      '--cz-public-on-primary': expect.stringMatching(/^#[0-9a-f]{6}$/),
      '--cz-public-primary-text': expect.stringMatching(/^#[0-9a-f]{6}$/),
    });
  });
});
