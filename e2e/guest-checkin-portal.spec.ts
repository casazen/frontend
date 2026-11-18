import { test, expect } from './test';

test.describe('Guest check-in portal', () => {
  test('shows invalid link for unknown token', async ({ page }) => {
    // L2 has no backend: the API answers 404 for a token it does not know, as the real one does.
    await page.route('**/api/public/checkin/**', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/problem+json',
        body: JSON.stringify({ status: 404, title: 'Not Found' }),
      });
    });
    await page.goto('/checkin/invalid-token-00000000000000000000000000000000');
    await expect(page.getByText(/invalid|non valido/i)).toBeVisible({ timeout: 15_000 });
  });

  test('renders wizard progress on mocked context', async ({ page }) => {
    await page.route('**/api/public/checkin/**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            completed: false,
            sessionId: '11111111-1111-1111-1111-111111111111',
            propertyName: 'Villa Demo',
            checkInDate: '2026-07-10T00:00:00Z',
            checkOutDate: '2026-07-12T00:00:00Z',
            status: 'Inviato',
            declaredGuests: 1,
            guests: [{
              type: 'SingleGuest',
              firstName: 'Mario',
              lastName: 'Rossi',
              gender: 'Male',
              dateOfBirth: '1990-05-15',
              bornInItaly: true,
              birthComuneName: 'Roma',
              birthProvince: 'RM',
              birthCountryName: 'Italia',
              citizenshipName: 'Italiana',
              documentIssuePlaceName: 'Roma',
            }],
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/checkin/demo-token-abcdef1234567890abcdef1234567890');
    await expect(page.getByTestId('checkin-progress')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Villa Demo')).toBeVisible();
  });
});

test('confirms a misread name, reuses the front after consent and submits the verified guest', async ({ page }) => {
  // The browser exercises camera capture with generated pixels. The API outcomes below are fixtures.
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const stream = canvas.captureStream(10);
      const ctx = canvas.getContext('2d')!;
      const timer = setInterval(() => ctx.fillRect(0, 0, 640, 480), 100);
      stream.getVideoTracks()[0].addEventListener('ended', () => clearInterval(timer));
      return stream;
    } });
  });
  const steps: string[] = [];
  const state = { step: 'consent', biometricOffered: true, consentRecorded: false, consentRefused: false,
    documentChecked: false, attemptsRemaining: 3, operatorRequested: false, operatorPathOpen: true,
    documentNotArchived: true, verifyingGuestPosition: 0 };
  const guest = { type: 'SingleGuest', firstName: 'Luca', lastName: 'Rossi', gender: 'Male',
    dateOfBirth: '1992-05-15', bornInItaly: true, birthComuneName: 'Roma', birthProvince: 'RM', citizenshipName: 'Italia' };
  await page.route('**/api/public/checkin/scan-flow**', async route => {
    const request = route.request();
    const end = new URL(request.url()).pathname.split('/').pop();
    const reply = (json: unknown) => route.fulfill({ json });
    if (end === 'scan-flow' && request.method() === 'GET') return reply({ completed: false, status: 'InCompilazione',
      sessionId: 'demo', propertyName: 'Demo', language: 'it', declaredGuests: 1, guests: [guest],
      availableCodeTables: [], identityVerification: state, privacyNoticeOrgSlug: 'demo', privacyNoticeVersion: 'v1', marketingConsentVersion: 'v1' });
    if (end === 'read-document') {
      steps.push('scan');
      return reply({ read: true, confirmGuest: true, guestPosition: 0, guest: { ...guest, firstName: 'Euca', documentKind: 'IdentityCard',
        documentNumber: 'CA12345AB', issuePlace: 'Roma', documentIssuedOn: '2022-03-11', documentExpiresOn: '2032-03-11' } });
    }
    if (end === 'legal-texts') return reply({ language: 'it', texts: [{ kind: 'biometric-consent', version: 'v1',
      language: 'it', isDraft: false, contentHtml: '<p>Confronto del documento e del selfie.</p>' }] });
    if (end === 'biometric-consent') {
      steps.push('consent');
      return reply({ consentRecorded: true, result: 'consent_recorded', biometricOffered: true,
        state: { ...state, step: 'document', consentRecorded: true } });
    }
    if (end === 'document') {
      const front = !steps.includes('front');
      const side = front ? 'front' : 'back';
      expect(request.postDataBuffer()?.includes(Buffer.from('fixture-' + side))).toBe(true);
      steps.push(side);
      return reply({ success: true, acceptable: !front, guidanceCodes: front ? ['document_back_needed'] : [],
        documentStored: false, documentNotArchived: true, side, sides: front ? ['front'] : ['front', 'back'] });
    }
    if (end === 'selfie') {
      const data = request.postDataBuffer()!;
      for (const side of ['front', 'back']) expect(data.includes(Buffer.from('fixture-' + side))).toBe(true);
      steps.push('selfie');
      return reply({ result: 'ok', guidanceCodes: [], attemptsRemaining: 2, operatorPathOpen: true });
    }
    if (end === 'scan-flow' && request.method() === 'POST') {
      const body = request.postDataJSON();
      expect(body.guests).toHaveLength(1);
      expect(body.guests[0]).toMatchObject({ firstName: 'Luca', documentNumber: 'CA12345AB', documentIssuedOn: '2022-03-11' });
      expect(body).toMatchObject({ privacyNoticeAcknowledged: true, marketingConsentEmail: false, marketingConsentWhatsApp: false });
      expect(body).not.toHaveProperty('invoice');
      steps.push('submit');
      return reply({ sessionId: 'demo', message: 'ok' });
    }
    return route.fulfill({ status: 404 });
  });
  await page.goto('/checkin/scan-flow');
  const upload = (side: string) => ({ name: side + '.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fixture-' + side) });
  await page.getByTestId('checkin-document-file').setInputFiles(upload('front'));
  await page.getByRole('button', { name: 'Confermo il nominativo della prenotazione' }).click();
  await page.getByTestId('checkin-scan-continue').click();
  await expect(page.locator('#guest-0-firstName')).toHaveValue('Luca');
  await expect(page.getByTestId('checkin-add-guest')).toHaveCount(0);
  await page.getByTestId('checkin-next').click();
  await expect(page.locator('#guest-0-documentNumber')).toHaveValue('CA12345AB');
  await page.getByTestId('checkin-next').click();
  await page.getByTestId('checkin-biometric-accept').click();
  await expect(page.getByTestId('checkin-identity-document')).toHaveAttribute('data-side', 'back');
  await page.getByTestId('checkin-identity-document-file').setInputFiles(upload('back'));
  await expect.poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth)).toBeGreaterThan(0);
  await page.getByTestId('selfie-take').click();
  await page.getByTestId('selfie-send').click();
  await page.getByTestId('checkin-next').click();
  await expect(page.getByTestId('checkin-submit')).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Apri l’informativa della struttura' })).toHaveAttribute('href', '/book/demo/privacy');
  await page.locator('#privacy-read').check();
  await page.getByTestId('checkin-submit').click();
  await expect(page.getByTestId('checkin-success')).toBeVisible();
  expect(steps).toEqual(['scan', 'consent', 'front', 'back', 'selfie', 'submit']);
});
