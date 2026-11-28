export const BOOKING_CODE_LENGTH = 10;

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const SEPARATORS = /[\s\u0085\-‐-―−]/g;

const LOOKALIKES: Record<string, string> = { O: '0', I: '1', L: '1' };

export function normalizeBookingCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const compact = value
    .replace(SEPARATORS, '')
    .toUpperCase()
    .replace(/[OIL]/g, (c) => LOOKALIKES[c]);
  if (compact.length !== BOOKING_CODE_LENGTH) return null;
  return [...compact].every((c) => ALPHABET.includes(c)) ? compact : null;
}

export function formatBookingCode(value: string | null | undefined): string | null {
  const code = normalizeBookingCode(value);
  return code === null ? null : `${code.slice(0, 5)}-${code.slice(5)}`;
}

export function isValidBookingCode(value: string | null | undefined): boolean {
  return normalizeBookingCode(value) !== null;
}
