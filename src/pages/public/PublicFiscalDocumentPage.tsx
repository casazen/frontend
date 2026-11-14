import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Download, FileText, Link2Off, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/features/checkin/components/language-switcher';
import { useGuestPageLocale, type GuestLocale } from '@/features/checkin/lib/guest-locale';
import { MarketingLinkCard } from '@/features/public-marketing/marketing-link-card';
import { readPersistedLocale } from '@/lib/i18n-labels';
import { useSeoMeta } from '@/lib/seo-meta';
import { siteLocale } from '@/lib/site-language';
import { formatStayDate } from '@/lib/stay-dates';
import { useDownloadPublicFiscalDocument, usePublicFiscalDocument } from '@/queries/use-public-fiscal-document';

/** The languages the page has texts for: Italian and English. */
const PAGE_LOCALES: readonly GuestLocale[] = ['it', 'en'];

/**
 * The language the page opens in, until the guest chooses: the one they chose before (kept in the browser), else the first language of the browser that the
 * page has texts for, else English for a browser in any other language (the e-mail of the document goes in English to a guest of another country), and Italian
 * when the browser says nothing at all.
 */
function openingLocale(): GuestLocale {
  const stored = readPersistedLocale();
  if (stored) return stored;
  const tags = navigator.languages?.length ? navigator.languages : navigator.language ? [navigator.language] : [];
  for (const tag of tags) {
    const language = tag.trim().toLowerCase().split(/[-_]/)[0];
    if (language === 'it' || language === 'en') return language;
  }
  return tags.length > 0 ? 'en' : 'it';
}

/** The words of the kind of the document; a kind the page does not know is a plain «document». */
function kindLabel(kind: string, t: TFunction): string {
  switch (kind) {
    case 'Invoice':
      return t('publicFiscalDocument.kind.invoice');
    case 'Receipt':
      return t('publicFiscalDocument.kind.receipt');
    case 'CreditNote':
      return t('publicFiscalDocument.kind.creditNote');
    default:
      return t('publicFiscalDocument.kind.other');
  }
}

/**
 * The total as the document says it: in the currency of the document, in the language of the page, with no sum, no rounding to another unit and no conversion. The
 * currency comes only from the data: a document that carries none is shown without a symbol (never an assumed euro) and the page says so, and a currency that is
 * not a code is written after the number as it came.
 */
function formatTotal(total: number, currency: string | null, locale: string): string {
  // More decimals than any currency has, so that a figure the server wrote is never cut by the format: what it sends is what is shown.
  const plain = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(total);
  if (currency === null) return plain;
  if (!/^[A-Za-z]{3}$/.test(currency)) return `${plain} ${currency}`;
  return new Intl.NumberFormat(locale, { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 4 }).format(total);
}

/**
 * The page of the document the guest got by e-mail, `/documents/view/:documentId?token=…` (E12/F02/US02/T01): its summary (kind, number, day, total in its
 * currency) and the download of its PDF, with no sign-in. The token of the link is the only access check and is the secret of the page: it is read once, taken
 * out of the address bar (it must not stay in a bookmark, a shared address or the history), kept in the memory of the open page only and sent in the body of the
 * two calls and nowhere else: never stored, never in a key or a link, never in a log. So opening the page again, without the token, asks for the link of the e-mail again.
 *
 * Whatever goes wrong (a token that is wrong, expired or of another document, a document that is not there, a failed read or download) is the same calm page, with no
 * detail and no data of the document, whatever a query still holds. The page opens in the language of the guest's browser, with a visible choice between Italian
 * and English that lives for the page only. A guest's page, not the host's console: no menu, no link to an account, not indexed.
 */
export function PublicFiscalDocumentPage() {
  const { t } = useTranslation();
  const { documentId = '' } = useParams<{ documentId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [token] = useState(() => searchParams.get('token')?.trim() ?? '');
  useEffect(() => {
    if (!searchParams.has('token')) return;
    const rest = new URLSearchParams(searchParams);
    rest.delete('token');
    setSearchParams(rest, { replace: true });
  }, [searchParams, setSearchParams]);

  const [opened] = useState(openingLocale);
  const [chosen, setChosen] = useState<GuestLocale | null>(null);
  const locale = chosen ?? opened;
  useGuestPageLocale(locale);
  useSeoMeta({ title: t('publicFiscalDocument.title'), noindex: true });

  const summary = usePublicFiscalDocument(documentId, token);
  const download = useDownloadPublicFiscalDocument(documentId, token);

  const languageSwitcher = (
    <div className="pt-1">
      <LanguageSwitcher value={locale} onChange={setChosen} locales={PAGE_LOCALES} />
    </div>
  );

  // The failure comes before the data: a query keeps its old data when a later read fails, and a link that no longer works is not a document that is shown.
  if (token === '' || documentId === '' || summary.isError || download.isError) {
    return (
      <MarketingLinkCard
        state="invalid"
        tone="broken"
        icon={Link2Off}
        title={t('publicFiscalDocument.invalid.title')}
        description={t('publicFiscalDocument.invalid.description')}
        testId="public-document-page"
      >
        {languageSwitcher}
      </MarketingLinkCard>
    );
  }

  const { data } = summary;
  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4" data-testid="public-document-page" data-state="loading">
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
          {t('publicFiscalDocument.loading')}
        </p>
      </main>
    );
  }

  const formatLocale = siteLocale(locale);
  const day = formatStayDate(data.issueDate, formatLocale) || data.issueDate;

  return (
    <MarketingLinkCard
      state="ready"
      tone="ask"
      icon={FileText}
      title={t('publicFiscalDocument.title')}
      description={t('publicFiscalDocument.description')}
      testId="public-document-page"
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm" data-testid="public-document-summary">
        <dt className="text-muted-foreground">{t('publicFiscalDocument.summary.kind')}</dt>
        <dd className="break-words text-right font-medium">{kindLabel(data.kind, t)}</dd>
        <dt className="text-muted-foreground">{t('publicFiscalDocument.summary.number')}</dt>
        <dd className="break-words text-right font-medium">{data.number}</dd>
        <dt className="text-muted-foreground">{t('publicFiscalDocument.summary.date')}</dt>
        <dd className="text-right font-medium">{day}</dd>
        <dt className="border-t pt-2 text-muted-foreground">{t('publicFiscalDocument.summary.total')}</dt>
        <dd className="border-t pt-2 text-right text-base font-semibold tabular-nums" data-testid="public-document-total">
          {formatTotal(data.total, data.currency, formatLocale)}
        </dd>
      </dl>
      {data.currency === null ? (
        <p className="text-xs text-muted-foreground" data-testid="public-document-no-currency">
          {t('publicFiscalDocument.noCurrency')}
        </p>
      ) : null}
      <Button
        block
        size="lg"
        loading={download.isPending}
        onClick={() => download.mutate({ language: locale, number: data.number })}
        data-testid="public-document-download"
      >
        <Download aria-hidden="true" className="size-4" />
        {t('publicFiscalDocument.download')}
      </Button>
      {languageSwitcher}
    </MarketingLinkCard>
  );
}
