import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { APP_LOCALES, useAppLocale } from '@/hooks/use-app-locale';
import type { AppLocale } from '@/i18n/locale-storage';
import { SITE_LANGUAGE_QUERY_KEY } from '@/lib/site-language';
import { cn } from '@/lib/utils';
import './public-site-chrome.css';

/**
 * The switch between Italian and English of the booking site (DB-02b): two buttons, "IT" and "EN", the one of the language in
 * use pressed (`aria-pressed`), each marked with its own language (`lang`) so that a screen reader says "Italiano" and "English" in
 * the right voice. The choice is kept for the next visit, changes the language of the interface and `<html lang>` (the app does,
 * `useAppLocale`), and goes in the address (`?lang=`), so that a link that is sent opens in that language.
 */
export function LanguageSwitch({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { locale, setLocale } = useAppLocale();
  const [, setSearchParams] = useSearchParams();

  const choose = (next: AppLocale) => {
    setLocale(next);
    setSearchParams(
      (current) => {
        const updated = new URLSearchParams(current);
        updated.set(SITE_LANGUAGE_QUERY_KEY, next);
        return updated;
      },
      { replace: true },
    );
  };

  return (
    <div role="group" aria-label={t('language.label')} className={cn('public-lang inline-flex', className)} data-testid="site-language-switch">
      {APP_LOCALES.map(({ locale: code, nameKey }) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={locale === code}
          aria-label={t(nameKey)}
          onClick={() => choose(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
