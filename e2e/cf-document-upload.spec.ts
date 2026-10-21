import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { resetE2eStorage } from './helpers/locale';

const leaseId = '0b6f7a3e-5a2d-4c58-9e0a-6c8b0f2e1d11';
const propertyId = '11111111-1111-4111-8111-111111111111';
const landing = `/app/long-rent/documents/upload?leaseId=${leaseId}`;

test('partner email → correct house → document upload → archived document', async ({ page }) => {
  await resetE2eStorage(page, 'it');
  await page.route(`**/api/leases/${leaseId}`, (route) => route.fulfill({ json: {
    id: leaseId, propertyId, property: { id: propertyId, name: 'Casa di prova', city: 'Seveso' }, status: 'Draft',
  } }));
  let uploaded = false;
  await page.route(`**/api/properties/${propertyId}/documents`, async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataBuffer()?.toString() ?? '';
      expect(body).toContain('contratto-definitivo.pdf');
      expect(body).toContain('Other');
      expect(body).toContain('%PDF-1.4');
      uploaded = true;
      await route.fulfill({ status: 201, json: { id: 'doc-1' } });
      return;
    }
    await route.fulfill({ json: uploaded ? [{ id: 'doc-1', fileName: 'contratto-definitivo.pdf', documentType: 'Other', fileType: 'pdf', uploadedAt: '2026-10-21T10:00:00Z' }] : [] });
  });
  await page.goto(demoUrl(landing, 'long-term'));
  await expect(page.getByRole('heading', { name: 'Carica i documenti in CasaZen' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Casa di prova' })).toBeVisible();
  expect(uploaded).toBe(false);
  await page.getByRole('button', { name: 'Carica documento' }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'contratto-definitivo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nprova\n%%EOF') });
  await page.getByRole('button', { name: 'Carica', exact: true }).click();
  await expect(page.getByText('contratto-definitivo.pdf', { exact: true })).toBeVisible();
  expect(uploaded).toBe(true);
});
