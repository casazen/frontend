import type { FiscalTaxProfile, FiscalTaxProfileUpdate } from '@/api/fiscal.api';

/** Partita IVA: 11 digits. */
export const PARTITA_IVA = /^\d{11}$/;
/** Codice fiscale: 16 characters for a person, 11 digits for an entity (same rule as the backend). */
export const FISCAL_CODE = /^([A-Z0-9]{16}|\d{11})$/;

export const compactIdentifier = (value: string) => value.replace(/\s+/g, '');

/**
 * Fields the host changed with respect to the saved profile: only these are sent, so the saved values are never
 * overwritten by the form's defaults (A5-23). An emptied codice fiscale is sent as `''` (cleared).
 */
export function taxProfileChanges(
  saved: FiscalTaxProfile,
  form: { hasPartitaIva: boolean; partitaIvaNumber: string; fiscalCode: string },
): FiscalTaxProfileUpdate {
  const changes: FiscalTaxProfileUpdate = {};
  if (form.hasPartitaIva !== saved.hasPartitaIva) changes.hasPartitaIva = form.hasPartitaIva;
  const number = compactIdentifier(form.partitaIvaNumber);
  if (form.hasPartitaIva && number !== (saved.partitaIvaNumber ?? '')) changes.partitaIvaNumber = number;
  const fiscalCode = compactIdentifier(form.fiscalCode).toUpperCase();
  if (fiscalCode !== (saved.fiscalCode ?? '')) changes.fiscalCode = fiscalCode;
  return changes;
}
