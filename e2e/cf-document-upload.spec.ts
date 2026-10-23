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
  await page.getByLabel('Scegli PDF o foto delle pagine').setInputFiles({ name: 'contratto-definitivo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\noriginale\n%%EOF') });
  await page.getByRole('button', { name: 'Carica documento', exact: true }).click();
  await expect(page.getByText('contratto-definitivo.pdf', { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByText('contratto-definitivo.pdf', { exact: true })).toBeVisible();
  expect(propertyDocumentCalls).toEqual([]);
});

test('ordered and rotated photos become one PDF; reload and download preserve the PDF only', async ({ page }) => {
  const { PDFDocument } = await import('pdf-lib');
  const { readFile } = await import('node:fs/promises');
  await resetE2eStorage(page, 'it');
  await page.route(`**/api/leases/${leaseId}`, route => route.fulfill({ json: { id: leaseId, propertyId, property: { id: propertyId, name: 'Casa di prova' }, status: 'Draft' } }));
  let stored: Buffer | null = null;
  await page.route(`**/api/leases/${leaseId}/documents`, async route => {
    if (route.request().method() === 'POST') {
      expect(route.request().headers()['content-type']).toContain('multipart/form-data');
      const body = route.request().postDataBuffer()!;
      expect(body.toString('latin1')).not.toContain('filename="page-1.jpg"');
      expect(body.toString('latin1')).not.toContain('filename="page-2.png"');
      const start = body.indexOf(Buffer.from('%PDF-'));
      const end = body.indexOf(Buffer.from('%%EOF'), start) + 5;
      stored = body.subarray(start, end);
      const pdf = await PDFDocument.load(stored);
      expect(pdf.getPageCount()).toBe(2);
      expect(pdf.getPage(0).getWidth()).toBeGreaterThan(pdf.getPage(0).getHeight());
      expect(pdf.getPage(1).getWidth()).toBeLessThan(pdf.getPage(1).getHeight());
      await route.fulfill({ status: 201, json: { id: 'assembled' } });
    } else await route.fulfill({ json: stored ? [{ id: 'assembled', leaseId, kind: 'Contract', fileName: 'page-2.pdf', sizeBytes: stored.length, uploadedAt: '2026-10-21T10:00:00Z' }] : [] });
  });
  await page.route(`**/api/leases/${leaseId}/documents/assembled/download`, async route => {
    await route.fulfill({ contentType: 'application/pdf', body: stored! });
  });
  await page.goto(demoUrl(`/app/long-rent/documents/upload?leaseId=${leaseId}`, 'long-term'));
  const photo = (color: string) => page.evaluate(color => {
    const canvas = document.createElement('canvas'); canvas.width = 500; canvas.height = 700;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = color; ctx.fillRect(0, 0, 500, 700);
    return canvas.toDataURL(color === 'blue' ? 'image/png' : 'image/jpeg').split(',')[1];
  }, color);
  const one = Buffer.from(await photo('red'), 'base64'), two = Buffer.from(await photo('blue'), 'base64');
  await page.getByLabel('Scegli PDF o foto delle pagine').setInputFiles([{ name: 'page-1.jpg', mimeType: 'image/jpeg', buffer: one }, { name: 'page-2.png', mimeType: 'image/png', buffer: two }]);
  await expect(page.getByRole('button', { name: 'Carica documento', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Sposta pagina 2 prima', exact: true }).click();
  await page.getByRole('button', { name: 'Ruota pagina 1', exact: true }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Carica documento', exact: true }).click();
  await expect(page.getByText('page-2.pdf', { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByText('page-2.pdf', { exact: true })).toBeVisible();
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Scarica', exact: true }).click();
  const download = await pending; expect(download.suggestedFilename()).toBe('page-2.pdf');
  expect(await readFile((await download.path())!)).toEqual(stored);
});
