import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { resetE2eStorage } from './helpers/locale';

const id = 'guest-gdpr-e2e';
const exported = { version: 1, guest: { id, firstName: 'Giulia', lastName: 'Bianchi' } };

test('guest Privacy exports the JSON returned by the GDPR API (#145)', async ({ page }) => {
  test.setTimeout(60_000);
  await resetE2eStorage(page, 'it');
  await page.route(`**/api/guests/${id}`, (route) => route.fulfill({ json: {
    ...exported.guest, email: 'giulia@example.test', nationality: 'IT',
    isDeleted: false, erasureRequested: false, marketingConsent: false, hasDocumentScan: false,
  } }));
  await page.route(/\/api\/bookings(?:[/?].*)?$/, (route) => route.fulfill({ json: { items: [], totalCount: 0, page: 1, pageSize: 20 } }));
  await page.route(`**/api/gdpr/guests/${id}`, (route) => route.fulfill({ json: {
    guestId: id, marketing: { granted: false, version: '' }, privacyNotice: { version: '' },
    consentHistory: [], retention: [], isDeleted: false, hasDocumentScan: false, hasOpenBookings: false,
  } }));
  let exports = 0;
  await page.route(`**/api/gdpr/guests/${id}/export`, (route) => {
    exports += 1;
    return route.fulfill({ json: exported });
  });
  await page.goto(demoUrl(`/app/short-rent/guests/${id}?tab=privacy`, 'short-stay'));
  await expect(page.getByTestId('gdpr-export-button')).toBeVisible({ timeout: 20_000 });
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('gdpr-export-button').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`gdpr-export-${id}.json`);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(JSON.parse(Buffer.concat(chunks).toString())).toEqual(exported);
  expect(exports).toBe(1);
});
