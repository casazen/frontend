import { expect, test } from '@playwright/test';

test('post-stay actions follow the host settings and the original booking channel', async ({ page, baseURL }) => {
  test.slow();
  const token = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef';
  const api = new URL(`/api/public/guest-portal/${token}`, baseURL).href;
  await page.route(new URL('/api/public/features', baseURL).href, route => route.fulfill({ json: { guestPortal: true } }));
  let reviewAvailable = true;
  await page.route(api, route => route.fulfill({ json: {
    stay: { propertyName: 'Villa Test', checkIn: '2025-10-01', checkOut: '2025-10-07',
      bookingCode: 'PORTAL-TEST', guests: 2, status: 'checkedOut', isDirect: false, isOta: true },
    branding: { name: 'Casa Test' }, language: 'en', checkInCompleted: true,
  } }));
  await page.route(api + '/stay', route => route.fulfill({ json: {
    guide: {}, chatOpen: false, bookingChannel: 'BookingCom', reviewAvailable,
  } }));
  await page.route(api + '/host-extras?*', route => route.fulfill({ json: { offers: [], orders: [] } }));
  const portal = `/s/${token}?lang=en`;
  await page.goto(portal, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('link', { name: 'Write a review' })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('The chat is closed.')).toBeVisible();
  reviewAvailable = false;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('The chat is closed.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Write a review' })).toHaveCount(0);
  await page.goto(portal + '&page=details', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('link', { name: 'Booking.com' }))
    .toHaveAttribute('href', 'https://secure.booking.com/myreservations.html');
});
