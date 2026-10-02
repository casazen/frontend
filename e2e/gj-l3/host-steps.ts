import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/** 1x1 PNG: accepted by the document upload (PNG, <= 10 MB). */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

export const PROPERTY = {
  name: 'Casa GJ Trastevere',
  description: 'Appartamento di prova per il Golden Journey L3',
  address: 'Via della Lungaretta 10',
  city: 'Roma',
  postalCode: '00153',
  // Format verified in .claude/context/regulations/cin.md (CinFormat): not a real structure.
  cin: 'IT058091C27G5FFZDZ',
  nightlyRate: 100,
} as const;

/** Onboarding wizard as a new host sees it: operator type, consents, plan. */
export async function completeHostOnboarding(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: /Come vuoi usare CasaZen/i })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Scegli' }).first().click(); // "Affitti brevi"
  const consents = page.getByTestId('onboarding-consents-step');
  await expect(consents).toBeVisible({ timeout: 20_000 });
  for (const checkbox of await consents.getByRole('checkbox').all()) await checkbox.click();
  await page.getByTestId('onboarding-consents-continue').click();
  await expect(page.getByTestId('plan-selection-grid')).toBeVisible();
  await page.getByTestId('onboarding-plan-confirm').click();
  // Roles are granted through the (mock) Management API; the "roles pending" card must not stay on screen.
  await expect(page.getByTestId('onboarding-roles-pending')).toHaveCount(0, { timeout: 20_000 });
  await expect(page).toHaveURL(/\/app\/short-rent/, { timeout: 30_000 });
}

/** Creates the property from the form; returns its id (read from the list link). */
export async function createProperty(page: Page, slug: string): Promise<string> {
  await page.goto('/app/short-rent/properties/create');
  await page.locator('#name').fill(PROPERTY.name);
  await page.locator('#description').fill(PROPERTY.description);
  await page.locator('#slug').fill(slug);
  await page.locator('#cinCode').fill(PROPERTY.cin);
  await page.locator('#address').fill(PROPERTY.address);
  await page.locator('#city').fill(PROPERTY.city);
  await page.locator('#postalCode').fill(PROPERTY.postalCode);
  await page.locator('#bedrooms').fill('2');
  await page.locator('#bathrooms').fill('1');
  await page.locator('#maxGuests').fill('4');
  await page.locator('#nightlyRate').fill(String(PROPERTY.nightlyRate));
  await page.getByRole('button', { name: 'Crea immobile' }).click();
  await expect(page).toHaveURL(/\/app\/short-rent\/properties$/, { timeout: 30_000 });
  const link = page.getByRole('link', { name: PROPERTY.name }).first();
  await expect(link).toBeVisible({ timeout: 15_000 });
  const href = (await link.getAttribute('href')) ?? '';
  const id = href.split('/').pop() ?? '';
  expect(id, 'property id from the list link').toMatch(/^[0-9a-f-]{36}$/);
  return id;
}

async function uploadDocument(page: Page, type: string): Promise<void> {
  await page.getByRole('button', { name: 'Carica documento' }).click();
  await page.locator('#documentType').selectOption(type);
  await page.locator('input[type="file"]').setInputFiles({ name: `${type}.png`, mimeType: 'image/png', buffer: PNG_1X1 });
  await page.getByRole('dialog').getByRole('button', { name: 'Carica', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 20_000 });
}

/** Compliance activation wizard (D.L. 145/2023): documents, safety checklist, review, activate. */
export async function activateProperty(page: Page, propertyId: string): Promise<void> {
  const base = `/app/short-rent/properties/${propertyId}/activation`;

  await page.goto(`${base}?step=documents`);
  await expect(page.getByTestId('activation-panel-documents')).toBeVisible({ timeout: 20_000 });
  for (const type of ['CinCertificate', 'PropertyLicense']) {
    await uploadDocument(page, type);
    await expect(page.getByTestId('activation-documents')).toContainText(`${type}.png`);
  }

  await page.goto(`${base}?step=safety`);
  const form = page.getByTestId('safety-checklist-form');
  await expect(form).toBeVisible({ timeout: 20_000 });
  const yesNo = (name: string, answer: 'Sì' | 'No') =>
    form.locator(`input[name="${name}"]`).nth(answer === 'Sì' ? 0 : 1).check();
  await yesNo('safety-entrepreneurial', 'No');
  await yesNo('safety-gas', 'No');
  await form.getByText('Nessun apparecchio a combustione').click();
  await form.locator('#safety-floor-count').fill('1');
  const answerYes = async (code: string) => form.getByTestId(`safety-item-${code}`).getByRole('radio').first().check();
  await answerYes('FireExtinguishers');
  await form.getByTestId('safety-item-FireExtinguishers').getByLabel(/Numero|Quantit/i).first().fill('1');
  await form.getByTestId('safety-item-FireExtinguishers').getByLabel(/Posizione|Dove/i).first().fill('Ingresso');
  await answerYes('BdsrDeclaration');
  await form.getByTestId('safety-confirm').click();
  await form.getByTestId('safety-save').click();
  await expect(form.getByTestId('safety-complete')).toBeVisible({ timeout: 20_000 });

  await page.goto(`${base}?step=review`);
  await expect(page.getByTestId('activation-review')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('activation-no-blockers')).toBeVisible({ timeout: 20_000 });
  await page.locator('#activation-tos').click();
  await page.getByTestId('activation-complete-button').click();
  await expect(page.getByTestId('activation-review-active')).toBeVisible({ timeout: 20_000 });
}
