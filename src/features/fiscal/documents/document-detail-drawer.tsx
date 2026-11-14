import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/shared/error-state';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { FeatureFlags } from '@/config/feature-flags';
import { getHttpStatus } from '@/lib/api-errors';
import { cn } from '@/lib/utils';
import { useFiscalDocument } from '@/queries/use-fiscal-documents';
import type { FiscalDocumentDetail } from '@/types';
import { DocumentActionBar, type DocumentChange } from './document-actions';
import {
  bookingLinkOf,
  documentNameOf,
  documentsReadOf,
  documentSourceKey,
  formatDocumentAmount,
  formatDocumentDay,
  formatDocumentRate,
  lineTypeKey,
  paymentWordsOf,
  vatSummaryOf,
} from './document-model';
import { DocumentStateBadge, StatePill } from './document-state-badge';

const LINK = 'rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** A block of the detail: a small title and what it holds. */
function Block({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <section className="space-y-2" data-testid={testId}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

/** One line of a list of totals: what it is on the left, the figure on the right. */
function TotalRow({ label, children, strong = false, testId }: { label: string; children: ReactNode; strong?: boolean; testId?: string }) {
  return (
    <div className={cn('flex min-w-0 items-baseline justify-between gap-4', strong && 'border-t border-border pt-2 font-semibold')}>
      <dt className={strong ? undefined : 'text-foreground/70'}>{label}</dt>
      <dd className="whitespace-nowrap tabular-nums" data-testid={testId}>
        {children}
      </dd>
    </div>
  );
}

const TH = 'px-2 py-2 text-left font-medium text-foreground/70';
const TH_NUM = 'px-2 py-2 text-right font-medium text-foreground/70';
const TD = 'px-2 py-2 align-top';
const TD_NUM = 'px-2 py-2 text-right align-top tabular-nums';

/** The lines of the document, each with its type when the server says it, its amount without VAT and its rate. Every amount is in the currency of the document. */
function LinesBlock({ detail, language }: { detail: FiscalDocumentDetail; language: string }) {
  const { t } = useTranslation();
  const money = (amount: number) => formatDocumentAmount(amount, detail.currency, language);

  return (
    <Block title={t('fiscalDocuments.detail.lines.title')} testId="fiscal-document-lines-block">
      {detail.lines.length === 0 ? (
        <p className="text-sm text-foreground/70" data-testid="fiscal-document-no-lines">
          {t('fiscalDocuments.detail.lines.none')}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="fiscal-document-lines">
            <caption className="sr-only">{t('fiscalDocuments.detail.lines.title')}</caption>
            <thead>
              <tr className="border-b">
                <th scope="col" className={TH}>
                  {t('fiscalDocuments.detail.lines.description')}
                </th>
                <th scope="col" className={TH_NUM}>
                  {t('fiscalDocuments.detail.lines.quantity')}
                </th>
                <th scope="col" className={TH_NUM}>
                  {t('fiscalDocuments.detail.lines.amount')}
                </th>
                <th scope="col" className={TH_NUM}>
                  {t('fiscalDocuments.detail.lines.rate')}
                </th>
              </tr>
            </thead>
            <tbody>
              {detail.lines.map((line) => {
                const typeKey = lineTypeKey(line.lineType);
                return (
                  <tr key={line.lineNumber} className="border-b last:border-0" data-testid="fiscal-document-line">
                    <td className={cn(TD, 'min-w-0 break-words')}>
                      <span className="block">{line.description}</span>
                      {line.lineType !== null ? (
                        <span className="block text-xs text-foreground/70" data-testid="fiscal-document-line-type">
                          {typeKey ? t(typeKey) : line.lineType}
                        </span>
                      ) : null}
                    </td>
                    <td className={TD_NUM}>{new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(line.quantity)}</td>
                    <td className={TD_NUM} data-testid="fiscal-document-line-amount">
                      {money(line.totalPrice)}
                    </td>
                    <td className={TD_NUM}>
                      {line.vatRatePercent === 0
                        ? line.vatNatureCode
                          ? t('fiscalDocuments.detail.rate.noVatNature', { code: line.vatNatureCode })
                          : t('fiscalDocuments.detail.rate.noVat')
                        : formatDocumentRate(line.vatRatePercent, language)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Block>
  );
}

/**
 * The VAT per rate, drawn only when it adds up to the totals of the document (`vatSummaryOf`): a summary that does not is left out, and the totals under it, which are the server's, say what the
 * document is.
 */
function VatBlock({ detail, language }: { detail: FiscalDocumentDetail; language: string }) {
  const { t } = useTranslation();
  const rows = vatSummaryOf(detail);
  if (rows === null) return null;
  const money = (amount: number) => formatDocumentAmount(amount, detail.currency, language);

  return (
    <Block title={t('fiscalDocuments.detail.vat.title')} testId="fiscal-document-vat-block">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="fiscal-document-vat">
          <caption className="sr-only">{t('fiscalDocuments.detail.vat.title')}</caption>
          <thead>
            <tr className="border-b">
              <th scope="col" className={TH}>
                {t('fiscalDocuments.detail.vat.rate')}
              </th>
              <th scope="col" className={TH_NUM}>
                {t('fiscalDocuments.detail.vat.taxable')}
              </th>
              <th scope="col" className={TH_NUM}>
                {t('fiscalDocuments.detail.vat.vat')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.ratePercent}|${row.natureCode ?? ''}`} className="border-b last:border-0" data-testid="fiscal-document-vat-row">
                <td className={TD}>
                  {row.ratePercent === 0
                    ? row.natureCode
                      ? t('fiscalDocuments.detail.rate.noVatNature', { code: row.natureCode })
                      : t('fiscalDocuments.detail.rate.noVat')
                    : formatDocumentRate(row.ratePercent, language)}
                </td>
                <td className={TD_NUM}>{money(row.taxable)}</td>
                <td className={TD_NUM}>{money(row.vat)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Block>
  );
}

/** What the document comes to, as the server wrote it, in the currency of the document. */
function TotalsBlock({ detail, language }: { detail: FiscalDocumentDetail; language: string }) {
  const { t } = useTranslation();
  const money = (amount: number) => formatDocumentAmount(amount, detail.currency, language);

  return (
    <Block title={t('fiscalDocuments.detail.totals.title')} testId="fiscal-document-totals">
      <dl className="space-y-1.5 text-sm">
        <TotalRow label={t('fiscalDocuments.detail.totals.taxableBase')} testId="fiscal-document-taxable-base">
          {money(detail.taxableBase)}
        </TotalRow>
        <TotalRow label={t('fiscalDocuments.detail.totals.vat')} testId="fiscal-document-vat-total">
          {money(detail.vatAmount)}
        </TotalRow>
        {detail.stampDuty > 0 ? (
          <TotalRow label={t('fiscalDocuments.detail.totals.stampDuty')} testId="fiscal-document-stamp-duty">
            {money(detail.stampDuty)}
          </TotalRow>
        ) : null}
        <TotalRow label={t('fiscalDocuments.detail.totals.total')} strong testId="fiscal-document-total-line">
          {money(detail.total)}
        </TotalRow>
      </dl>
    </Block>
  );
}

/** Who issued the document as it was when it was issued: the snapshot when the server sends it, else a pointer to the PDF, which is made from it. Nothing for a draft or a document of the channel manager. */
function IssuerBlock({ detail }: { detail: FiscalDocumentDetail }) {
  const { t } = useTranslation();
  if (detail.source !== 'CasaZen' || detail.status !== 'Issued') return null;
  const { issuer } = detail;

  return (
    <Block title={t('fiscalDocuments.detail.issuer.title')} testId="fiscal-document-issuer">
      {issuer ? (
        <div className="space-y-1 text-sm" data-testid="fiscal-document-issuer-snapshot">
          {issuer.legalName ? <p className="break-words font-medium">{issuer.legalName}</p> : null}
          {issuer.vatNumber ? (
            <p className="break-words text-foreground/70">{t('fiscalDocuments.detail.issuer.vatNumber', { number: issuer.vatNumber })}</p>
          ) : null}
          {issuer.country ? <p className="text-foreground/70">{t('fiscalDocuments.detail.issuer.country', { country: issuer.country })}</p> : null}
        </div>
      ) : (
        <p className="text-sm text-foreground/70" data-testid="fiscal-document-issuer-in-pdf">
          {t('fiscalDocuments.detail.issuer.inPdf')}
        </p>
      )}
    </Block>
  );
}

interface DrawerBodyProps {
  documentId: string;
  flags: Partial<FeatureFlags>;
  canWrite: boolean;
  canReadBookings: boolean;
  onClose: () => void;
  onChanged?: (id: string, change: DocumentChange) => void;
}

/** What the drawer shows for one document: the answer of the server as it is, a failed read as a failed read with a retry, and a 404 as «not found» whatever the query still holds. */
function DrawerBody({ documentId, flags, canWrite, canReadBookings, onClose, onChanged }: DrawerBodyProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const query = useFiscalDocument(documentId);
  const read = documentsReadOf({ enabled: true, isError: query.isError, status: getHttpStatus(query.error), hasData: query.data !== undefined });
  const detail = read === 'ok' ? query.data : undefined;
  const sourceKey = detail ? documentSourceKey(detail.source) : null;
  const payment = detail ? paymentWordsOf(detail) : null;
  const bookingHref = detail ? bookingLinkOf(detail, canReadBookings) : null;

  return (
    <div className="space-y-5 pb-6" data-testid="fiscal-document-detail">
      <SheetHeader>
        <SheetTitle>{detail ? documentNameOf(t, detail) : t('fiscalDocuments.detail.title')}</SheetTitle>
        <SheetDescription>
          {detail
            ? [sourceKey ? t(sourceKey) : detail.source, detail.issueDate ? formatDocumentDay(detail.issueDate, language) : t('fiscalDocuments.list.noDate')].join(' · ')
            : t('fiscalDocuments.detail.description')}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-6 px-6">
        {read === 'loading' || read === 'idle' ? (
          <p role="status" className="text-sm text-foreground/70" data-testid="fiscal-document-detail-loading">
            {t('fiscalDocuments.detail.loading')}
          </p>
        ) : read === 'notFound' ? (
          <p className="text-sm text-foreground/70" data-testid="fiscal-document-detail-gone">
            {t('fiscalDocuments.list.gone')}
          </p>
        ) : read === 'forbidden' ? (
          <p className="text-sm text-foreground/70" data-testid="fiscal-document-detail-forbidden">
            {t('fiscalDocuments.list.forbidden')}
          </p>
        ) : read === 'failed' ? (
          <ErrorState title={t('fiscalDocuments.detail.loadError')} error={query.error} onRetry={() => void query.refetch()} />
        ) : detail ? (
          <>
            <div className="space-y-2">
              <p className="text-3xl font-semibold tabular-nums" data-testid="fiscal-document-detail-total">
                {formatDocumentAmount(detail.total, detail.currency, language)}
              </p>
              <DocumentStateBadge document={detail} showPayment={false} />
              {detail.recipientName ? (
                <p className="break-words text-sm text-foreground/70" data-testid="fiscal-document-detail-recipient">
                  {t('fiscalDocuments.detail.recipient', { name: detail.recipientName })}
                </p>
              ) : null}
              {bookingHref ? (
                <Link to={bookingHref} className={cn(LINK, 'inline-block text-sm')} data-testid="fiscal-document-detail-booking">
                  {t('fiscalDocuments.list.booking')}
                </Link>
              ) : null}
            </div>

            <LinesBlock detail={detail} language={language} />
            <VatBlock detail={detail} language={language} />
            <TotalsBlock detail={detail} language={language} />

            {payment ? (
              <Block title={t('fiscalDocuments.detail.payment.title')} testId="fiscal-document-payment-block">
                <StatePill state={payment} testId="fiscal-document-detail-payment" />
              </Block>
            ) : null}

            <IssuerBlock detail={detail} />

            <DocumentActionBar
              document={detail}
              flags={flags}
              canWrite={canWrite}
              onChanged={(id, change) => {
                onChanged?.(id, change);
                // A draft that was dropped is no document to look at any more.
                if (change === 'discarded') onClose();
              }}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

interface DocumentDetailDrawerProps {
  /** The document to show; `null` closes the drawer. */
  documentId: string | null;
  onClose: () => void;
  /** The flags of the backend, which say whether the PDF of an imported document can be asked. */
  flags: Partial<FeatureFlags>;
  /** The person may change documents: `payment.write` and the flag of the issuance of CasaZen. */
  canWrite: boolean;
  canReadBookings: boolean;
  onChanged?: (id: string, change: DocumentChange) => void;
}

/**
 * The detail of a document, opened from its row (E12/F02/US01/T01): the total in the currency of the document, its state, its lines with their type (when the server says it), the VAT per rate, the
 * totals, how it stands on the money («Pagato tramite il portale», «Pagato», «Da incassare»), who issued it as it was when it was issued, and the actions of its state next to the PDF and the XML (the
 * XML only when CasaZen holds one). It reads the document again whenever it opens and shows nothing it did not read: a failed read is a failed read, a 404 is «not found» whatever was in the cache.
 * A document drawn here is read, never edited: what can be changed goes through the dialogs of its actions.
 */
export function DocumentDetailDrawer({ documentId, onClose, flags, canWrite, canReadBookings, onChanged }: DocumentDetailDrawerProps) {
  return (
    <Sheet open={documentId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl" data-testid="fiscal-document-drawer">
        {documentId !== null ? (
          <DrawerBody key={documentId} documentId={documentId} flags={flags} canWrite={canWrite} canReadBookings={canReadBookings} onClose={onClose} onChanged={onChanged} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
