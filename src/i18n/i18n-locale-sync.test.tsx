import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import i18n from '@/i18n/config';
import { persistLocale } from '@/lib/i18n-labels';
import { I18nLocaleSync } from './i18n-locale-sync';

describe('I18nLocaleSync <html lang> (UI-03, a11y)', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('it');
    document.documentElement.lang = '';
  });

  afterEach(() => {
    cleanup();
    document.documentElement.lang = 'it';
  });

  it('I18nLocaleSync_Mounted_SetsTheLangOfTheDocumentToTheCurrentLanguage', () => {
    render(<I18nLocaleSync />);

    expect(document.documentElement.lang).toBe('it');
  });

  it('I18nLocaleSync_LanguageChanged_FollowsTheChoiceOfTheUser', async () => {
    render(<I18nLocaleSync />);

    await act(() => i18n.changeLanguage('en'));
    expect(document.documentElement.lang).toBe('en');

    await act(() => i18n.changeLanguage('it'));
    expect(document.documentElement.lang).toBe('it');
  });

  it('I18nLocaleSync_PersistedLocaleDiffersFromTheCurrentOne_AppliesItAndTheLang', async () => {
    persistLocale('en');

    await act(async () => {
      render(<I18nLocaleSync />);
    });

    expect(i18n.language).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('I18nLocaleSync_Unmounted_StopsFollowingTheLanguage', async () => {
    const { unmount } = render(<I18nLocaleSync />);
    unmount();

    await act(() => i18n.changeLanguage('en'));

    expect(document.documentElement.lang).toBe('it');
  });
});
