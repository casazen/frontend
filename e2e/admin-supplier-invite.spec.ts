import { test, expect } from './test';
import { demoUrl, setDemoProfile } from './helpers/demo-profile';
import { pinE2eLocale } from './helpers/locale';

test.describe('Admin supplier invite (#357)', () => {
  test.beforeEach(async ({ page }) => {
    await setDemoProfile(page, 'admin');
    await pinE2eLocale(page, 'it');
  });

  test('AC-A1: invite form renders for admin user', async ({ page }) => {
    await page.goto(demoUrl('/app/admin/suppliers/invite', 'admin'), { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('invite-email-input')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('invite-comune-input')).toBeVisible();
    await expect(page.getByTestId('invite-submit-btn')).toBeDisabled();
  });

  test('AC-A1: happy-path invite shows success toast', async ({ page }) => {
    await page.route('**/api/admin/suppliers/invite', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          inviteId: '11111111-1111-1111-1111-111111111111',
          expiresAt: '2026-08-01T00:00:00Z',
        }),
      });
    });

    await page.goto(demoUrl('/app/admin/suppliers/invite', 'admin'), { waitUntil: 'domcontentloaded' });
    await page.getByTestId('invite-email-input').fill('fornitore@example.com');
    await page.getByTestId('invite-comune-input').fill('H501');
    await page.getByTestId('invite-submit-btn').click();

    await expect(page.getByText(/Invito inviato — scade/i)).toBeVisible({ timeout: 10_000 });
  });

  test('AC-A3: duplicate invite shows specific error toast', async ({ page }) => {
    await page.route('**/api/admin/suppliers/invite', async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Duplicate', code: 'duplicate_invite' }),
      });
    });

    await page.goto(demoUrl('/app/admin/suppliers/invite', 'admin'), { waitUntil: 'domcontentloaded' });
    await page.getByTestId('invite-email-input').fill('dup@example.com');
    await page.getByTestId('invite-comune-input').fill('H501');
    await page.getByTestId('invite-submit-btn').click();

    await expect(page.getByText('Esiste già un invito attivo per questa email')).toBeVisible({ timeout: 10_000 });
  });

  test('AC-A3: email delivery failure shows specific error toast', async ({ page }) => {
    await page.route('**/api/admin/suppliers/invite', async (route) => {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'SendGrid failed', code: 'invite_email_failed' }),
      });
    });

    await page.goto(demoUrl('/app/admin/suppliers/invite', 'admin'), { waitUntil: 'domcontentloaded' });
    await page.getByTestId('invite-email-input').fill('fail@example.com');
    await page.getByTestId('invite-comune-input').fill('H501');
    await page.getByTestId('invite-submit-btn').click();

    await expect(page.getByText('Consegna email fallita — riprova tra qualche minuto')).toBeVisible({ timeout: 10_000 });
  });
});
