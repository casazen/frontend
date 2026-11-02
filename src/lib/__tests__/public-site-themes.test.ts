import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PUBLIC_SITE_THEME,
  PUBLIC_SITE_FONTS,
  PUBLIC_SITE_THEMES,
  THEME_DEFAULT_FONT,
  normalizeHexColor,
  resolvePublicSiteFont,
  resolvePublicSiteTheme,
} from '../public-site-themes';

describe('public-site-themes', () => {
  it('PUBLIC_SITE_THEMES_MirrorsBackend_ListsTheThreeSupportedThemes', () => {
    expect(PUBLIC_SITE_THEMES).toEqual(['terra', 'mare', 'citta']);
    expect(DEFAULT_PUBLIC_SITE_THEME).toBe('terra');
    expect(PUBLIC_SITE_FONTS).toEqual(['editoriale', 'moderno', 'classico']);
    expect(THEME_DEFAULT_FONT).toEqual({ terra: 'editoriale', mare: 'editoriale', citta: 'moderno' });
  });

  it.each([
    ['terra', 'terra'],
    [' Mare ', 'mare'],
    ['CITTA', 'citta'],
    // Ids from before DB-01, read as the theme that replaces them (the backend rewrites the stored ones).
    ['montagna', 'terra'],
    [' Urban ', 'citta'],
    [null, 'terra'],
    [undefined, 'terra'],
    ['collina', 'terra'],
  ])('resolvePublicSiteTheme_%s_Returns%s', (input, expected) => {
    expect(resolvePublicSiteTheme(input)).toBe(expected);
  });

  it.each([
    ['editoriale', 'editoriale'],
    [' Classico ', 'classico'],
    ['MODERNO', 'moderno'],
    [null, null],
    [undefined, null],
    ['comic-sans', null],
  ])('resolvePublicSiteFont_%s_Returns%s', (input, expected) => {
    expect(resolvePublicSiteFont(input)).toBe(expected);
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
