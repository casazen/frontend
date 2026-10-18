import { describe, expect, it } from 'vitest';
import { uiAreaFromPath } from '@/lib/ui-area';

describe('uiAreaFromPath', () => {
  it.each([
    ['/app/short-rent', 'short-rent'],
    ['/app/short-rent/properties/123', 'short-rent'],
    ['/app/long-rent/leases', 'long-rent'],
    ['/app/supplier/inbox', 'supplier'],
    ['/app/admin', 'admin'],
    ['/app/admin/users', 'admin'],
    // The customer's administration (decision D1): same accent as `admin`, no route yet.
    ['/app/account/people', 'account'],
  ])('uiAreaFromPath_%s_Is%s', (pathname, area) => {
    expect(uiAreaFromPath(pathname)).toBe(area);
  });

  it.each([
    '/',
    '/login',
    '/onboarding',
    '/app',
    '/app/',
    '/app/choose-context',
    '/app/no-access',
    '/app/unknown/page',
    '/book/villa/property/casa-mare',
    // Only `/app/<area>` is an area: the same word elsewhere is not.
    '/short-rent',
    '/other/short-rent',
    '/applications/short-rent',
  ])('uiAreaFromPath_%s_HasNoArea', (pathname) => {
    expect(uiAreaFromPath(pathname)).toBeNull();
  });
});
