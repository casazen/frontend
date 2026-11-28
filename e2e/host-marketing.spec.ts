import { expect, test } from './test';
import { demoUrl } from './helpers/demo-profile';
import { resetE2eStorage } from './helpers/locale';

test('the host can write a campaign with the guided layer and send it for approval', async ({ page }) => {
  test.setTimeout(180_000);
  await resetE2eStorage(page, 'en');
  const house = { id: 'house', name: 'Villa Sofia', photoUrls: [] };
  const condition = { version: '1.0', groups: [{ operator: 'AND', rules: [{ fieldId: 'stage', operator: 'in', value: ['returning'] }] }] };
  const segment = { id: 'audience', name: 'Returning guests', condition, createdAt: '2026-11-01T10:00:00Z' };
  const campaigns: Array<Record<string, unknown>> = [];
  await page.route('**/api/public/features', (r) => r.fulfill({ json: { crmMarketing: true } }));
  await page.route('**/api/properties?mode=short', (r) => r.fulfill({ json: [house] }));
  await page.route('**/api/campaigns/segments', (r) => r.fulfill({ json: [segment] }));
  await page.route('**/api/campaigns/segments/preview', (r) => r.fulfill({ json: { count: 1 } }));
  await page.route('**/api/campaigns/segments/audience/preview**', (r) => r.fulfill({ json: { count: 1 } }));
  await page.route('**/api/campaigns/studio/assets', (r) => r.fulfill({ json: [] }));
  await page.route('**/api/campaigns', async (r) => {
    if (r.request().method() === 'GET') return r.fulfill({ json: campaigns });
    const data = r.request().postDataJSON();
    expect(data).toMatchObject({ propertyId: 'house', segmentId: 'audience', subject: 'Weekend by the lake' });
    const campaign = { ...data, id: 'campaign', segmentName: segment.name, status: 'Draft' };
    campaigns.push(campaign);
    return r.fulfill({ json: campaign });
  });
  let submitted = false;
  await page.route('**/api/campaigns/campaign/submit', (r) => {
    submitted = true;
    campaigns[0].status = 'PendingApproval';
    return r.fulfill({ status: 204 });
  });

  await page.goto(demoUrl('/app/short-rent/crm/campaigns', 'short-stay'), { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'New campaign' }).first().click();
  await page.getByRole('button', { name: /I choose what to talk about/ }).click();
  await page.getByRole('radio', { name: /Returning guests/ }).check({ force: true });
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'I prefer to write it myself' }).click();
  await page.getByRole('textbox', { name: 'Subject', exact: true }).fill('Weekend by the lake');
  await page.getByLabel('Message text').fill('Visit Villa Sofia again.');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Send for approval' }).click();

  await expect(page.getByText('Campaign sent for approval')).toBeVisible();
  expect(submitted).toBe(true);
  await expect(page.getByRole('link', { name: /To approve/ })).toHaveAttribute('href', '/app/short-rent/approval-queue');
});

test('a host with no group is shown ready-made groups and the wizard opens on the rules of the one picked', async ({ page }) => {
  test.setTimeout(120_000);
  await resetE2eStorage(page, 'en');
  await page.route('**/api/public/features', (r) => r.fulfill({ json: { crmMarketing: true } }));
  await page.route('**/api/properties?mode=short', (r) => r.fulfill({ json: [] }));
  await page.route('**/api/campaigns/segments', (r) => r.fulfill({ json: [] }));
  await page.route('**/api/campaigns/segments/preview', (r) => r.fulfill({ json: { count: 7 } }));

  await page.goto(demoUrl('/app/short-rent/crm/segments', 'short-stay'), { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Ready-made groups' })).toBeVisible();
  await page.getByTestId('group-recipe-loyal').click();
  await expect(page.getByRole('heading', { name: 'Check who is in it' })).toBeVisible();
  await expect(page.getByText('Guests: loyal')).toBeVisible();
  await expect(page.getByTestId('segment-count')).toContainText('7');
});
