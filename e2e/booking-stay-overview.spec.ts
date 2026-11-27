import { test, expect } from './test';
import { bookingId, guestName, mockArrivalJourney, property } from './helpers/arrival-journey';
import { demoUrl } from './helpers/demo-profile';

for (const width of [390, 1440]) {
  test(`stay overview shows the assigned property and guest at ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockArrivalJourney(page);
    const photo = new URL('/site/host-site.webp', baseURL).href;
    await page.route(`**/api/properties/${property.id}`, (route) => route.fulfill({ json: { ...property, photoUrls: [photo] } }));
    await page.goto(demoUrl(`/app/short-rent/bookings/${bookingId}`, 'short-stay'));
    const overview = page.getByTestId('booking-stay-overview');
    const stay = overview.getByRole('region', { name: 'Il soggiorno' });
    const guest = overview.getByRole('region', { name: 'Informazioni ospite' });
    await expect(stay.getByRole('link', { name: property.name })).toBeVisible();
    await expect(stay.locator('img')).toHaveAttribute('src', photo);
    await expect.poll(() => stay.locator('img').evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(stay.locator('time')).toHaveCount(2);
    await expect(guest.getByText(guestName)).toBeVisible();
    await expect(guest.getByRole('link', { name: 'guest@example.test' })).toHaveAttribute('href', 'mailto:guest@example.test');
    const bounds = await Promise.all([stay.boundingBox(), guest.boundingBox()]);
    expect(bounds[0]).not.toBeNull();
    expect(bounds[1]).not.toBeNull();
    if (width === 390) expect(bounds[1]!.y).toBeGreaterThan(bounds[0]!.y);
    else expect(bounds[1]!.y).toBe(bounds[0]!.y);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await stay.getByTestId('booking-review-checkin').click();
    await expect(page).toHaveURL(/tab=guest/);
  });
}
