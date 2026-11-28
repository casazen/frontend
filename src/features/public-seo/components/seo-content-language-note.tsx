import { useTranslation } from 'react-i18next';

const ITALIAN = 'it';

interface SeoContentLanguageNoteProps {
  contentLanguage: string;
}

/**
 * The guides are written in Italian: to a visitor reading the app in another language it says so, instead of leaving an
 * untranslated text unexplained (SE-05, A8-19). Nothing for an Italian visitor or for a text in another language.
 */
export function SeoContentLanguageNote({ contentLanguage }: SeoContentLanguageNoteProps) {
  const { t, i18n } = useTranslation();
  const uiLanguage = (i18n.resolvedLanguage ?? i18n.language ?? '').split('-')[0];
  if (contentLanguage !== ITALIAN || uiLanguage === ITALIAN) return null;

  return (
    <p
      role="note"
      className="mb-4 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
      data-testid="seo-content-language-note"
    >
      {t('publicSeo.contentLanguageNote')}
    </p>
  );
}
