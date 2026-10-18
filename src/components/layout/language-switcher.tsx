import { useTranslation } from 'react-i18next';
import { useAppLocale } from '@/hooks/use-app-locale';
import { Button } from '@/components/ui/button';

// Each button is at least 44 px tall and wide (WCAG 2.5.8): it used to be 28 px, too small for a finger. The switch lives in
// the sheet "Altro" of the phone (UI-05), where nothing is dense.
const BUTTON_CLASS = 'min-h-11 min-w-11 px-3 text-xs font-semibold';

/** The switch between Italian and English: two toggle buttons, the one of the current language pressed. */
export function LanguageSwitcher() {
  const { t } = useTranslation();
  const { locale, setLocale } = useAppLocale();

  return (
    <div
      data-testid="language-switcher"
      className="flex items-center gap-0.5 rounded-lg border bg-muted/40 p-0.5"
      role="group"
      aria-label={t('language.label')}
    >
      <Button
        type="button"
        variant={locale === 'it' ? 'default' : 'ghost'}
        size="sm"
        className={BUTTON_CLASS}
        aria-label={t('language.switchToItalian')}
        aria-pressed={locale === 'it'}
        onClick={() => setLocale('it')}
      >
        {t('language.italian')}
      </Button>
      <Button
        type="button"
        variant={locale === 'en' ? 'default' : 'ghost'}
        size="sm"
        className={BUTTON_CLASS}
        aria-label={t('language.switchToEnglish')}
        aria-pressed={locale === 'en'}
        onClick={() => setLocale('en')}
      >
        {t('language.english')}
      </Button>
    </div>
  );
}
