import {
  getManifestEntry,
  hasEntryPermission,
  isEntryFeatureEnabled,
  type PermissionPredicate,
} from '@/config/route-manifest';
import type { FeatureFlags } from '@/config/feature-flags';
import { endOfMonth, formatStayDate, isStayDate, startOfMonth } from '@/lib/stay-dates';
import { PAYMENT_LEDGER_KINDS, type PaymentLedgerLine, type PaymentStatus } from '@/types';

/**
 * Where the fiscal documents of the host are (E06/F03/US04/T01, the page of the list of documents). The ledger links the document of a line there only while the
 * route exists, the caller may open it and its flag is on (`documentLinkOf`): a link to a page that is not there, or that the caller would be turned away from,
 * is never drawn.
 */
export const FISCAL_DOCUMENTS_PATH = '/app/short-rent/fiscal/documents';

/** Lines on a page of the ledger of a period (the page size the server uses when it is not told one). */
export const LEDGER_PAGE_SIZE = 20;

/** The first and the last day a period may start or end on: the date fields of the app take no other. */
const FIRST_DAY = '2000-01-01';
const LAST_DAY = '2100-12-31';
export const LEDGER_DAY_LIMITS = { min: FIRST_DAY, max: LAST_DAY } as const;

// ---------------------------------------------------------------------------------------------------------------------------------
// Money

/** More decimals than any currency has, so that a figure the server wrote is never cut by the format: what it sends is what is shown. */
const MAX_FRACTION_DIGITS = 4;

const CURRENCY_CODE = /^[A-Za-z]{3}$/;
const AMOUNT_FORMATS = new Map<string, Intl.NumberFormat>();

function numberFormat(language: string, currency: string | null): Intl.NumberFormat {
  const key = `${language}|${currency ?? ''}`;
  const known = AMOUNT_FORMATS.get(key);
  if (known) return known;
  const options: Intl.NumberFormatOptions = currency
    ? { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: MAX_FRACTION_DIGITS }
    : { maximumFractionDigits: MAX_FRACTION_DIGITS };
  let format: Intl.NumberFormat;
  try {
    format = new Intl.NumberFormat(language, options);
  } catch {
    // A language tag the runtime does not know: the page's own default, never a crash on a money screen.
    format = new Intl.NumberFormat('it', options);
  }
  AMOUNT_FORMATS.set(key, format);
  return format;
}

/**
 * An amount of the ledger as the server wrote it, in the language of the person and in the currency of the line: no sum, no rounding to another unit, no
 * conversion, and never an assumed euro (a currency that is not a code is written after the number as it came).
 */
export function formatLedgerAmount(amount: number, currency: string, language: string): string {
  if (CURRENCY_CODE.test(currency)) return numberFormat(language, currency).format(amount);
  return `${numberFormat(language, null).format(amount)} ${currency}`.trim();
}

/**
 * The fee of the provider or of the channel is a cost: it is shown as a deduction, with a minus, whatever sign the server wrote it with. Flipping a sign is not
 * arithmetic on the figure, and a fee of 0 stays 0 (never "-0,00").
 */
export function formatLedgerFee(fee: number, currency: string, language: string): string {
  return formatLedgerAmount(fee === 0 ? 0 : -Math.abs(fee), currency, language);
}

/**
 * The currency of the fee and of the net of a line: the one of the balance of the provider when the server says it (it may not be the one of the line), else the one
 * of the line. Two currencies on one line are shown side by side, never added up.
 */
export function providerCurrencyOf(line: Pick<PaymentLedgerLine, 'providerCurrency' | 'currency'>): string {
  return line.providerCurrency || line.currency;
}

/** A day of the ledger (`YYYY-MM-DD`, Europe/Rome) in the language of the person; what is not a day is shown as it came. */
export function formatLedgerDay(day: string, language: string): string {
  return formatStayDate(day, language, { day: 'numeric', month: 'short', year: 'numeric' }) || day;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// States and words

/** The state of a line as the shared badge of the payments takes it: one name for each concept, the ones the payments list already uses. */
const BADGE_STATUS: Readonly<Record<string, PaymentStatus>> = {
  Paid: 'Completed',
  ToCollect: 'Pending',
  Refunded: 'Refunded',
  PartiallyRefunded: 'PartiallyRefunded',
  Failed: 'Failed',
  Canceled: 'Canceled',
};

/**
 * The status the badge shows for a state of the ledger. Only `Paid` is "Incassato"; `ToCollect` (pending or processing, nothing else) is "Da incassare"; a state
 * this client does not know (the server is newer) goes to the badge as it came, which draws it neutral with its own code, never as collected.
 */
export function ledgerBadgeStatus(state: string): PaymentStatus {
  return (Object.prototype.hasOwnProperty.call(BADGE_STATUS, state) ? BADGE_STATUS[state] : state) as PaymentStatus;
}

/**
 * The key of the words that say where the money of a line comes from, or `null` for a kind this client does not know (shown as it came). A payment of a channel
 * says "Incassato dal canale" only when the channel collected it and it is `Paid`: a line still to collect never says collected, and one the host collects says so.
 */
export function ledgerSourceKey(line: Pick<PaymentLedgerLine, 'kind' | 'state' | 'collectedBy'>): string | null {
  if (line.kind === 'Ota') {
    if (line.collectedBy === 'Host') return 'paymentLedger.source.OtaHost';
    return line.collectedBy === 'Channel' && line.state === 'Paid' ? 'paymentLedger.source.OtaCollected' : 'paymentLedger.source.Ota';
  }
  return (PAYMENT_LEDGER_KINDS as readonly string[]).includes(line.kind) ? `paymentLedger.source.${line.kind}` : null;
}

/** The kinds, statuses and collection states of a fiscal document the words are written for; any other code is shown as it came. */
const DOCUMENT_KINDS: readonly string[] = ['Invoice', 'Receipt', 'CreditNote', 'Proforma'];
const DOCUMENT_STATUSES: readonly string[] = ['Draft', 'Issued'];
const DOCUMENT_PAYMENT_STATES: readonly string[] = ['Unknown', 'ToCollect', 'Paid'];

export const LEDGER_DOCUMENT_CODES = {
  kind: DOCUMENT_KINDS,
  status: DOCUMENT_STATUSES,
  paymentState: DOCUMENT_PAYMENT_STATES,
} as const;

/** The key of the words of a code of the document (`kind`, `status` or `paymentState`), or `null` for a code this client has no words for. */
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

// ---------------------------------------------------------------------------------------------------------------------------------
// Rows and reads

/** A line with a key of its own: the lines of a channel have no payment, so the key is built from what is on the line and its place. */
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

/** How the last read of a ledger ended. `idle`: it was not asked (a caller who may not read payments, or days the server would refuse). */
export type LedgerRead = 'idle' | 'loading' | 'ok' | 'notFound' | 'forbidden' | 'failed';

/**
 * The read of a ledger as the screen takes it. An error comes first, and a 404 is `notFound` even when the query still holds lines: a query keeps its old data when
 * a later read fails, and a booking that is not found is not a booking whose ledger is the cached one. An error is never "nothing to collect": it has its own state.
 */
export function ledgerReadOf(input: { enabled: boolean; isError: boolean; status: number | undefined; hasData: boolean }): LedgerRead {
  if (!input.enabled) return 'idle';
  if (input.isError) return input.status === 404 ? 'notFound' : input.status === 403 ? 'forbidden' : 'failed';
  return input.hasData ? 'ok' : 'loading';
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The period

export interface LedgerPeriod {
  from: string;
  to: string;
}

/** The month of `today` (a day in Europe/Rome): the period the ledger opens on. */
export function defaultPeriod(today: string): LedgerPeriod {
  return { from: startOfMonth(today), to: endOfMonth(today) };
}

export type PeriodProblem = 'incomplete' | 'order';

/**
 * Why the days are not a period the server would answer, or `null`. The server is not asked for a period with a day missing (it would read the whole history) or
 * with the first day after the last (a 400 `payment_ledger_invalid_range`): the screen says why and shows nothing of an earlier choice.
 */
export function periodProblemOf(period: LedgerPeriod): PeriodProblem | null {
  const { from, to } = period;
  if (!isStayDate(from) || !isStayDate(to) || from < FIRST_DAY || to > LAST_DAY) return 'incomplete';
  return from > to ? 'order' : null;
}
