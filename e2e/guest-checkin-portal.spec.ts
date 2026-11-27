import { test, expect } from './test';
import { bookingId, mockArrivalJourney, property } from './helpers/arrival-journey';
import { demoUrl } from './helpers/demo-profile';
import { installFakeCamera } from './helpers/fake-camera';

test.describe('Guest check-in portal', () => {
  test('a link issued by the host opens the same stay in a fresh guest browser', async ({ page, browser, baseURL }) => {
    test.slow();
    await mockArrivalJourney(page);
    const publicLink = new URL('/checkin/issued-stay', baseURL).href;
    let issued = false;
    await page.route(`**/api/bookings/${bookingId}/checkin-session`, route => route.fulfill({
      json: { canIssueLink: true, status: issued ? 'Inviato' : null, emailStatus: 'NotRequested' },
    }));
    await page.route(`**/api/bookings/${bookingId}/checkin/link`, route => {
      expect(route.request().method()).toBe('POST');
      issued = true;
      return route.fulfill({ json: { checkInLink: publicLink, expiresAt: '2027-12-31T12:00:00Z', emailStatus: 'NotRequested' } });
    });

    await page.goto(demoUrl(`/app/short-rent/bookings/${bookingId}?tab=guest`, 'short-stay'), { waitUntil: 'domcontentloaded' });
    await page.getByTestId('checkin-generate-button').click();
    const handoff = page.getByTestId('checkin-link-issued').getByRole('textbox');
    await expect(handoff).toHaveValue(publicLink);
    const guest = await browser.newContext({ locale: 'it-IT' });
    try {
      await guest.route('**/api/public/checkin/issued-stay', route => {
        expect(route.request().headers()).not.toHaveProperty('authorization');
        return route.fulfill({ json: {
          completed: false, status: 'InCompilazione', language: 'it', propertyName: property.name,
          declaredGuests: 1, guests: [{ type: 'SingleGuest', firstName: 'Piet', lastName: 'Jansen' }],
        } });
      });
      const guestPage = await guest.newPage();
      await guestPage.goto(await handoff.inputValue(), { waitUntil: 'domcontentloaded' });
      await expect(guestPage.getByRole('heading', { name: 'Check-in ospite' })).toBeVisible();
      await expect(guestPage.getByText(property.name)).toBeVisible();
      await guestPage.getByTestId('checkin-enter-manually').click();
      await expect(guestPage.locator('#guest-0-firstName')).toHaveValue('Piet');
    } finally {
      await guest.close();
    }
  });

  test('keeps the check-in wizard and its resume URL inside the guest portal', async ({ page }) => {
    test.slow();
    const token = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef';
    const portal = `/s/${token}`;
    const api = `**/api/public/guest-portal/${token}`;
    let completed = false;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route(api, route => route.fulfill({ json: {
      stay: { propertyName: 'Villa Test', checkIn: '2027-12-08', checkOut: '2027-12-10',
        bookingCode: 'PORTAL-TEST', guests: 1, status: 'confirmed', isDirect: true },
      branding: { name: 'Casa Test', primaryColor: '#1F3A3D' }, language: 'it', checkInCompleted: completed,
    } }));
    await page.route(api + '/stay', route => route.fulfill({ json: { checkInAvailable: true, guide: {} } }));
    await page.route(api + '/host-extras?*', route => route.fulfill({ json: { offers: [], orders: [] } }));
    await page.route(`**/api/public/checkin/stay_${token}`, route => {
      expect(route.request().headers()).not.toHaveProperty('authorization');
      return route.fulfill({ json: {
        language: 'it', completed, status: completed ? 'Completo' : 'InCompilazione',
        propertyName: 'Villa Test', declaredGuests: 1, guests: [{ type: 'SingleGuest', firstName: 'Alba', lastName: 'Rossi' }],
      } });
    });

    await page.goto(`${portal}?lang=it`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: 'Fai il check-in' }).click();
    await expect(page).toHaveURL(new RegExp(portal + '\\?lang=it&page=checkin$'));
    await expect(page.getByTestId('checkin-page')).toBeVisible();
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.getByRole('main')).toHaveCount(1);
    await page.getByTestId('checkin-enter-manually').click();
    await expect(page.locator('#guest-0-firstName')).toHaveValue('Alba');
    await expect(page).toHaveURL(/page=checkin.*resume=guests/);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('checkin-resumed')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    completed = true;
    await page.goto(`/checkin/stay_${token}?lang=it`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(portal + '\\?lang=it&page=checkin$'));
    await expect(page.getByTestId('checkin-success')).toBeVisible();
    await expect(page.getByRole('navigation')).toBeVisible();
  });

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
    await expect(page.getByTestId('checkin-invalid-link')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /invalid|non valido/i })).toBeVisible();
    await expect(page.getByTestId('guest-data-form')).toHaveCount(0);
  });

  test('retries a temporary interruption and resumes from server data on a narrow phone', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    let available = false;
    await page.route('**/api/public/checkin/returning-stay', (route) => available
      ? route.fulfill({ json: {
        completed: false, status: 'InCompilazione', language: 'it', declaredGuests: 1,
        propertyName: 'Villa Demo', guests: [{ type: 'SingleGuest', firstName: 'Alba', lastName: 'Rossi' }],
      } })
      : route.fulfill({ status: 503, json: { status: 503 } }));
    await page.goto('/checkin/returning-stay');
    const problem = page.getByTestId('checkin-load-problem');
    await expect(problem).toBeVisible({ timeout: 20_000 });
    available = true;
    await problem.getByRole('button', { name: /Riprova|Try again/i }).click();
    await page.getByTestId('checkin-enter-manually').click();
    const name = page.locator('#guest-0-firstName');
    await expect(name).toHaveValue('Alba');
    const birthDate = page.locator('#guest-0-dateOfBirth');
    await birthDate.fill('1994-02-12');
    await expect(page).toHaveURL(/\?resume=guests$/);
    await page.reload();
    await expect(page.getByTestId('checkin-resumed')).toBeVisible();
    await expect(name).toHaveValue('Alba');
    await expect(birthDate).toHaveValue('');
    await expect(page.locator('[aria-current=step]')).toHaveAccessibleName('Ospiti');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test('reopening an already submitted link shows the receipt without another form', async ({ page }) => {
    await page.route('**/api/public/checkin/recorded', (route) => route.fulfill({ json: { completed: true, status: 'Completo' } }));
    await page.goto('/checkin/recorded?resume=guests');
    await expect(page.getByTestId('checkin-success')).toBeVisible();
    await expect(page.getByRole('heading', { name: /già completato|already completed/i })).toBeVisible();
    await expect(page.getByTestId('guest-data-form')).toHaveCount(0);
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
  await installFakeCamera(page);
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
      const bytes = request.postDataBuffer()!;
      if (bytes.includes(Buffer.from('fixture-unrelated'))) {
        steps.push('rejected');
        return reply({ read: false, reason: 'not_document' });
      }
      if (bytes.includes(Buffer.from('fixture-back'))) {
        steps.push('scan-back');
        return reply({ read: true, side: 'back', guestPosition: 0, guest: { documentNumber: 'CA12345AB', residenceInItaly: true, residenceCityName: 'Firenze', residenceProvince: 'FI' } });
      }
      steps.push('scan');
      return reply({ read: true, side: 'front', confirmGuest: true, guestPosition: 0, guest: { ...guest, firstName: 'Euca', documentKind: 'IdentityCard',
        issuePlace: 'Roma', documentIssuedOn: '2022-03-11', documentExpiresOn: '2032-03-11' } });
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
    if (end === 'selfie-challenge') return reply({ challengeToken: 'test-challenge', noseToRight: true,
      expiresAt: new Date(Date.now() + 120_000).toISOString() });
    if (end === 'selfie') {
      const data = request.postDataBuffer()!;
      expect(data.includes(Buffer.from('test-challenge'))).toBe(true);
      expect(data.includes(Buffer.from('turnedSelfie'))).toBe(true);
      for (const side of ['front', 'back']) expect(data.includes(Buffer.from('fixture-' + side))).toBe(true);
      steps.push('selfie');
      return reply({ result: 'ok', guidanceCodes: [], attemptsRemaining: 2, operatorPathOpen: true });
    }
    if (end === 'scan-flow' && request.method() === 'POST') {
      const body = request.postDataJSON();
      expect(body.guests).toHaveLength(1);
      expect(body.guests[0]).toMatchObject({ firstName: 'Luca', documentNumber: 'CA12345AB', documentIssuedOn: '2022-03-11', residenceComuneName: 'Firenze', residenceProvince: 'FI' });
      expect(body).toMatchObject({ privacyNoticeAcknowledged: true, marketingConsentEmail: false, marketingConsentWhatsApp: false });
      expect(body).not.toHaveProperty('invoice');
      steps.push('submit');
      return reply({ sessionId: 'demo', message: 'ok' });
    }
    return route.fulfill({ status: 404 });
  });
  await page.goto('/checkin/scan-flow');
  const upload = (side: string) => ({ name: side + '.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fixture-' + side) });
  await page.getByTestId('checkin-document-file').setInputFiles(upload('unrelated'));
  await expect(page.getByTestId('checkin-document-message')).toContainText('non è stata riconosciuta');
  await expect(page.getByTestId('checkin-scan-continue')).toHaveCount(0);
  await page.getByTestId('checkin-document-file').setInputFiles(upload('front'));
  await page.getByRole('button', { name: 'Confermo il nominativo della prenotazione' }).click();
  await expect(page.getByTestId('checkin-scan-continue')).toBeEnabled();
  await page.getByTestId('checkin-document-file').setInputFiles(upload('back'));
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
  await expect(page.getByText(/il naso punta verso destra/)).toBeVisible();
  await expect.poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.videoWidth)).toBeGreaterThan(0);
  await page.getByTestId('selfie-take').click();
  await page.getByTestId('selfie-send').click();
  await page.getByTestId('checkin-next').click();
  await expect(page.getByTestId('checkin-submit')).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Apri l’informativa della struttura' })).toHaveAttribute('href', '/book/demo/privacy');
  await page.locator('#privacy-read').check();
  await page.getByTestId('checkin-submit').click();
  await expect(page.getByTestId('checkin-success')).toBeVisible();
  expect(steps).toEqual(['rejected', 'scan', 'scan-back', 'consent', 'front', 'back', 'selfie', 'submit']);
});
