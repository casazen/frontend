import { expect, test } from './test';
import { bookingId, mockArrivalJourney } from './helpers/arrival-journey';
import { demoUrl } from './helpers/demo-profile';

for (const width of [390, 1440]) {
  test(`host priorities and booking overview at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockArrivalJourney(page);
    await page.goto(demoUrl('/app/short-rent', 'short-stay'));
    await expect(page.getByTestId('home-today')).toBeVisible();
    await expect(page.getByTestId('home-todo')).toBeVisible();
    await expect(page.getByTestId('home-todo-path')).toHaveCount(0);
    await expect(page.locator('#home-numbers-title')).toHaveCount(0);
    await page.goto(demoUrl(`/app/short-rent/bookings/${bookingId}`, 'short-stay'));
    await expect(page.getByTestId('booking-stay-overview')).toBeVisible();
    await expect(page.getByTestId('booking-next-step')).not.toBeVisible();
    await expect(page.getByTestId('booking-tab-portal')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
