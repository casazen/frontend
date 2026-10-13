import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PUBLIC_SITE_THEME,
  PUBLIC_SITE_THEMES,
  normalizeHexColor,
  resolvePublicSiteTheme,
} from '../public-site-themes';

describe('public-site-themes', () => {
  it('PUBLIC_SITE_THEMES_MirrorsBackend_ListsTheThreeSupportedThemes', () => {
    expect(PUBLIC_SITE_THEMES).toEqual(['mare', 'montagna', 'urban']);
    expect(DEFAULT_PUBLIC_SITE_THEME).toBe('mare');
  });

  it.each([
    ['montagna', 'montagna'],
    [' Urban ', 'urban'],
    [null, 'mare'],
    [undefined, 'mare'],
    ['collina', 'mare'],
  ])('resolvePublicSiteTheme_%s_Returns%s', (input, expected) => {
    expect(resolvePublicSiteTheme(input)).toBe(expected);
  });

  it.each([
    ['#1A6B8F', '#1a6b8f'],
    ['1a6b8f', '#1a6b8f'],
    [' #abc ', '#aabbcc'],
  ])('normalizeHexColor_HexColor_%s_Returns%s', (input, expected) => {
    expect(normalizeHexColor(input)).toBe(expected);
  });

  it.each(['', null, 'red', '#12345', '#1a6b8f80', 'red;}body{'])('normalizeHexColor_NotHex_%s_ReturnsNull', (input) => {
    expect(normalizeHexColor(input)).toBeNull();
  });
});
