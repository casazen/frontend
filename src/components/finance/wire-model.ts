import { isAxiosError } from 'axios';
import { getHttpStatus } from '@/lib/api-errors';
import type { WireCurrency, WirePayout } from '@/types';

export const WIRE_CURRENCIES: readonly WireCurrency[] = ['CHF', 'EUR'];

export const currencyOf = (value: string | null | undefined): string => (value ?? '').trim().toUpperCase();

export const WIRE_PAYABLE_LIST_CAP = 1000;

/** Whether a list of the server is as long as it can be, so that more payouts may be waiting behind it: the page says so, it never shows a cut list as the whole of it. */
export const isListCapped = (payouts: readonly unknown[] | null | undefined): boolean => (payouts?.length ?? 0) >= WIRE_PAYABLE_LIST_CAP;

export interface PayableRow {
  id: string;
  ownerId: string;
  ownerName: string;
  periodYear: number;
  periodMonth: number;
  currency: string;
  amount: number;
  hasIban: boolean;
}

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

const IBAN_IN_TEXT = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]){11,30}\b/g;

export const withoutIban = (text: string): string => text.replace(IBAN_IN_TEXT, '••••');

export function ownerIdsOf(error: unknown): string[] {
  if (!isAxiosError(error)) return [];
  const data: unknown = error.response?.data;
  if (typeof data !== 'object' || data === null) return [];
  const ids = (data as { ownerIds?: unknown }).ownerIds;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
}
