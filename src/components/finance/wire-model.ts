import { isAxiosError } from 'axios';
import type { OwnerPayout, WireOwner } from '@/types';

/**
 * The currencies a wire file exists for: the Swiss file for the franc, the SEPA file for the euro. The server refuses any other (`wire_currency_not_supported`), so a payout
 * in another currency is shown and cannot be chosen. The franc comes first.
 */
export const WIRE_CURRENCIES: readonly string[] = ['CHF', 'EUR'];

/** The server compares currencies without the case or the spaces of the stored code, and so does the page. */
export const currencyOf = (value: string | null | undefined): string => (value ?? '').trim().toUpperCase();

/** A confirmed payout as the page offers it: who is paid, how much of which currency, and the end of the account it goes to. */
export interface PayableRow {
  id: string;
  ownerId: string;
  /** The name in the registry; `null` when the owner is not in the list the page read. */
  ownerName: string | null;
  /** The end of the owner's IBAN (`•••• 3456`); `null` when the registry says the owner has none; `undefined` when the owner is not in the list (the server decides then). */
  ibanEnd: string | null | undefined;
  /** The currency of the payout, trimmed and in capitals; empty when the data carries none. */
  currency: string;
  netAmount: number;
  /** The day of the payout (`yyyy-MM-dd`): the day the withholding was decided on, not the period of the statement. */
  paidOn: string;
  reference: string | null;
}

/** A file exists for the currency. */
export const isWireCurrency = (currency: string): boolean => WIRE_CURRENCIES.includes(currency);

/**
 * Whether a payout can be chosen: a currency a file exists for, and an owner whose IBAN the registry does not say is missing (the server refuses the whole file for an
 * owner without it, `wire_owner_iban_missing`). Everything else is the server's to decide.
 */
export const isPayable = (row: PayableRow): boolean => isWireCurrency(row.currency) && row.ibanEnd !== null;

/**
 * The confirmed payouts a file can pay, with the owner each one is for. A reversed payout is never offered (the server refuses it, `wire_payouts_not_confirmed`), and
 * neither is one the page put in a file in this visit. The newest day of payment first (what was just confirmed is on top, the old ones sink), then by owner name.
 */
export function payableRows(payouts: readonly OwnerPayout[], owners: readonly WireOwner[], batchedIds: ReadonlySet<string>): PayableRow[] {
  const byId = new Map(owners.map((owner) => [owner.id, owner] as const));
  return payouts
    .filter((payout) => payout.status === 'Confirmed' && !batchedIds.has(payout.id))
    .map((payout): PayableRow => {
      const owner = byId.get(payout.ownerId);
      return {
        id: payout.id,
        ownerId: payout.ownerId,
        ownerName: owner ? owner.name : null,
        ibanEnd: owner ? owner.ibanEnd : undefined,
        currency: currencyOf(payout.currency),
        netAmount: payout.netAmount,
        paidOn: payout.paidOn,
        reference: payout.reference,
      };
    })
    .sort((a, b) => b.paidOn.localeCompare(a.paidOn) || (a.ownerName ?? '').localeCompare(b.ownerName ?? ''));
}

/** The rows by currency: the currencies of a wire file first (the franc, then the euro), the others after them, and the rows with no currency last. */
export function groupByCurrency(rows: readonly PayableRow[]): Array<[string, PayableRow[]]> {
  const groups = new Map<string, PayableRow[]>();
  for (const row of rows) {
    const group = groups.get(row.currency);
    if (group) group.push(row);
    else groups.set(row.currency, [row]);
  }
  const rank = (currency: string) => {
    const index = WIRE_CURRENCIES.indexOf(currency);
    return index >= 0 ? index : WIRE_CURRENCIES.length;
  };
  return [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b) || (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));
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
