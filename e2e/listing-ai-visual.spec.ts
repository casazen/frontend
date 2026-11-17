import { test, expect } from '@playwright/test';

const fields = { title: 'Un soggiorno luminoso a Como', description: 'Un appartamento pensato per condividere il soggiorno in città.\n\nDue camere e una zona giorno accolgono fino a quattro ospiti. La cucina e gli spazi comuni permettono di organizzare le giornate con autonomia.\n\nComo è il contesto del soggiorno: scegliete le vostre attività senza presumere distanze o collegamenti non verificati.', spaces: 'Due camere e una zona giorno', access: '', neighborhood: 'Como', transport: '', rules: 'Non è consentito fumare' };
const englishFields = { ...fields, title: 'A bright stay in Como', description: 'Two bedrooms and a living area welcome up to four guests in Como.', spaces: 'Two bedrooms and a living area', rules: 'Smoking is not permitted' };

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`listing AI chooser, partial failure, retry and review at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    let englishAttempts = 0;
    const requestedLanguages: string[] = [];
    await page.route('**/api/properties/fixture/listing-text/fields-suggestion', async (route) => {
      const { language } = route.request().postDataJSON() as { language: string };
      requestedLanguages.push(language);
      if (language === 'en' && englishAttempts++ === 0) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
        return;
      }
      const generated = language === 'en' ? englishFields : fields;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ aiUsed: true, reason: null, title: generated.title, description: generated.description, fields: generated, basedOn: { photos: 0, comune: 'Como', province: 'CO', region: 'Lombardia', amenities: 0, similarListings: 0 } }) });
    });
    await page.goto('/e2e/fixtures/listing-ai-review.html');
    await page.getByTestId('property-wizard-suggest').click();
    await expect(page.getByRole('checkbox')).toHaveCount(14);
    await expect(page.getByRole('checkbox', { name: 'Italiano', exact: true })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Inglese', exact: true })).toBeChecked();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeInViewport();
    await testInfo.attach(`listing-ai-language-choice-${viewport.width}`, { body: await page.screenshot({ fullPage: true, animations: 'disabled', path: testInfo.outputPath(`listing-ai-language-choice-${viewport.width}.png`) }), contentType: 'image/png' });
    await page.getByTestId('listing-ai-generate').click();
    const retry = page.getByRole('button', { name: 'Riprova le lingue mancanti' });
    await expect(retry).toBeEnabled();
    await expect(page.getByText('Non siamo riusciti a preparare Inglese. I tuoi testi sono invariati.')).toBeVisible();
    await retry.click();
    await expect(retry).toHaveCount(0);
    await expect(page.getByTestId('listing-ai-apply')).toBeEnabled();
    expect(requestedLanguages).toEqual(['it', 'en', 'en']);
    const italian = dialog.locator('details').filter({ has: page.locator('summary').filter({ hasText: /^Italiano$/ }) });
    await italian.locator('summary').click();
    await expect(italian.getByText('Due camere e una zona giorno', { exact: true })).toBeVisible();
    await testInfo.attach(`listing-ai-reviewed-texts-${viewport.width}`, { body: await page.screenshot({ fullPage: true, animations: 'disabled', path: testInfo.outputPath(`listing-ai-reviewed-texts-${viewport.width}.png`) }), contentType: 'image/png' });
    await page.getByTestId('listing-ai-apply').click();
    await expect(page.getByRole('textbox', { name: 'Titolo', exact: true })).toHaveValue(fields.title);
    await expect(page.getByRole('textbox', { name: 'Descrizione', exact: true })).toHaveValue(fields.description);
    await expect(page.getByTestId('fixture-en-title')).toHaveText(englishFields.title);
    await expect(page.getByTestId('fixture-en-description')).toHaveText(englishFields.description);
    await expect(page.getByTestId('fixture-rules')).toHaveText(fields.rules);
    await page.getByTestId('property-wizard-suggest-undo').click();
    await expect(page.getByRole('textbox', { name: 'Titolo', exact: true })).toHaveValue('La mia casa');
    await expect(page.getByRole('textbox', { name: 'Descrizione', exact: true })).toHaveValue('La descrizione che voglio conservare.');
    await expect(page.getByTestId('fixture-en-title')).toHaveText('My previous title');
    await expect(page.getByTestId('fixture-en-description')).toHaveText('My previous description.');
    await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width);
  });
}
