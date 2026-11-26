import { expect, test } from './test';

const booking = '55000000-0000-4000-8000-000000000001';
const document = '55000000-0000-4000-8000-000000000002';
const grant = 'test-only-link-grant';
const orgSlug = 'casa-lago';

for (const entry of [
  { legacy: '/checkin/' + grant, section: '/s/action/checkin/' + grant, api: '/public/checkin/', query: '?step=identity' },
  { legacy: '/documents/view/' + document, section: '/s/action/documents/' + document, api: '/public/fiscal-documents/', query: '?token=' + grant },
  { legacy: '/book/' + orgSlug + '/booking/' + booking + '/review', section: '/s/action/org/' + orgSlug + '/review/' + booking, api: '/public/bookings/' + booking + '/review', query: '?token=' + grant },
  { legacy: '/book/' + orgSlug + '/bookings/' + booking + '/cancel', section: '/s/action/org/' + orgSlug + '/cancellation/' + booking, api: '/public/bookings/' + booking + '/cancellation', query: '?token=' + grant },
]) {
  test('legacy action uses its own grant at ' + entry.section.split('/').slice(0, 4).join('/') + ' ' + entry.api, async ({ page }) => {
    const fullStay: string[] = [];
    const scoped: string[] = [];
    await page.route('**/api/**', async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path.endsWith('/public/features')) return route.fulfill({ json: { guestPortal: true } });
      if (path.includes('/public/guest-portal/')) fullStay.push(path);
      if (path.includes(entry.api)) {
        scoped.push(request.url() + (request.postData() ?? ''));
        return route.fulfill({ status: 404, json: { status: 404, code: 'document_link_invalid', title: 'Invalid link' } });
      }
      if (path.endsWith('/' + orgSlug)) return route.fulfill({ json: { slug: orgSlug, displayName: 'Casa Lago', primaryColor: null } });
      return route.fulfill({ json: [] });
    });
    await page.goto(entry.legacy + entry.query, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => new URL(page.url()).pathname).toBe(entry.section);
    await expect.poll(() => scoped.some(request => request.includes(grant))).toBe(true);
    await expect(page.locator('.guest-linked-section .stay-header-title')).toBeVisible();
    if (entry.query.includes('token=')) await expect.poll(() => new URL(page.url()).searchParams.has('token')).toBe(false);
    else await expect.poll(() => new URL(page.url()).searchParams.get('step')).toBe('identity');
    expect(fullStay).toEqual([]);
  });
}
