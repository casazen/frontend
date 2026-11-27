import {
  getManifestEntry,
  hasEntryPermission,
  isEntryFeatureEnabled,
  type PermissionPredicate,
} from '@/config/route-manifest';
import type { FeatureFlags } from '@/config/feature-flags';
import { endOfMonth, formatStayDate, isStayDate, startOfMonth } from '@/lib/stay-dates';
import { PAYMENT_LEDGER_KINDS, type PaymentLedgerLine, type PaymentStatus } from '@/types';
import { formatExactAmount } from '@/lib/exact-amount';

/**
 * Where the fiscal documents of the host are (E06/F03/US04/T01, the page of the list of documents). The ledger links the document of a line there only while the
 * route exists, the caller may open it and its flag is on (`documentLinkOf`): a link to a page that is not there, or that the caller would be turned away from,
 * is never drawn.
 */
export const FISCAL_DOCUMENTS_PATH = '/app/short-rent/fiscal/documents';

export const LEDGER_PAGE_SIZE = 20;

const FIRST_DAY = '2000-01-01';
const LAST_DAY = '2100-12-31';
export const LEDGER_DAY_LIMITS = { min: FIRST_DAY, max: LAST_DAY } as const;

export const formatLedgerAmount = formatExactAmount;

export function formatLedgerFee(fee: number, currency: string, language: string): string {
  return formatLedgerAmount(fee === 0 ? 0 : -Math.abs(fee), currency, language);
}

export function providerCurrencyOf(line: Pick<PaymentLedgerLine, 'providerCurrency' | 'currency'>): string {
  return line.providerCurrency || line.currency;
}

export function formatLedgerDay(day: string, language: string): string {
  return formatStayDate(day, language, { day: 'numeric', month: 'short', year: 'numeric' }) || day;
}

const BADGE_STATUS: Readonly<Record<string, PaymentStatus>> = {
  Paid: 'Completed',
  ToCollect: 'Pending',
  Refunded: 'Refunded',
  PartiallyRefunded: 'PartiallyRefunded',
  Failed: 'Failed',
  Canceled: 'Canceled',
};

export function ledgerBadgeStatus(state: string): PaymentStatus {
  return (Object.prototype.hasOwnProperty.call(BADGE_STATUS, state) ? BADGE_STATUS[state] : state) as PaymentStatus;
}

export function ledgerSourceKey(line: Pick<PaymentLedgerLine, 'kind' | 'state' | 'collectedBy'>): string | null {
  if (line.kind === 'Ota') {
    if (line.collectedBy === 'Host') return 'paymentLedger.source.OtaHost';
    return line.collectedBy === 'Channel' && line.state === 'Paid' ? 'paymentLedger.source.OtaCollected' : 'paymentLedger.source.Ota';
  }
  return (PAYMENT_LEDGER_KINDS as readonly string[]).includes(line.kind) ? `paymentLedger.source.${line.kind}` : null;
}

const DOCUMENT_KINDS: readonly string[] = ['Invoice', 'Receipt', 'CreditNote', 'Proforma'];
const DOCUMENT_STATUSES: readonly string[] = ['Draft', 'Issued'];
const DOCUMENT_PAYMENT_STATES: readonly string[] = ['Unknown', 'ToCollect', 'Paid'];

export const LEDGER_DOCUMENT_CODES = {
  kind: DOCUMENT_KINDS,
  status: DOCUMENT_STATUSES,
  paymentState: DOCUMENT_PAYMENT_STATES,
} as const;

export function ledgerDocumentKey(part: keyof typeof LEDGER_DOCUMENT_CODES, code: string): string | null {
  return LEDGER_DOCUMENT_CODES[part].includes(code) ? `paymentLedger.document.${part}.${code}` : null;
}

/**
 * The page of the fiscal documents when it can be opened from here: the route is registered, its flag is on and the caller holds what it asks. `null` otherwise, and
 * the document is then told in words with no link.
 */
export function documentLinkOf(hasPermission: PermissionPredicate, features?: Partial<FeatureFlags>): string | null {
  const entry = getManifestEntry(FISCAL_DOCUMENTS_PATH);
  return entry && isEntryFeatureEnabled(entry, features) && hasEntryPermission(entry, hasPermission) ? entry.path : null;
}

export interface LedgerRow {
  key: string;
  line: PaymentLedgerLine;
}

export function ledgerRowsOf(lines: readonly PaymentLedgerLine[]): LedgerRow[] {
  return lines.map((line, index) => ({
    key: `${line.paymentId ?? [line.bookingId, line.kind, line.state, line.date, line.gross].join(':')}#${index}`,
    line,
  }));
}

export type LedgerRead = 'idle' | 'loading' | 'ok' | 'notFound' | 'forbidden' | 'failed';

export function ledgerReadOf(input: { enabled: boolean; isError: boolean; status: number | undefined; hasData: boolean }): LedgerRead {
  if (!input.enabled) return 'idle';
  if (input.isError) return input.status === 404 ? 'notFound' : input.status === 403 ? 'forbidden' : 'failed';
  return input.hasData ? 'ok' : 'loading';
}

export interface LedgerPeriod {
  from: string;
  to: string;
}

export function defaultPeriod(today: string): LedgerPeriod {
  return { from: startOfMonth(today), to: endOfMonth(today) };
}

export type PeriodProblem = 'incomplete' | 'order';

export function periodProblemOf(period: LedgerPeriod): PeriodProblem | null {
  const { from, to } = period;
  if (!isStayDate(from) || !isStayDate(to) || from < FIRST_DAY || to > LAST_DAY) return 'incomplete';
  return from > to ? 'order' : null;
}
