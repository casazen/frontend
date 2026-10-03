import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSeoMeta } from '@/lib/seo-meta';
import { LEGAL_DOCUMENT_KEYS, LEGAL_DOCUMENT_PATHS, LEGAL_SUBPROCESSORS_PATH } from './legal-paths';

/** Index of the CasaZen legal documents (PL-14). */
export function LegalIndexPage() {
  const { t } = useTranslation();
  useSeoMeta({ title: `${t('legal.indexTitle')} · CasaZen`, description: t('legal.indexIntro') });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8" data-testid="legal-index-page">
      <h1 className="text-3xl font-bold">{t('legal.indexTitle')}</h1>
      <p className="mt-2 text-muted-foreground">{t('legal.indexIntro')}</p>
      <ul className="mt-6 space-y-4">
        {LEGAL_DOCUMENT_KEYS.map((key) => (
          <li key={key}>
            <Link to={LEGAL_DOCUMENT_PATHS[key]} className="text-lg underline hover:text-[var(--cz-public-primary-text)]">
              {t(`legal.documents.${key}.title`)}
            </Link>
            <p className="text-sm text-muted-foreground">{t(`legal.documents.${key}.summary`)}</p>
          </li>
        ))}
        <li>
          <Link to={LEGAL_SUBPROCESSORS_PATH} className="text-lg underline hover:text-[var(--cz-public-primary-text)]">
            {t('legal.subprocessors.title')}
          </Link>
          <p className="text-sm text-muted-foreground">{t('legal.subprocessors.summary')}</p>
        </li>
      </ul>
    </main>
  );
}
