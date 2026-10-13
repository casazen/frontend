/**
 * Values of `selected` that are service category codes of `codes` (the backend catalog). A stored
 * value that is not a code (kept by the SU-03 migration) is dropped only here, when the user saves
 * after being warned; without the catalog nothing is dropped and the API decides.
 */
export function keepKnownCategories(selected: string[], codes: string[] | undefined): string[] {
  return codes ? selected.filter((value) => codes.includes(value)) : selected;
}

/** Values of `selected` that are not codes of the loaded catalog. */
export function unknownCategories(selected: string[], codes: string[] | undefined): string[] {
  return codes ? selected.filter((value) => !codes.includes(value)) : [];
}
