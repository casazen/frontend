/**
 * A comune of the official ISTAT list (`GET /api/comuni`, SU-04). The ISTAT code is the value forms store; the
 * region is derived from the comune, never chosen.
 */
export interface Comune {
  /** ISTAT code, 6 digits, always a string: the leading zeros matter (`001272` is Torino). */
  istatCode: string;
  cadastralCode: string | null;
  name: string;
  displayName: string;
  provinceCode: string;
  regionCode: string | null;
  regionIstatCode: string;
  regionName: string;
  isActive: boolean;
}

export interface ComuneSearchResponse {
  /** False when the list is not imported: `items` is empty because there is no list, not because nothing matches. */
  datasetAvailable: boolean;
  items: Comune[];
}

export interface ComuneAvailability {
  datasetAvailable: boolean;
  referenceDate?: string | null;
  sourceVersion?: string | null;
}
