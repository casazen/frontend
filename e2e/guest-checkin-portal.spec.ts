import { test, expect } from '@playwright/test';

test.describe('Guest check-in portal', () => {
  test('shows invalid link for unknown token', async ({ page }) => {
    await page.goto('/checkin/invalid-token-00000000000000000000000000000000');
    await expect(page.getByText(/invalid|non valido/i)).toBeVisible({ timeout: 15_000 });
  });

  test('renders wizard progress on mocked context', async ({ page }) => {
    await page.route('**/api/public/checkin/**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            sessionId: '11111111-1111-1111-1111-111111111111',
            propertyName: 'Villa Demo',
            checkInDate: '2026-07-10T00:00:00Z',
            checkOutDate: '2026-07-12T00:00:00Z',
            status: 'Inviato',
            guestPrefill: {
              firstName: 'Mario',
              lastName: 'Rossi',
              email: 'mario@example.com',
              nationality: 'IT',
              documentNumber: '',
              documentIssuingCountry: 'IT',
              placeOfBirth: 'Roma',
            },
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/checkin/demo-token-abcdef1234567890abcdef1234567890');
    await expect(page.getByTestId('checkin-progress')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Villa Demo')).toBeVisible();
  });
});
