import type { AppContextKey } from '@/config/route-manifest';

/**
 * Where "Profilo" leads from the area the user is in (the menu of the profile in the header and the one of the sheet "Altro"
 * of the phone): each area has its own profile page. Without an area the profile of Affitti brevi, where the account lives.
 */
export function profilePathForContext(context: AppContextKey | null): string {
  if (context === 'admin') return '/app/admin/profile';
  if (context === 'long-rent') return '/app/long-rent/profile';
  if (context === 'supplier') return '/app/supplier/profile';
  return '/app/short-rent/profile';
}
