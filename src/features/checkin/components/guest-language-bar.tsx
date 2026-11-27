import { useTranslation } from 'react-i18next';
import type { PublicCheckInContextDto } from '@/types/public-checkin.types';
import { offeredGuestLocales, type GuestLocale } from '../lib/guest-locale';
import { LanguageSwitcher } from './language-switcher';

/** The language of the page: the switcher and what it says when the choice could not be saved or the texts could not be loaded. */
export function GuestLanguageBar({ locale, chooseLanguage, context, languageNotSaved, languageNotLoaded }: {
  locale: GuestLocale;
  chooseLanguage: (locale: GuestLocale) => void;
  context: PublicCheckInContextDto | undefined;
  languageNotSaved: boolean;
  languageNotLoaded: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1">
      <LanguageSwitcher
        value={locale}
        onChange={chooseLanguage}
        locales={offeredGuestLocales(context?.supportedLanguages)}
      />
      {languageNotSaved && (
        <p role="status" className="text-right text-xs text-muted-foreground" data-testid="checkin-language-not-saved">
          {t('checkin.language.notSaved')}
        </p>
      )}
      {languageNotLoaded && (
        <p role="status" className="text-right text-xs text-muted-foreground" data-testid="checkin-language-not-loaded">
          {t('checkin.language.loadFailed')}
        </p>
      )}
    </div>
  );
}
