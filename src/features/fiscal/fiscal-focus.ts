import type { FiscalPropertyRow, FiscalRegimeSnapshot } from '@/api/fiscal.api';
import type { FiscalRegimeStatus } from '@/lib/status-dictionary';

export function fiscalRegimeStatus(row: Pick<FiscalPropertyRow, 'assignedRegime' | 'regimeConfirmed' | 'recommendedRegime'>): FiscalRegimeStatus {
  if (row.regimeConfirmed && row.assignedRegime) return 'Confirmed';
  return row.recommendedRegime ? 'ToConfirm' : 'NotChosen';
}

export type FiscalFocus =
  /** A taxpayer is over the threshold and no partita IVA is on record: the tax profile comes first. */
  | { kind: 'vat' }
  | { kind: 'properties' }
  | { kind: 'ok' }
  | { kind: 'reports' };

/** A taxpayer over the short-rental threshold is presumed to run a business, and the business regimes need a partita IVA. */
function needsPartitaIva(snapshot: Pick<FiscalRegimeSnapshot, 'requiresPartitaIva' | 'hasPartitaIva'>): boolean {
  return snapshot.requiresPartitaIva && !snapshot.hasPartitaIva;
}

/**
 * The one thing to do first, in this order: the partita IVA when a taxpayer is over the threshold and has none, the first
 * property whose regime is to be confirmed or chosen, and when nothing is left (or the person may not change anything) the
 * reports. Only what the backend says can be chosen counts (`availableRegimes`): a button that leads nowhere is not offered.
 */
export function fiscalFocus(snapshot: FiscalRegimeSnapshot, canWrite: boolean): FiscalFocus {
  const open = snapshot.properties.filter((row) => fiscalRegimeStatus(row) !== 'Confirmed');
  const missingVat = needsPartitaIva(snapshot);

  if (canWrite && missingVat) return { kind: 'vat' };

  if (canWrite && open.some((row) => (row.availableRegimes ?? []).length > 0)) return { kind: 'properties' };

  return open.length === 0 && !missingVat ? { kind: 'ok' } : { kind: 'reports' };
}
