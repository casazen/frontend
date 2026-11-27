import { expect, test } from './test';

for (const viewport of [{ width: 320, height: 740 }, { width: 768, height: 1024 }, { width: 1791, height: 837 }]) {
  test(`organization invite and legal consents reflow at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.route('**/api/org-invitations/lookup', (route) => route.fulfill({
      json: {
        orgName: 'Agenzia Casa Lago',
        email: 'demo@casazen.com',
        name: 'Collaboratore',
        role: 'Admin',
        areas: ['short-rent', 'long-rent'],
        expiresAt: '2026-11-25T10:00:00Z',
      },
    }));
    await page.goto(`/invite/accept?token=${'a1'.repeat(32)}`);

    const summary = page.getByTestId('invite-accept-details');
    const consents = page.getByTestId('onboarding-consents-step');
    await expect(summary).toBeVisible();
    await expect(consents).toBeVisible();
    const details = (await summary.boundingBox())!;
    const form = (await consents.boundingBox())!;
    if (viewport.width < 768) {
      expect(form.y).toBeGreaterThanOrEqual(details.y + details.height);
    } else {
      expect(form.x).toBeGreaterThanOrEqual(details.x + details.width);
      expect(form.y).toBeLessThan(details.y + details.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);

    const accept = page.getByTestId('onboarding-consents-continue');
    await expect(accept).toBeDisabled();
    for (const checkbox of await consents.getByRole('checkbox').all()) await checkbox.check();
    await expect(accept).toBeEnabled();
    await accept.scrollIntoViewIfNeeded();
    await expect(accept).toBeInViewport();
  });
}
