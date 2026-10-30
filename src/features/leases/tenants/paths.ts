/** The tenants of the long-term area (LR-09): the list, and the sheet of one person. */
export const LONG_RENT_TENANTS_PATH = '/app/long-rent/tenants';

/** The sheet of a person; the id is the opaque one the server gives (never a fiscal code). */
export function longRentTenantPath(id: string): string {
  return `${LONG_RENT_TENANTS_PATH}/${encodeURIComponent(id)}`;
}
