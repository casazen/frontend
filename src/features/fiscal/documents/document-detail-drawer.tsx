import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { isFeatureEnabled, type FeatureFlags } from '@/config/feature-flags';
import { getHttpStatus } from '@/lib/api-errors';
import { cn } from '@/lib/utils';
import { useFiscalDocument } from '@/queries/use-fiscal-documents';
import type { FiscalDocumentDetail } from '@/types';
import { DocumentActionBar, type DocumentChange } from './document-actions';
import { DocumentCorrectionStep } from './document-correction-step';
import {
  bookingLinkOf,
  documentNameOf,
  documentPurposeKey,
  documentsReadOf,
  documentSourceKey,
  formatDocumentAmount,
  formatDocumentDay,
  formatDocumentRate,
  hasCurrencyCode,
  LINE_AT_PROPERTY_STATE,
  lineTypeKey,
  paymentSplitOf,
  paymentWordsOf,
  vatSummaryOf,
  type DocumentIntent,
  type PaymentPart,
  type PaymentSplit,
} from './document-model';
import { DocumentSdiPanel } from './document-sdi-panel';
import { DocumentStateBadge, StatePill } from './document-state-badge';

const LINK = 'rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function Block({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <section className="space-y-2" data-testid={testId}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

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

/**
 * The lines of the document, each with its type when the server says it, its amount without VAT and its rate. Every amount is in the currency of the document. The line of tourist tax that the portal left to
 * the host is marked «Da pagare in struttura» when, and only when, the server says so (`toCollectAtProperty`): the line stays what it is and so does its amount.
 */
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
                      {line.toCollectAtProperty ? (
                        <span className="mt-1 block">
                          <StatePill state={LINE_AT_PROPERTY_STATE} testId="fiscal-document-line-at-property" />
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

function PaymentPartRow({ part, amount, testId }: { part: PaymentPart; amount: string; testId: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4" data-testid={testId}>
      <dt className="min-w-0">
        <StatePill state={part.state} testId={`${testId}-state`} />
      </dt>
      <dd className="whitespace-nowrap font-medium tabular-nums" data-testid={`${testId}-amount`}>
        {amount}
      </dd>
    </div>
  );
}

function PaymentSplitRows({ split, currency, language }: { split: PaymentSplit; currency: string; language: string }) {
  const { t } = useTranslation();
  const money = (amount: number) => formatDocumentAmount(amount, currency, language);

  return (
    <div className="space-y-2">
      <dl className="space-y-2 text-sm" data-testid="fiscal-document-payment-split">
        {split.portal ? <PaymentPartRow part={split.portal} amount={money(split.portal.amount)} testId="fiscal-document-payment-portal" /> : null}
        <PaymentPartRow part={split.atProperty} amount={money(split.atProperty.amount)} testId="fiscal-document-payment-property" />
      </dl>
      {hasCurrencyCode(currency) ? null : (
        <p className="text-sm text-foreground/70" data-testid="fiscal-document-payment-no-currency">
          {t('fiscalDocuments.detail.payment.noCurrency')}
        </p>
      )}
    </div>
  );
}

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
  intent?: DocumentIntent;
  onClose: () => void;
  onChanged?: (id: string, change: DocumentChange) => void;
  onOpenDocument?: (id: string) => void;
}

/** What the guided correction is about: the invoice the SDI rejected (it starts from it) or the draft a correction made of it (it goes on from there). */
type Correction = 'rejected' | 'replacement';

/** What the drawer shows for one document: the answer of the server as it is, a failed read as a failed read with a retry, and a 404 as «not found» whatever the query still holds. */
function DrawerBody({ documentId, flags, canWrite, canReadBookings, intent, onClose, onChanged, onOpenDocument }: DrawerBodyProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const query = useFiscalDocument(documentId);
  const read = documentsReadOf({ enabled: true, isError: query.isError, status: getHttpStatus(query.error), hasData: query.data !== undefined });
  const detail = read === 'ok' ? query.data : undefined;
  const sourceKey = detail ? documentSourceKey(detail.source) : null;
  const purposeKey = detail ? documentPurposeKey(detail.purpose) : null;
  const payment = detail ? paymentWordsOf(detail) : null;
  const paymentSplit = detail ? paymentSplitOf(detail) : null;
  const bookingHref = detail ? bookingLinkOf(detail, canReadBookings) : null;
  // The guided correction exists only while the sending to the SDI is on and the person may change the documents of the guests.
  const canCorrect = canWrite && isFeatureEnabled(flags, 'sdiSubmission');
  const [correcting, setCorrecting] = useState<Correction | null>(() => (intent === 'correct' && canCorrect ? 'rejected' : null));

  if (correcting !== null && canCorrect) {
    return (
      <div className="space-y-5 pb-6" data-testid="fiscal-document-detail" data-correcting={correcting}>
        <SheetHeader>
          <SheetTitle>{detail ? documentNameOf(t, detail) : t('fiscalDocuments.detail.title')}</SheetTitle>
          <SheetDescription>{t('fiscalDocuments.correction.description')}</SheetDescription>
        </SheetHeader>
        <div className="px-6">
          <DocumentCorrectionStep
            documentId={documentId}
            mode={correcting}
            onClose={() => setCorrecting(null)}
            onOpenDocument={(id) => {
              setCorrecting(null);
              onOpenDocument?.(id);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6" data-testid="fiscal-document-detail">
      <SheetHeader>
        <SheetTitle>{detail ? documentNameOf(t, detail) : t('fiscalDocuments.detail.title')}</SheetTitle>
        <SheetDescription>
          {detail
            ? [purposeKey ? t(purposeKey) : null, sourceKey ? t(sourceKey) : detail.source, detail.issueDate ? formatDocumentDay(detail.issueDate, language) : t('fiscalDocuments.list.noDate')]
                .filter((part) => part !== null)
                .join(' · ')
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

            {paymentSplit || payment ? (
              <Block title={t('fiscalDocuments.detail.payment.title')} testId="fiscal-document-payment-block">
                {paymentSplit ? (
                  <PaymentSplitRows split={paymentSplit} currency={detail.currency} language={language} />
                ) : payment ? (
                  <StatePill state={payment} testId="fiscal-document-detail-payment" />
                ) : null}
              </Block>
            ) : null}

            <IssuerBlock detail={detail} />

            {/* The draft a correction made of an invoice the SDI rejected: it keeps the number of that invoice, so it is issued and never discarded, and the person finds the step again here. */}
            {detail.status === 'Draft' && detail.replacesDocumentId && canCorrect ? (
              <Block title={t('fiscalDocuments.correction.replacement.title')} testId="fiscal-document-replacement">
                <p className="text-sm text-foreground/70">{t('fiscalDocuments.correction.replacement.body')}</p>
                <Button type="button" size="sm" onClick={() => setCorrecting('replacement')} data-testid="fiscal-document-continue-correction">
                  {t('fiscalDocuments.correction.replacement.continue')}
                </Button>
              </Block>
            ) : null}

            <DocumentSdiPanel document={detail} flags={flags} canWrite={canWrite} onCorrect={() => setCorrecting('rejected')} />

            <DocumentActionBar
              document={detail}
              flags={flags}
              canWrite={canWrite}
              onChanged={(id, change) => {
                onChanged?.(id, change);
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
  documentId: string | null;
  onClose: () => void;
  flags: Partial<FeatureFlags>;
  canWrite: boolean;
  canReadBookings: boolean;
  intent?: DocumentIntent;
  onChanged?: (id: string, change: DocumentChange) => void;
  onOpenDocument?: (id: string) => void;
}

/**
 * The detail of a document, opened from its row (E12/F02/US01/T01): the total in the currency of the document, its state, its lines with their type (when the server says it), the VAT per rate, the
 * totals, how it stands on the money («Pagato tramite il portale», «Pagato», «Da incassare», or, when the server splits the payment of a portal document that left the tourist tax to the host, the part the portal
 * collected and the tourist tax «da pagare in struttura», each with its amount), who issued it as it was when it was issued, and the actions of its state next to the PDF and the XML (the
 * XML only when CasaZen holds one). It reads the document again whenever it opens and shows nothing it did not read: a failed read is a failed read, a 404 is «not found» whatever was in the cache.
 * A document drawn here is read, never edited: what can be changed goes through the dialogs of its actions.
 */
export function DocumentDetailDrawer({ documentId, onClose, flags, canWrite, canReadBookings, intent, onChanged, onOpenDocument }: DocumentDetailDrawerProps) {
  return (
    <Sheet open={documentId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl" data-testid="fiscal-document-drawer">
        {documentId !== null ? (
          <DrawerBody
            key={documentId}
            documentId={documentId}
            flags={flags}
            canWrite={canWrite}
            canReadBookings={canReadBookings}
            intent={intent}
            onClose={onClose}
            onChanged={onChanged}
            onOpenDocument={onOpenDocument}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
