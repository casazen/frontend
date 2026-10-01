import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLegalLanguage, useSubprocessors } from '@/queries/use-legal';
import { useSeoMeta } from '@/lib/seo-meta';
import { formatLegalDate, LEGAL_INDEX_PATH } from './legal-paths';
import { SubprocessorPurpose } from './subprocessor-purpose';

/**
 * Public list of the subprocessors (GDPR art. 28, PLG-AC11, A1-06 / A9-40): built by the backend from the providers
 * the platform actually uses. Details the product owner has not confirmed yet are shown as pending, never guessed.
 */
export function SubprocessorsPage() {
  const { t } = useTranslation();
  const language = useLegalLanguage();
  const { data: document, isLoading, isError, refetch, isFetching } = useSubprocessors();

  useSeoMeta({ title: `${t('legal.subprocessors.title')} · CasaZen`, description: t('legal.subprocessors.summary') });

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" data-testid="subprocessors-loading">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label={t('legal.loading')} />
      </div>
    );
  }

  if (isError || !document) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 text-center" data-testid="subprocessors-error">
        <h1 className="text-2xl font-bold">{t('legal.subprocessors.title')}</h1>
        <p role="alert" className="mt-2 text-muted-foreground">
          {t('legal.loadError')}
        </p>
        <Button type="button" className="mt-4" onClick={() => void refetch()} disabled={isFetching}>
          {t('legal.retry')}
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8" data-testid="subprocessors-page">
      <p className="text-sm">
        <Link to={LEGAL_INDEX_PATH} className="underline hover:text-[var(--cz-public-primary)]">
          {t('legal.backToIndex')}
        </Link>
      </p>
      <header className="mb-6 mt-2">
        <h1 className="text-3xl font-bold">{t('legal.subprocessors.title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground" data-testid="subprocessors-version">
          {t('legal.version', { version: document.version })}
          {' · '}
          {document.effectiveAt
            ? t('legal.effectiveAt', { date: formatLegalDate(document.effectiveAt, language) })
            : t('legal.effectiveAtPending')}
        </p>
        <p className="mt-4">{t('legal.subprocessors.intro')}</p>
      </header>

      {document.items.length === 0 ? (
        <p className="rounded-md border p-4 text-muted-foreground" data-testid="subprocessors-empty">
          {t('legal.subprocessors.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-4">{t('legal.subprocessors.columns.name')}</th>
                <th className="py-2 pr-4">{t('legal.subprocessors.columns.purpose')}</th>
                <th className="py-2 pr-4">{t('legal.subprocessors.columns.entity')}</th>
                <th className="py-2 pr-4">{t('legal.subprocessors.columns.region')}</th>
                <th className="py-2">{t('legal.subprocessors.columns.transfer')}</th>
              </tr>
            </thead>
            <tbody>
              {document.items.map((item) => (
                <tr key={item.key ?? item.name} className="border-b align-top" data-testid={`subprocessor-row-${item.key ?? item.name}`}>
                  <td className="py-2 pr-4 font-medium">
                    {item.website ? (
                      <a href={item.website} target="_blank" rel="noopener noreferrer" className="underline">
                        {item.name}
                      </a>
                    ) : (
                      item.name
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <SubprocessorPurpose item={item} />
                  </td>
                  <td className="py-2 pr-4">{item.entity || <Pending />}</td>
                  <td className="py-2 pr-4">{item.region || <Pending />}</td>
                  <td className="py-2">{item.transferMechanism || <Pending />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Pending() {
  const { t } = useTranslation();
  return <span className="italic text-muted-foreground">{t('legal.subprocessors.pending')}</span>;
}
