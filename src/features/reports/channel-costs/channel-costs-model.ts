import type { ChannelCommissionMode, ChannelCostRow } from '@/types';

export const COMMISSION_MODES: readonly ChannelCommissionMode[] = ['DeductedFromPayout', 'InvoicedSeparately', 'Unknown'];

export interface CostGroups {
  channels: ChannelCostRow[];
  cardFees: ChannelCostRow[];
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

export function modeOf(row: Pick<ChannelCostRow, 'commissionMode'>): ChannelCommissionMode {
  return row.commissionMode !== null && COMMISSION_MODES.includes(row.commissionMode) ? row.commissionMode : 'Unknown';
}
