/**
 * A comune of the official ISTAT list (`GET /api/comuni`, SU-04). The ISTAT code is the value forms store; the
 * region is derived from the comune, never chosen.
 */
export interface Comune {
  /** ISTAT code, 6 digits, always a string: the leading zeros matter (`001272` is Torino). */
  istatCode: string;
  /** Cadastral (Belfiore) code, e.g. `H501`; null when the official list does not have it yet. */
  cadastralCode: string | null;
  /** Name in Italian: what is stored as the city of a property. */
  name: string;
  /** Official denomination, with the other language where there is one (`Bolzano/Bozen`). */
  displayName: string;
  /** Province plate code, two letters. */
  provinceCode: string;
  /** CasaZen's region code (`LOM`), the key of the regional rules. */
  regionCode: string | null;
  regionIstatCode: string;
  regionName: string;
  /** False for a comune no longer in the list (merger, suppression): a stored code still resolves, but cannot be chosen again. */
  isActive: boolean;
}

/** `GET /api/comuni?q=`: the matches, and whether the official list is imported at all. */
export interface ComuneSearchResponse {
  /** False when the list is not imported: `items` is empty because there is no list, not because nothing matches. */
  datasetAvailable: boolean;
  items: Comune[];
}

/** `GET /api/comuni/status`. */
export interface ComuneAvailability {
  datasetAvailable: boolean;
  /** Date the imported list is valid at (`YYYY-MM-DD`). */
  referenceDate?: string | null;
  sourceVersion?: string | null;
}
