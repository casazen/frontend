import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n/config';
import type { AppLocale } from '@/i18n/config';
import { persistLocale } from '@/lib/i18n-labels';

/**
 * The languages of the app, in the order they are offered, each with the key of its name (written in the language itself:
 * "Italiano", "English"). The keys are written out so that the i18n test finds a missing translation.
 */
export const APP_LOCALES: ReadonlyArray<{ locale: AppLocale; nameKey: string }> = [
  { locale: 'it', nameKey: 'language.names.it' },
  { locale: 'en', nameKey: 'language.names.en' },
];

/**
 * The language of the interface and the way to change it (UI-05): the choice is kept for the next visit and the whole app
 * (`<html lang>` included, `I18nLocaleSync`) follows. Used by the language row of the profile menu and by the switch of the
 * sheet "Altro".
 */
export function useAppLocale() {
  const { i18n: instance } = useTranslation();
  const locale: AppLocale = instance.language.startsWith('en') ? 'en' : 'it';

  const setLocale = useCallback(
    (next: AppLocale) => {
      if (next === locale) return;
      persistLocale(next);
      void i18n.changeLanguage(next);
    },
    [locale],
  );

  return { locale, setLocale };
}
