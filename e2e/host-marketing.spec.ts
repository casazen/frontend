import { expect, test } from './test';
import { demoUrl } from './helpers/demo-profile';
import { resetE2eStorage } from './helpers/locale';

test('the host can turn a property-scoped audience into a draft and submit it for approval', async ({ page }) => {
  test.setTimeout(180_000);
  await resetE2eStorage(page, 'en');
  const house = { id: 'house', name: 'Villa Sofia' };
  const segment = { id: 'audience', name: 'Returning guests' };
  const campaigns: Array<Record<string, unknown>> = [];
  await page.route('**/api/public/features', (r) => r.fulfill({ json: { crmMarketing: true } }));
  await page.route('**/api/properties?mode=short', (r) => r.fulfill({ json: [house] }));
  await page.route('**/api/campaigns/segments', (r) => r.fulfill({ json: [segment] }));
  await page.route('**/api/campaigns/segments/audience/preview?propertyId=house', (r) =>
    r.fulfill({ json: { count: 1 } }),
  );
  await page.route('**/api/campaigns', async (r) => {
    if (r.request().method() === 'GET') return r.fulfill({ json: campaigns });
    const data = r.request().postDataJSON();
    expect(data).toMatchObject({ propertyId: 'house', segmentId: 'audience', subject: 'Weekend by the lake' });
    const campaign = { ...data, id: 'campaign', segmentName: segment.name, status: 'Draft' };
    campaigns.push(campaign);
    return r.fulfill({ json: campaign });
  });
  await page.route('**/api/campaigns/campaign/submit', (r) => {
    campaigns[0].status = 'PendingApproval';
    return r.fulfill({ status: 204 });
  });
  await page.goto(demoUrl('/app/short-rent/crm/campaigns', 'short-stay'), { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'New campaign' }).click();
  await page.getByRole('combobox', { name: 'Property', exact: true }).selectOption('house');
  await page.getByRole('combobox', { name: 'Segment', exact: true }).selectOption('audience');
  await page.getByRole('textbox', { name: 'Subject', exact: true }).fill('Weekend by the lake');
  await page.getByRole('textbox', { name: /body/i }).fill('Visit Villa Sofia again.');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await page.getByRole('button', { name: /Weekend by the lake/ }).click();
  await page.getByRole('button', { name: /submit for approval/i }).click();
  await expect(page.getByRole('link', { name: 'Open approval queue' })).toHaveAttribute(
    'href',
    '/app/short-rent/approval-queue',
  );
});
