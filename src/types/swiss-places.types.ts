/**
 * The official directory of the Swiss places (swisstopo, E29/F01/US01/T01, NF-124): the localities a host picks the place of a
 * property from, and the place the rules read of a property. Reference data, the same for everyone.
 */

/**
 * One locality of `GET /api/swiss/localities`: a postal code and the name of the place, and the municipality it lies in. A locality
 * that lies in several municipalities is one item for each of them (the postal locality 6600 Locarno lies in Locarno and in Muralto).
 */
export interface SwissLocality {
  /** The four digits of the postal code, e.g. `6900`. */
  postalCode: string;
  /** The name of the locality as the official directory writes it. */
  name: string;
  /** BFS number of the municipality, always a text of digits (`"5192"` is Lugano): the value a property stores as `swissMunicipalityCode`. */
  municipalityCode: string;
  /** Official name of the municipality. */
  municipalityName: string;
  /** The two letters of the canton, e.g. `TI`. */
  cantonCode: string;
}

/** `GET /api/swiss/municipalities/{bfs}`: one municipality of the directory (404 `swiss_municipality_unknown` when it has no such number). */
export interface SwissMunicipality {
  /** BFS number, a text of digits. */
  municipalityCode: string;
  /** Official name. */
  name: string;
  /** The two letters of the canton, e.g. `TI`. */
  cantonCode: string;
}

/** Where the place of a property comes from: `Stored` = the host confirmed it, `Derived` = worked out from its postal code and city (never stored by a save). */
type SwissPlaceSource = 'Stored' | 'Derived';

/**
 * `swissPlace` of the property record: where the rules place a Swiss property (the one resolver of the place, E29/F01/US01/T02).
 * Only on `GET /api/properties/{id}`, for a property in Switzerland that has a place. `ambiguous` = the postal code and the city leave
 * several municipalities open: then no municipality and no canton, and the form asks the host.
 */
export interface SwissPlace {
  municipalityCode: string | null;
  municipalityName: string | null;
  cantonCode: string | null;
  source: SwissPlaceSource;
  ambiguous: boolean;
}
