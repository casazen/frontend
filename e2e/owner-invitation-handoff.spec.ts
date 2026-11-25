import { expect, test } from './test';
import { setDemoProfile } from './helpers/demo-profile';

test('an invited owner can recover delayed access and enter the owner portal directly', async ({ page }) => {
  await setDemoProfile(page, 'onboarding');
  const token = 'ab'.repeat(32);
  const visited: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) visited.push(new URL(frame.url()).pathname);
  });
  let submissions = 0;
  await page.route('**/api/owner-invitations/accept', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ token });
    submissions++;
    await route.fulfill({ json: {
      ownerUserId: 'owner-demo', agencyIds: ['agency-demo'], ownedPropertyIds: [],
      alreadyAccepted: submissions > 1, claimsRefresh: submissions === 1 ? 'failed' : 'published',
    } });
  });
  await page.route('**/api/owner-portal/properties', (route) => route.fulfill({ json: [] }));
  await page.goto('/portale-proprietari/invito?token=' + token, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('owner-invitation-retry')).toBeVisible();
  await expect(page).not.toHaveURL(/token=/);
  await page.getByTestId('owner-invitation-retry').click();
  await expect(page).toHaveURL(/\/portale-proprietari\/?$/);
  await expect(page.getByTestId('owner-nav')).toBeVisible();
  expect(submissions).toBe(2);
  expect(visited.filter((path) => path.startsWith('/app') || path.includes('onboarding'))).toEqual([]);
});
