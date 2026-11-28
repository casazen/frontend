export const LONG_RENT_TENANTS_PATH = '/app/long-rent/tenants';

export function longRentTenantPath(id: string): string {
  return `${LONG_RENT_TENANTS_PATH}/${encodeURIComponent(id)}`;
}
