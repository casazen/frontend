import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';

test.describe('Navigation layout unification (#259)', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('desktop sidebar shows grouped sections', async ({ page }) => {
    await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });

    const sidebar = page.getByRole('complementary', { name: 'Main navigation' });
    await expect(sidebar.getByText(/Operazioni|Operations/i)).toBeVisible();
    await expect(sidebar.getByText(/Finanza|Finance/i)).toBeVisible();
  });

  test('calendar route highlights Calendario not Prenotazioni in sidebar', async ({ page }) => {
    await page.goto(demoUrl('/app/short-rent/bookings/calendar', 'short-stay'), {
      waitUntil: 'domcontentloaded',
    });

    const sidebar = page.getByRole('complementary', { name: 'Main navigation' });
    const calendarLink = sidebar.getByRole('link', { name: /Calendario|Calendar/i });
    const bookingsLink = sidebar.getByRole('link', { name: /Prenotazioni|Bookings/i });

    await expect(calendarLink).toHaveAttribute('aria-current', 'page');
    await expect(bookingsLink).not.toHaveAttribute('aria-current', 'page');
  });

  test('revenue page uses app shell with sidebar', async ({ page }) => {
    await page.goto(demoUrl('/app/short-rent/payments/revenue', 'short-stay'), {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.getByRole('complementary', { name: 'Main navigation' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Analisi ricavi|Revenue Analytics/i })).toBeVisible();
  });

  test('CIN page uses app shell with sidebar', async ({ page }) => {
    await page.goto(demoUrl('/app/short-rent/cin', 'short-stay'), { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('complementary', { name: 'Main navigation' })).toBeVisible();
    await expect(page.getByTestId('cin-compliance-page')).toBeVisible();
  });
});

test.describe('Navigation layout unification — mobile (#259)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('workspace switcher is not in header on dual-role mobile', async ({ page }) => {
    await page.goto(demoUrl('/app/short-rent', 'dual'), { waitUntil: 'domcontentloaded' });

    const header = page.locator('header');
    await expect(header.getByRole('tablist', { name: 'Workspace context' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    await expect(page.getByRole('dialog').getByRole('tablist', { name: 'Workspace context' })).toBeVisible();
  });
});
