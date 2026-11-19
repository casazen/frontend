import type { Page } from '@playwright/test';
import { expect, test } from './test';
import { setDemoProfile } from './helpers/demo-profile';
const token = 'a1'.repeat(32);
const invite = { orgName: 'Agenzia Demo', email: 'demo@casazen.com', name: 'Persona Demo', role: 'Collaborator', areas: ['short-rent'], expiresAt: '2027-11-25T10:00:00Z' };

async function acceptConsents(page: Page) {
  const consents = page.getByTestId('onboarding-consents-step').getByRole('checkbox');
  await expect(consents).toHaveCount(4);
  for (const consent of await consents.all()) await consent.check();
  await page.getByTestId('onboarding-consents-continue').click();
}

test.beforeEach(async ({ page }) => {
  await setDemoProfile(page, 'short-stay');
  await page.route('**/api/org-invitations/lookup', route => {
    expect(route.request().postDataJSON()).toMatchObject({ token });
    return route.fulfill({ json: invite });
  });
});
test('a tab reload retains the invitation and an accepted response opens the assigned demo area', async ({ page }) => {
  let writes = 0;
  await page.route('**/api/org-invitations/accept', route => {
    expect(route.request().postDataJSON()).toMatchObject({
      token,
      consents: { tosAccepted: true, privacyAccepted: true, dpaAccepted: true, subprocessorsAcknowledged: true },
    });
    writes++;
    return route.fulfill({ json: { orgId: 'org-demo', orgName: invite.orgName, role: invite.role, areas: invite.areas, leftEmptyOrg: false } });
  });
  await page.goto('/invite/accept?token=' + token, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('invite-accept-details')).toBeVisible();
  await expect(page).not.toHaveURL(/token=/);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const summary = page.getByTestId('invite-accept-details');
  await expect(summary).toContainText('d***@casazen.com');
  await expect(summary).not.toContainText(invite.email);
  await acceptConsents(page);
  await expect(page).toHaveURL(/\/app\/short-rent/);
  expect(writes).toBe(1);
  expect(await page.evaluate(() => sessionStorage.getItem('cz-org-invite'))).toBeNull();
});
test('a mismatch discovered by the API offers an account switch even after local checks pass', async ({ page }) => {
  let writes = 0;
  await page.route('**/api/org-invitations/accept', route => {
    writes++;
    return route.fulfill({ status: 409, json: { code: 'invitation_email_mismatch' } });
  });
  await page.goto('/invite/accept?token=' + token, { waitUntil: 'domcontentloaded' });
  await acceptConsents(page);
  await expect(page.getByTestId('invite-accept-switch')).toBeVisible();
  await expect(page.getByTestId('onboarding-consents-continue')).toHaveCount(0);
  await expect(page).toHaveURL(/\/invite\/accept$/);
  expect(writes).toBe(1);
});
test('a malformed link never sends the token and offers an exit', async ({ page }) => {
  let reads = 0;
  await page.route('**/api/org-invitations/lookup', route => { reads++; return route.fulfill({ status: 400, json: {} }); });
  await page.goto('/invite/accept?token=abc', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('invite-accept-home')).toBeVisible();
  await expect(page.getByTestId('onboarding-consents-step')).toHaveCount(0);
  expect(reads).toBe(0);
});
