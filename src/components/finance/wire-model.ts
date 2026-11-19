import { isAxiosError } from 'axios';
import { getHttpStatus } from '@/lib/api-errors';
import type { WireCurrency, WirePayout } from '@/types';

/**
 * The currencies a wire file exists for: the Swiss file for the franc, the SEPA file for the euro. The page asks the server for one list of payable payouts per currency and
 * the server has no list for any other, so the payouts of another currency are not on this page at all. The franc comes first.
 */
export const WIRE_CURRENCIES: readonly WireCurrency[] = ['CHF', 'EUR'];

/** The server compares currencies without the case or the spaces of the stored code, and so does the page. */
export const currencyOf = (value: string | null | undefined): string => (value ?? '').trim().toUpperCase();

/** The most payouts the server gives in ONE list of payable payouts (`payable-payouts?currency=`, the oldest first): a list of this length may hold only the first of them. */
export const WIRE_PAYABLE_LIST_CAP = 1000;

/** Whether a list of the server is as long as it can be, so that more payouts may be waiting behind it: the page says so, it never shows a cut list as the whole of it. */
export const isListCapped = (payouts: readonly unknown[] | null | undefined): boolean => (payouts?.length ?? 0) >= WIRE_PAYABLE_LIST_CAP;

/** A payout the page offers: who is paid, for which statement, how much of which currency, and whether the owner has an IBAN (a yes or a no: the account itself never comes). */
export interface PayableRow {
  id: string;
  ownerId: string;
  /** The name the owner is paid under, as the server wrote it; empty when it sent none. */
  ownerName: string;
  periodYear: number;
  periodMonth: number;
  /** The currency of the payout as the data says it (trimmed, in capitals): the symbol and the code of its amount come from here, never from the page. */
  currency: string;
  amount: number;
  /** The owner has an IBAN, by the server's own test (the one a batch makes). */
  hasIban: boolean;
}

/**
 * Whether a payout can be chosen: the owner has an IBAN (the server refuses the whole file for an owner without it, `wire_owner_iban_missing`). Everything else is the
 * server's to decide, and it has already decided it by listing the payout: confirmed, published, in no batch.
 */
export const isPayable = (row: PayableRow): boolean => row.hasIban;

/**
 * The payouts of ONE currency a file can pay, as the server listed them (its order is kept: the oldest first, which is the order of the transfers of a file). The server is
 * the first line of defence and this is the second: a payout that is not confirmed, one in another currency than the list asked for (a franc list never offers a euro payout)
 * and one the page put in a file in this visit (the server answers a list read before that file was made) are never offered.
 */
export function payableRows(payouts: readonly WirePayout[] | null | undefined, currency: WireCurrency, batchedIds: ReadonlySet<string>): PayableRow[] {
  return (payouts ?? [])
    .filter((payout) => payout.status === 'Confirmed' && currencyOf(payout.currency) === currency && !batchedIds.has(payout.payoutId))
    .map(
      (payout): PayableRow => ({
        id: payout.payoutId,
        ownerId: payout.ownerId,
        ownerName: payout.ownerName.trim(),
        periodYear: payout.periodYear,
        periodMonth: payout.periodMonth,
        currency: currencyOf(payout.currency),
        amount: payout.amount,
        hasIban: payout.ownerHasIban,
      }),
    );
}

interface ReadResult {
  data: unknown;
  isPending: boolean;
  isError: boolean;
  error: unknown;
}

/**
 * Where a part of the page stands, from the reads it needs. A 404 is «not found» whatever the cache still holds (a failed read keeps the last answer); any other failure
 * with nothing to show is an error with a retry; a failure with the last answer in memory is the stale notice, decided by the caller.
 */
export function readStateOf(...reads: ReadResult[]): 'loading' | 'notFound' | 'error' | 'ready' {
  if (reads.some((read) => read.isError && getHttpStatus(read.error) === 404)) return 'notFound';
  if (reads.some((read) => read.isError && !read.data)) return 'error';
  if (reads.some((read) => read.isPending)) return 'loading';
  return 'ready';
}

/** An IBAN written inside a text: two capital letters, two digits and up to thirty more characters, with or without the spaces of its groups. */
const IBAN_IN_TEXT = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]){11,30}\b/g;

/**
 * A text of the server as the wire page may draw it: a bank account written in it is cut to `••••`. The server never writes an IBAN in a message (the refusals carry codes and
 * ids), and this is the belt over those braces: no account is ever drawn in full on this page, whatever a message quotes.
 */
export const withoutIban = (text: string): string => text.replace(IBAN_IN_TEXT, '••••');

/**
 * The ids of the owners a refusal of the server lists (`ownerIds` of the problem, for the codes about the owners' address and account): the ones that cannot be paid with
 * the file. Ids only: the server never names an owner or writes an account in a refusal.
 */
export function ownerIdsOf(error: unknown): string[] {
  if (!isAxiosError(error)) return [];
  const data: unknown = error.response?.data;
  if (typeof data !== 'object' || data === null) return [];
  const ids = (data as { ownerIds?: unknown }).ownerIds;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
}
