import { useTranslation } from 'react-i18next';
import i18n from '@/i18n/config';
import type { AppLocale } from '@/i18n/config';
import { persistLocale } from '@/lib/i18n-labels';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function LanguageSwitcher() {
  const { t, i18n: i18nInstance } = useTranslation();
  const current: AppLocale = i18nInstance.language.startsWith('en') ? 'en' : 'it';

  const setLocale = (locale: AppLocale) => {
    if (locale === current) return;
    persistLocale(locale);
    void i18n.changeLanguage(locale);
  };

  return (
    <div
      data-testid="language-switcher"
      className="flex items-center gap-0.5 rounded-md border bg-muted/40 p-0.5"
      role="group"
      aria-label="Language"
    >
      <Button
        type="button"
        variant={current === 'it' ? 'default' : 'ghost'}
        size="sm"
        className={cn('h-7 min-w-9 px-2 text-xs font-semibold')}
        aria-label={t('language.switchToItalian')}
        aria-pressed={current === 'it'}
        onClick={() => setLocale('it')}
      >
        {t('language.italian')}
      </Button>
      <Button
        type="button"
        variant={current === 'en' ? 'default' : 'ghost'}
        size="sm"
        className={cn('h-7 min-w-9 px-2 text-xs font-semibold')}
        aria-label={t('language.switchToEnglish')}
        aria-pressed={current === 'en'}
        onClick={() => setLocale('en')}
      >
        {t('language.english')}
      </Button>
    </div>
  );
}
