import { useMemo, type ComponentProps, type ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { DataView, type DataColumn } from '@/components/ui/data-view';
import { BOOKINGS_PATH } from '@/features/bookings/lib/booking-list-query';
import { cn } from '@/lib/utils';
import type { PaymentLedgerDocument, PaymentLedgerLine } from '@/types';
import {
  formatLedgerAmount,
  formatLedgerDay,
  formatLedgerFee,
  ledgerBadgeStatus,
  ledgerDocumentKey,
  ledgerRowsOf,
  ledgerSourceKey,
  providerCurrencyOf,
  type LedgerRow,
} from '../lib/payment-ledger';

const LINK = 'rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** A figure the server did not give: a dash for the eye and the words for a screen reader, never a 0 (a real 0 is a figure and is drawn as one). */
function Missing({ label, testId }: { label: string; testId?: string }) {
  return (
    <span data-missing="true" data-testid={testId}>
      <span aria-hidden="true">—</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function Figure({ testId, children }: { testId: string; children: ReactNode }) {
  return (
    <span className="whitespace-nowrap tabular-nums" data-testid={testId}>
      {children}
    </span>
  );
}

/** The words that say where the money comes from; a kind this client has no words for (the server is newer) is shown as it came. */
function sourceWords(t: TFunction, line: PaymentLedgerLine): string {
  const key = ledgerSourceKey(line);
  return key ? t(key) : line.kind;
}

/** The fiscal document of the booking: what it is, its number when it has one, its status and whether it was collected; a link when the page of the documents can be opened. */
function LedgerDocument({ document, href }: { document: PaymentLedgerDocument | null | undefined; href: string | null }) {
  const { t } = useTranslation();
  if (!document) return <Missing label={t('paymentLedger.document.none')} testId="payment-ledger-document-none" />;

  const word = (part: 'kind' | 'status' | 'paymentState', code: string) => {
    const key = ledgerDocumentKey(part, code);
    return key ? t(key) : code;
  };
  const kind = word('kind', document.kind);
  const name = document.number ? t('paymentLedger.document.named', { kind, number: document.number }) : kind;
  const states = [word('status', document.status), word('paymentState', document.paymentState)].join(' · ');

  return (
    <div className="min-w-0" data-testid="payment-ledger-document">
      {href ? (
        <Link to={href} className={LINK} data-testid="payment-ledger-document-link">
          {name}
        </Link>
      ) : (
        <span className="font-medium text-foreground">{name}</span>
      )}
      <span className="mt-0.5 block text-sm text-foreground/70" data-testid="payment-ledger-document-state">
        {states}
      </span>
    </div>
  );
}

interface PaymentLedgerTableProps {
  /** The lines of the ledger, as the server sent them and in its order (newest first). */
  lines: readonly PaymentLedgerLine[];
  /** The name of the table for a screen reader. */
  label: string;
  /** The code of the booking of each line, as a link to it: for the ledger of a period. The ledger of one booking leaves it out. */
  showBooking?: boolean;
  /** The page of the fiscal documents, when it can be opened from here (`documentLinkOf`); without it the document is told in words. */
  documentHref?: string | null;
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  /** What failed to load, already translated. */
  errorTitle?: string;
  onRetry?: () => void;
  /** The rows on screen are being read again (the next page, a payment just recorded): they stay, quieter, until the new ones are there. */
  isRefreshing?: boolean;
  /** What the table says when the ledger has no line: the props of an `EmptyState`. */
  empty?: ComponentProps<typeof EmptyState>;
  /** Under the table: the pages. */
  footer?: ReactNode;
  testId?: string;
}

/**
 * The payment ledger (FIS-05, NF-85, E06/F04/US01/T04): one table with one row for each line of what was collected, whatever the way. A row says where the money
 * comes from and the day, the amount, the commission, the net and the day it is credited, the state in words with a color and an icon, and the fiscal document of
 * the booking with its own state. On a phone each row is a card with the same things.
 *
 * Every amount is shown as the server wrote it, in the language of the person and in the currency of its own line: nothing is added up, rounded to another unit or
 * converted, the commission is written as a deduction, and a figure the server did not give is a dash, never a 0. Two currencies are never in one figure. Only a
 * line that is `Paid` says collected: a payment still to collect, refunded, failed or cancelled says so, and a state this client does not know is shown as it came.
 * The table adds no total: the server gives none.
 */
export function PaymentLedgerTable({
  lines,
  label,
  showBooking = false,
  documentHref = null,
  isLoading = false,
  isError = false,
  error,
  errorTitle,
  onRetry,
  isRefreshing = false,
  empty,
  footer,
  testId = 'payment-ledger-table',
}: PaymentLedgerTableProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const rows = useMemo(() => ledgerRowsOf(lines), [lines]);

  const columns = useMemo((): DataColumn<LedgerRow>[] => {
    const notAvailable = t('paymentLedger.notAvailable');
    const fee = ({ line }: LedgerRow) =>
      typeof line.providerFee === 'number' ? (
        <Figure testId="payment-ledger-fee">{formatLedgerFee(line.providerFee, providerCurrencyOf(line), language)}</Figure>
      ) : (
        <Missing label={notAvailable} testId="payment-ledger-fee" />
      );
    const net = ({ line }: LedgerRow) =>
      typeof line.net === 'number' ? (
        <Figure testId="payment-ledger-net">{formatLedgerAmount(line.net, providerCurrencyOf(line), language)}</Figure>
      ) : (
        <Missing label={notAvailable} testId="payment-ledger-net" />
      );
    const credit = ({ line }: LedgerRow) =>
      line.creditDate ? (
        <Figure testId="payment-ledger-credit">{formatLedgerDay(line.creditDate, language)}</Figure>
      ) : (
        <Missing label={notAvailable} testId="payment-ledger-credit" />
      );

    return [
      {
        key: 'source',
        header: t('paymentLedger.columns.payment'),
        rowHeader: true,
        cell: ({ line }) => (
          <div className="min-w-0">
            <span data-testid="payment-ledger-source">{sourceWords(t, line)}</span>
            <span className="mt-0.5 block text-sm font-normal text-foreground/70" data-testid="payment-ledger-date">
              {formatLedgerDay(line.date, language)}
            </span>
          </div>
        ),
      },
      ...(showBooking
        ? [
            {
              key: 'booking',
              header: t('paymentLedger.columns.booking'),
              cell: ({ line }: LedgerRow) => (
                <Link to={`${BOOKINGS_PATH}/${line.bookingId}`} className={cn(LINK, 'whitespace-nowrap')} data-testid="payment-ledger-booking">
                  {line.bookingCode || t('paymentLedger.columns.booking')}
                </Link>
              ),
            } satisfies DataColumn<LedgerRow>,
          ]
        : []),
      {
        key: 'gross',
        header: t('paymentLedger.columns.gross'),
        align: 'end',
        cell: ({ line }) => <Figure testId="payment-ledger-gross">{formatLedgerAmount(line.gross, line.currency, language)}</Figure>,
      },
      { key: 'fee', header: t('paymentLedger.columns.fee'), align: 'end', cell: fee },
      { key: 'net', header: t('paymentLedger.columns.net'), align: 'end', cell: net },
      { key: 'credit', header: t('paymentLedger.columns.credit'), cell: credit },
      {
        key: 'state',
        header: t('paymentLedger.columns.state'),
        cell: ({ line }) => <StateBadge line={line} />,
      },
      {
        key: 'document',
        header: t('paymentLedger.columns.document'),
        cell: ({ line }) => <LedgerDocument document={line.document} href={documentHref} />,
      },
    ];
  }, [t, language, showBooking, documentHref]);

  const renderCard = ({ line }: LedgerRow) => {
    const notAvailable = t('paymentLedger.notAvailable');
    const feeCurrency = providerCurrencyOf(line);
    const detail = (name: string, value: ReactNode) => (
      <div className="min-w-0">
        <dt className="text-foreground/70">{name}</dt>
        <dd className="mt-0.5 text-foreground">{value}</dd>
      </div>
    );
    return (
      <div className="space-y-3" data-testid="payment-ledger-card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="block font-medium text-foreground">{sourceWords(t, line)}</span>
            <span className="mt-0.5 block text-sm text-foreground/70">{formatLedgerDay(line.date, language)}</span>
            {showBooking ? (
              <Link to={`${BOOKINGS_PATH}/${line.bookingId}`} className={cn(LINK, 'mt-0.5 inline-block text-sm')}>
                {line.bookingCode || t('paymentLedger.columns.booking')}
              </Link>
            ) : null}
          </div>
          <StateBadge line={line} />
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {detail(t('paymentLedger.columns.gross'), <Figure testId="payment-ledger-gross">{formatLedgerAmount(line.gross, line.currency, language)}</Figure>)}
          {detail(
            t('paymentLedger.columns.fee'),
            typeof line.providerFee === 'number' ? (
              <Figure testId="payment-ledger-fee">{formatLedgerFee(line.providerFee, feeCurrency, language)}</Figure>
            ) : (
              <Missing label={notAvailable} testId="payment-ledger-fee" />
            ),
          )}
          {detail(
            t('paymentLedger.columns.net'),
            typeof line.net === 'number' ? (
              <Figure testId="payment-ledger-net">{formatLedgerAmount(line.net, feeCurrency, language)}</Figure>
            ) : (
              <Missing label={notAvailable} testId="payment-ledger-net" />
            ),
          )}
          {detail(
            t('paymentLedger.columns.credit'),
            line.creditDate ? <Figure testId="payment-ledger-credit">{formatLedgerDay(line.creditDate, language)}</Figure> : <Missing label={notAvailable} testId="payment-ledger-credit" />,
          )}
        </dl>
        <div className="text-sm">
          <LedgerDocument document={line.document} href={documentHref} />
        </div>
      </div>
    );
  };

  return (
    <div aria-busy={isRefreshing || undefined} className={cn('transition-opacity', isRefreshing && 'opacity-60')} data-testid={testId}>
      <DataView<LedgerRow>
        label={label}
        rows={rows}
        columns={columns}
        rowKey={(row) => row.key}
        renderCard={renderCard}
        isLoading={isLoading}
        isError={isError}
        error={error}
        errorTitle={errorTitle}
        onRetry={onRetry}
        empty={empty}
        cardsUntil="xl"
        footer={footer}
        rowTestId={() => 'payment-ledger-row'}
      />
    </div>
  );
}

/**
 * The state of a line: the badge the payments already use, with the same words, so «Da incassare» is one thing everywhere. Only `Paid` is shown as collected;
 * a code this client does not know goes to the badge as it came and is drawn neutral.
 */
function StateBadge({ line }: { line: PaymentLedgerLine }) {
  return <StatusBadge kind="payment" status={ledgerBadgeStatus(line.state)} data-testid="payment-ledger-state" data-state={line.state} />;
}
