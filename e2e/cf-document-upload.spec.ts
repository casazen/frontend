import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { resetE2eStorage } from './helpers/locale';
const leaseId = '0b6f7a3e-5a2d-4c58-9e0a-6c8b0f2e1d11';
const propertyId = '11111111-1111-4111-8111-111111111111';

test('email → lease → upload → persisted lease documents after reload, never property documents', async ({ page }) => {
  await resetE2eStorage(page, 'it');
  await page.route(`**/api/leases/${leaseId}`, (route) => route.fulfill({ json: { id: leaseId, propertyId, property: { id: propertyId, name: 'Casa di prova', city: 'Seveso' }, status: 'Draft' } }));
  let uploaded = false;
  await page.route(`**/api/leases/${leaseId}/documents`, async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataBuffer()?.toString() ?? '';
      expect(body).toContain('contratto-definitivo.pdf'); expect(body).toContain('Contract'); expect(body).toContain('%PDF-1.4');
      uploaded = true; await route.fulfill({ status: 201, json: { id: 'doc-1' } });
    } else await route.fulfill({ json: uploaded ? [{ id: 'doc-1', leaseId, kind: 'Contract', fileName: 'contratto-definitivo.pdf', sizeBytes: 30, uploadedAt: '2026-10-21T10:00:00Z' }] : [] });
  });
  const propertyDocumentCalls: string[] = [];
  page.on('request', (request) => { if (/^\/api\/properties\/[^/]+\/documents/.test(new URL(request.url()).pathname)) propertyDocumentCalls.push(request.url()); });
  await page.goto(demoUrl(`/app/long-rent/documents/upload?leaseId=${leaseId}`, 'long-term'));
  await expect(page.getByRole('heading', { name: 'Carica i documenti in CasaZen' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Casa di prova' })).toBeVisible(); expect(uploaded).toBe(false);
  await page.getByLabel('Documento PDF (massimo 20 MB)').setInputFiles({ name: 'contratto-definitivo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\noriginale\n%%EOF') });
  await page.getByRole('button', { name: 'Carica documento', exact: true }).click();
  await expect(page.getByText('contratto-definitivo.pdf', { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByText('contratto-definitivo.pdf', { exact: true })).toBeVisible();
  expect(propertyDocumentCalls).toEqual([]);
});
