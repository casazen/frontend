import { isAxiosError } from 'axios';
import { getProblemCode } from '@/lib/api-errors';
import type { SwissLocality } from '@/types/swiss-places.types';

/** 422 `code` of a search or a lookup that reached a directory that is not loaded (backend `SwissPlaceErrorCodes.Unavailable`). */
const PLACES_UNAVAILABLE_CODE = 'swiss_places_unavailable';

/** The directory of the Swiss places is not loaded on the server: said as it is, never as "no such place". */
export function isSwissPlacesUnavailable(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 422 && getProblemCode(error.response.data) === PLACES_UNAVAILABLE_CODE;
}

/** «6900 Lugano · TI»: a locality as one line. */
export function swissLocalityLabel(locality: Pick<SwissLocality, 'postalCode' | 'name' | 'cantonCode'>): string {
  return `${locality.postalCode} ${locality.name} · ${locality.cantonCode}`;
}

/** What tells one item of a search from another: a locality that lies in two municipalities is two items with the same postal code and name. */
export function swissLocalityKey(locality: SwissLocality): string {
  return [locality.postalCode, locality.municipalityCode, locality.name].join('|');
}

/**
 * The four digits of a Swiss postal code as the server reads it: the spaces and a `CH-` (or `CH`) prefix are ignored and the six digits
 * of a code with its add-on give their first four (`CH-6900`, `6 900` and `690000` are `6900`). `null` for anything else (letters,
 * five digits such as an Italian CAP, a code below 1000, an unfinished one): nothing is guessed from a malformed postal code.
 */
export function fourDigitPostalCode(value: string | null | undefined): string | null {
  if (!value) return null;
  let text = value.replace(/\s+/g, '').toUpperCase();
  if (text.startsWith('CH-')) text = text.slice(3);
  else if (text.startsWith('CH')) text = text.slice(2);
  if (!/^(\d{4}|\d{6})$/.test(text) || text.startsWith('0')) return null;
  return text.slice(0, 4);
}

/**
 * A place name as the server compares it (`SwissLocality.NormalizeName`): lower case, without diacritics (`Zürich` and `zurich` are
 * the same), typographic apostrophes as `'`, spaces trimmed and collapsed. Nothing else changes: «San» and «S.» stay different.
 */
export function normalizeSwissName(value: string | null | undefined): string {
  if (!value?.trim()) return '';
  return value
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .normalize('NFC');
}

/** What the localities of one postal code say about the place of a property. */
export type SwissPlaceProposal =
  /** The directory has nothing for that postal code. */
  | { kind: 'none' }
  /** The postal code (and the city) leave one municipality: the form proposes it and the host confirms it. */
  | { kind: 'single'; locality: SwissLocality }
  /** Several municipalities are open: the form lists them and chooses none. */
  | { kind: 'ambiguous'; candidates: SwissLocality[] };

/**
 * The place a postal code gives, by the rules the server uses to place a property that has none stored (`PropertySwissPlaceResolver`):
 * the only municipality; else, when all of them lie in one canton, the one whose official name is the city; else the one that has a
 * locality of that postal code named as the city (only one municipality has it); else none (ambiguous). `6900` alone is ambiguous
 * (Lugano, Massagno, Paradiso); with the city Lugano it is Lugano. A name never decides when the municipalities lie in two cantons
 * (`6533`) unless a locality of that name lies in one municipality only. Nothing is ever chosen for the host: it only confirms.
 *
 * @param localities the items `GET /api/swiss/localities` gave for the four digits of the postal code
 */
export function proposeSwissPlace(localities: SwissLocality[], city: string | null | undefined): SwissPlaceProposal {
  if (localities.length === 0) return { kind: 'none' };

  const name = normalizeSwissName(city);
  const single = (municipalityCode: string): SwissPlaceProposal => {
    const rows = localities.filter((locality) => locality.municipalityCode === municipalityCode);
    // The locality the host wrote as the city, else the first one of the municipality (the directory lists them in order).
    return { kind: 'single', locality: rows.find((locality) => normalizeSwissName(locality.name) === name) ?? rows[0] };
  };

  const municipalityCodes = [...new Set(localities.map((locality) => locality.municipalityCode))];
  if (municipalityCodes.length === 1) return single(municipalityCodes[0]);

  if (name) {
    if (new Set(localities.map((locality) => locality.cantonCode)).size === 1) {
      const byMunicipality = municipalityCodes.filter(
        (code) => normalizeSwissName(localities.find((locality) => locality.municipalityCode === code)?.municipalityName) === name,
      );
      if (byMunicipality.length === 1) return single(byMunicipality[0]);
      if (byMunicipality.length > 1) return { kind: 'ambiguous', candidates: localities };
    }

    const byLocality = [...new Set(localities.filter((locality) => normalizeSwissName(locality.name) === name).map((locality) => locality.municipalityCode))];
    if (byLocality.length === 1) return single(byLocality[0]);
  }

  return { kind: 'ambiguous', candidates: localities };
}
