import type { ChannelCommissionMode, ChannelCostRow } from '@/types';

/** The channel costs are in euros as the Home counts its revenue: the server converts nothing, and its figures carry no currency of their own. */
export const COST_CURRENCY = 'EUR';

/** The ways a commission is settled that the page has words for, in the order they are explained. */
export const COMMISSION_MODES: readonly ChannelCommissionMode[] = ['DeductedFromPayout', 'InvoicedSeparately', 'Unknown'];

/** The rows of the report by what their cost is, each group in the order the server sent it (the highest cost rate first). */
export interface CostGroups {
  /** The commission of the channels. */
  channels: ChannelCostRow[];
  /** The card fees of the direct stays: a line of their own, never mixed with the commissions of the channels. */
  cardFees: ChannelCostRow[];
  /** The stays nobody charges the host for (entered by hand, local). */
  free: ChannelCostRow[];
}

/**
 * The rows cut by the kind of cost the server says they have: the commission of a channel, the card fees of the direct stays (their own
 * line) and no cost at all. The browser sorts nothing inside a group, and a row whose kind it does not know is a channel row: a figure of
 * the server is never dropped.
 */
export function groupCostRows(rows: readonly ChannelCostRow[]): CostGroups {
  const groups: CostGroups = { channels: [], cardFees: [], free: [] };
  for (const row of rows) {
    if (row.kind === 'PaymentFee') groups.cardFees.push(row);
    else if (row.kind === 'NoCost') groups.free.push(row);
    else groups.channels.push(row);
  }
  return groups;
}

/** The mode a channel row shows: the one the server says, `Unknown` for anything it does not know how to say (never a claim of its own). */
export function modeOf(row: Pick<ChannelCostRow, 'commissionMode'>): ChannelCommissionMode {
  return row.commissionMode !== null && COMMISSION_MODES.includes(row.commissionMode) ? row.commissionMode : 'Unknown';
}
