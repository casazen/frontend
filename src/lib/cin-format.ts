import { z } from 'zod';

/**
 * CIN (Codice Identificativo Nazionale, D.L. 145/2023 art. 13-ter) format.
 *
 * Mirror of the backend single source of truth `Casazen.Core/Regulatory/CinFormat.cs`: keep the two in
 * sync. Official composition (MiTur interoperability decree prot. 16726 of 06/06/2024): `IT` + ISTAT
 * province (3 digits) + ISTAT comune (3 digits) + ISTAT category (2 characters) + random alphanumeric
 * string (at most 8). Real CINs are 18 characters, e.g. `IT058091C27G5FFZDZ`.
 */

/** Valid normalized CIN. */
export const CIN_PATTERN = /^IT[0-9]{6}[A-Z0-9]{2}[A-Z0-9]{1,8}$/;

/**
 * The invented format CasaZen used to require (`IT-12345-0123456789`), normalized. It also matches
 * {@link CIN_PATTERN} (the category is only "2 characters"), so it is rejected explicitly.
 */
export const LEGACY_CIN_PATTERN = /^IT[0-9]{15}$/;

/** Every whitespace (non-breaking spaces included) and every hyphen/dash: ignored in a CIN. */
const CIN_SEPARATORS = /[\s\u0085\-\u2010-\u2015\u2212]/g;

/** i18n key of the "invalid CIN" message. */
export const CIN_FORMAT_MESSAGE_KEY = 'property.validation.cin.format';

/**
 * Normalized form to validate, store and display: no whitespace, no hyphens/dashes, upper case.
 * Other characters (dots, slashes, a "CIN:" prefix) are kept so that validation rejects them.
 * Returns `null` when nothing is left (no CIN).
 */
export function normalizeCin(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(CIN_SEPARATORS, '').toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

/** True when the value, once normalized, is a CIN in the official format. */
export function isValidCin(value: string | null | undefined): boolean {
  const normalized = normalizeCin(value);
  return normalized !== null && CIN_PATTERN.test(normalized) && !LEGACY_CIN_PATTERN.test(normalized);
}

/** True for an empty value (no CIN) or a valid CIN: the rule of the optional CIN fields. */
export function isEmptyOrValidCin(value: string | null | undefined): boolean {
  return normalizeCin(value) === null || isValidCin(value);
}

/** Optional CIN form field: empty or a valid CIN (spaces, hyphens and case ignored). */
export const optionalCinSchema = z
  .string()
  .refine(isEmptyOrValidCin, { message: CIN_FORMAT_MESSAGE_KEY })
  .optional();
