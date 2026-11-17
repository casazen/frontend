import { test, expect } from './test';
import { demoUrl, setDemoProfile } from './helpers/demo-profile';
import { pinE2eLocale } from './helpers/locale';

test.describe('Invito staff a una nuova agenzia', () => {
  test.beforeEach(async ({ page }) => {
    await setDemoProfile(page, 'admin');
    await pinE2eLocale(page, 'it');
  });

  test('mostra solo il modulo per il fondatore della nuova agenzia', async ({ page }) => {
    await page.goto(demoUrl('/app/admin/suppliers/invite', 'admin'), { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('host-invite-email')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('invite-comune-input')).toHaveCount(0);
    await expect(page.getByText('Invita l’amministratore di una nuova agenzia')).toBeVisible();
  });

  test('crea un invito personale e mostra il suo QR', async ({ page }) => {
    await page.route('**/api/admin/host-invites', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({
        inviteId: '11111111-1111-1111-1111-111111111111', expiresAt: '2027-08-01T00:00:00Z',
        url: 'https://casazen.example/invito-host/12345678901234567890',
      }) });
    });
    await page.goto(demoUrl('/app/admin/suppliers/invite', 'admin'), { waitUntil: 'domcontentloaded' });
    await page.getByTestId('host-invite-email').fill('agenzia@example.com');
    await page.getByTestId('host-invite-submit').click();
    await expect(page.getByTestId('qr-agency-image')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('qr-agency-url')).toContainText('/invito-host/');
  });
});
