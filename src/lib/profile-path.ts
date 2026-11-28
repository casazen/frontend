import type { AppContextKey } from '@/config/route-manifest';

export function profilePathForContext(context: AppContextKey | null): string {
  if (context === 'account') return '/app/account/profile';
  if (context === 'admin') return '/app/admin/profile';
  if (context === 'long-rent') return '/app/long-rent/profile';
  if (context === 'supplier') return '/app/supplier/profile';
  return '/app/short-rent/profile';
}
