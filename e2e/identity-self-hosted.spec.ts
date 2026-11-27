import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { devices, type Page } from '@playwright/test';
import { test, expect } from './test';
import { installFakeCamera, liveCameraTracks, showCardSide } from './helpers/fake-camera';
import { LOCK_CODE, PRESENCE_PLAN, mockIdentityApi, type IdentityApiMock, type IdentityCall } from './helpers/identity-api-mock';

let italian: unknown;

function words(key: string): string {
  italian ??= JSON.parse(readFileSync(resolve(process.cwd(), 'src/i18n/locales/it.json'), 'utf8'));
  let node: unknown = italian;
  for (const part of key.split('.')) node = typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined;
  if (typeof node !== 'string') throw new Error(`The Italian text ${key} does not exist`);
  return node;
}

function expectedPrompts(): string[] {
  // The guest looks at a mirror, so turn_left is asked as «turn to the right».
  const asked: Record<(typeof PRESENCE_PLAN.steps)[number], string> = {
    turn_left: words('checkin.identity.presence.move.turnToTheRight'),
    look_up: words('checkin.identity.presence.move.lookUp'),
  };
  return [words('checkin.identity.presence.leadIn'), ...PRESENCE_PLAN.steps.map((move) => asked[move])];
}

// The dev server compiles the page the first time it is opened.
const FIRST = { timeout: 20_000 };

const AFTER_RECORDING = { timeout: 40_000 };

const stepOf = (page: Page) => page.getByTestId('checkin-identity-step');
const presenceOf = (page: Page) => page.getByTestId('checkin-presence');
const documentOf = (page: Page) => page.getByTestId('checkin-identity-document');

async function expectStage(page: Page, stage: string): Promise<void> {
  await expect(stepOf(page)).toHaveAttribute('data-stage', stage, FIRST);
}

// The challenges the mock issued are counted from here, never as an absolute number: the dev server runs React StrictMode,
// so the screen of the presence asks for its first challenge twice and drops the first answer.
async function expectReadyToRecord(page: Page): Promise<void> {
  await expect(presenceOf(page)).toHaveAttribute('data-phase', 'ready', FIRST);
}

async function startRecording(page: Page): Promise<void> {
  await expectReadyToRecord(page);
  await page.getByTestId('checkin-presence-start').click();
  await expect(presenceOf(page)).toHaveAttribute('data-phase', 'recording', FIRST);
}

async function chooseFile(page: Page, side: 'front' | 'back'): Promise<void> {
  await page.getByTestId('checkin-identity-document-file').setInputFiles({ name: `${side}.jpg`, mimeType: 'image/jpeg', buffer: Buffer.from(`fixture-${side}`) });
}

// A prompt lasts a fraction of a second: a wait that looks for it comes too late.
async function watchPrompts(page: Page): Promise<() => Promise<string[]>> {
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { __czPrompts: string[] }).__czPrompts = seen;
    const read = () => {
      const text = document.querySelector('[data-testid="checkin-presence-prompt"]')?.textContent?.trim() ?? '';
      if (text !== '' && seen[seen.length - 1] !== text) seen.push(text);
    };
    new MutationObserver(read).observe(document.body, { subtree: true, childList: true, characterData: true });
    read();
  });
  return () => page.evaluate(() => (window as unknown as { __czPrompts?: string[] }).__czPrompts ?? []);
}

function expectARecording(upload: IdentityCall): void {
  expect(upload.method).toBe('POST');
  const frames = upload.parts.frames ?? 0;
  expect(frames).toBeGreaterThanOrEqual(3);
  expect(upload.picturesAreJpeg).toBe(true);
  expect(upload.parts.timestamps).toBe(1);
  expect(upload.parts.challengeToken).toBe(1);
  // The property keeps its documents, so the pictures of the document do not come again with the recording.
  expect(upload.parts.documentPhoto).toBeUndefined();
  expect(upload.parts.documentPhotoBack).toBeUndefined();

  const stamps = JSON.parse(upload.fields.timestamps) as number[];
  expect(stamps).toHaveLength(frames);
  expect(stamps[0]).toBe(0);
  stamps.forEach((stamp, index) => {
    expect(Number.isInteger(stamp)).toBe(true);
    if (index > 0) expect(stamp).toBeGreaterThan(stamps[index - 1]);
  });
  expect(upload.headers['idempotency-key']).toMatch(/^[A-Za-z0-9-]{8,64}$/);
}

function expectAnonymousCallsAndCleanAddresses(identity: IdentityApiMock): void {
  for (const call of identity.calls()) {
    expect(call.headers).not.toHaveProperty('authorization');
    if (['document', 'presence', 'request-operator'].includes(call.endpoint)) expect(call.search).toBe('');
  }
}

async function expectTheCameraReleased(page: Page): Promise<void> {
  await expect.poll(() => liveCameraTracks(page), { timeout: 10_000 }).toBe(0);
}

async function expectNoPassShown(page: Page): Promise<void> {
  await expect(page.getByTestId('identity-result-ok')).toHaveCount(0);
  await expect(page.getByTestId('identity-lock-code')).toHaveCount(0);
}

function listenToTheConsole(page: Page): string[] {
  const said: string[] = [];
  page.on('console', (message) => said.push(message.text()));
  return said;
}

async function expectNothingKept(page: Page, said: string[], secrets: string[]): Promise<void> {
  const stored = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
  const everything = [stored, said.join('\n'), page.url()].join('\n');
  // «/9j/» is how a JPEG starts in base64.
  for (const marker of ['data:image', 'blob:', '/9j/']) expect(everything).not.toContain(marker);
  for (const secret of secrets) expect(everything).not.toContain(secret);
}

async function connectionBreaksDuringTheUpload(page: Page): Promise<void> {
  const identity = await mockIdentityApi(page, { startAt: 'presence', presence: ['abort', 'ok'] });
  await installFakeCamera(page);
  await page.goto(identity.entry);

  await expectReadyToRecord(page);
  const challengesBefore = identity.challenges().length;
  await startRecording(page);
  await expect(page.getByTestId('identity-result-ok')).toBeVisible(AFTER_RECORDING);

  const uploads = identity.calls('presence');
  expect(uploads.map((upload) => upload.outcome)).toEqual(['aborted', 'answered']);
  const [lost, resent] = uploads;
  expectARecording(lost);
  expectARecording(resent);
  expect(resent.headers['idempotency-key']).toBe(lost.headers['idempotency-key']);
  expect(resent.fields.challengeToken).toBe(lost.fields.challengeToken);
  expect(lost.framesDigest).not.toBeNull();
  expect(resent.framesDigest).toBe(lost.framesDigest);
  expect(identity.challenges()).toHaveLength(challengesBefore);
  await expect(page.getByTestId('identity-lock-code')).toHaveText(LOCK_CODE);
  await expect(page.getByTestId('checkin-identity-problem')).toHaveCount(0);
  await expectTheCameraReleased(page);
  expectAnonymousCallsAndCleanAddresses(identity);
}

async function screenTurnsDuringTheRecording(page: Page): Promise<void> {
  const identity = await mockIdentityApi(page, { startAt: 'presence' });
  await installFakeCamera(page);
  await page.goto(identity.entry);

  await expectReadyToRecord(page);
  const challengesBefore = identity.challenges().length;
  await startRecording(page);

  const size = page.viewportSize();
  if (!size) throw new Error('The page has no viewport to turn');
  await page.setViewportSize({ width: size.height, height: size.width });

  const notice = page.getByTestId('checkin-presence-notice');
  await expect(notice).toHaveAttribute('data-notice', 'rotated', FIRST);
  await expect(notice).toContainText(words('checkin.identity.presence.notice.rotated'));
  await expectReadyToRecord(page);
  expect(identity.challenges()).toHaveLength(challengesBefore + 1);
  expect(identity.calls('presence')).toHaveLength(0);

  await startRecording(page);
  await expect(page.getByTestId('identity-result-ok')).toBeVisible(AFTER_RECORDING);
  const uploads = identity.calls('presence');
  expect(uploads).toHaveLength(1);
  expectARecording(uploads[0]);
  expect(uploads[0].fields.challengeToken).toBe(identity.challenges().at(-1));
  await expectTheCameraReleased(page);
}

// Chromium emulation of the phones (size, touch, user agent), not their engines.
const PHONES = ['iPhone 13', 'Pixel 7'] as const;

test.describe('Guest identity, self-hosted: a fake camera and a mocked API', () => {
  test('(a) a guest reads the notice, chooses the automatic check, photographs both sides of the card, follows the prompts and is verified', async ({ page }) => {
    test.slow();
    const said = listenToTheConsole(page);
    const identity = await mockIdentityApi(page, { documentDelayMs: 400 });
    await installFakeCamera(page);
    await page.goto(identity.entry);

    await expectStage(page, 'consent');
    const notice = page.getByTestId('checkin-consent-text');
    await expect(notice).toBeVisible(FIRST);
    const version = await notice.getAttribute('data-version');
    expect(version).toBeTruthy();
    await expect(page.getByTestId('checkin-biometric-decline')).toBeEnabled(FIRST);
    const accept = page.getByTestId('checkin-biometric-accept');
    await expect(accept).toBeEnabled(FIRST);
    await expect.poll(() => identity.calls('identity/open').length, FIRST).toBe(1);
    expect(identity.calls('identity/open')[0].json).toEqual({ noticeVersion: version });

    await accept.click();
    await expectStage(page, 'document');
    expect(identity.calls('biometric-consent')).toHaveLength(1);
    expect(identity.calls('biometric-consent')[0].json).toEqual({ consentGiven: true, consentVersion: version });

    await expect(documentOf(page)).toHaveAttribute('data-side', 'front', FIRST);
    const shutter = page.getByTestId('checkin-identity-camera-capture');
    await expect(shutter).toBeEnabled(FIRST);
    await shutter.click();
    // The camera for the back opens when the answer arrives: the card is turned before that.
    await showCardSide(page, 'back');

    await expect(documentOf(page)).toHaveAttribute('data-side', 'back', FIRST);
    expect(identity.calls('document')).toHaveLength(1);
    expect(identity.calls('document')[0].fields.side).toBe('front');
    expect(identity.calls('document')[0].parts.document).toBe(1);
    expect(identity.calls('document')[0].picturesAreJpeg).toBe(true);
    await expect(shutter).toBeEnabled(FIRST);
    await shutter.click();

    await expectStage(page, 'presence');
    expect(identity.calls('document')).toHaveLength(2);
    expect(identity.calls('document')[1].fields.side).toBe('back');
    await expectReadyToRecord(page);
    const prompts = await watchPrompts(page);
    await startRecording(page);

    await expect(page.getByTestId('identity-result-ok')).toBeVisible(AFTER_RECORDING);
    await expect(page.getByTestId('identity-lock-code')).toHaveText(LOCK_CODE);

    const expected = expectedPrompts();
    expect((await prompts()).filter((text) => expected.includes(text))).toEqual(expected);
    const uploads = identity.calls('presence');
    expect(uploads).toHaveLength(1);
    expectARecording(uploads[0]);
    expect(identity.challenges()).toContain(uploads[0].fields.challengeToken);

    expect(identity.calls('identity/open')).toHaveLength(1);
    expect(identity.calls('biometric-consent')).toHaveLength(1);
    expect(identity.calls('selfie-challenge')).toHaveLength(0);
    expect(identity.calls('selfie')).toHaveLength(0);
    await expectTheCameraReleased(page);
    expectAnonymousCallsAndCleanAddresses(identity);
    await expectNothingKept(page, said, [LOCK_CODE, uploads[0].headers['idempotency-key'], uploads[0].fields.challengeToken]);
    await expect(page.getByTestId('checkin-identity-problem')).toHaveCount(0);
    await expect(page.getByTestId('checkin-next')).toBeEnabled();
  });

  test('(b) one guided retry: the guidance is shown, the second recording has a new key and a new challenge, and ends with a person', async ({ page }) => {
    test.slow();
    const identity = await mockIdentityApi(page, { startAt: 'presence', presence: ['retry', 'operator'] });
    await installFakeCamera(page);
    await page.goto(identity.entry);

    await startRecording(page);
    await expect(page.getByTestId('identity-result-retry')).toBeVisible(AFTER_RECORDING);
    await expect(page.getByTestId('identity-retry-reasons')).toContainText(words('checkin.identity.guidance.presence_challenge_not_followed'));
    await expect(page.getByTestId('identity-ask-operator')).toBeEnabled();
    await expectNoPassShown(page);
    await expectTheCameraReleased(page);

    await page.getByTestId('identity-retake').click();
    await startRecording(page);

    await expect(page.getByTestId('identity-result-operator')).toBeVisible(AFTER_RECORDING);
    await expect(page.getByTestId('identity-operator-text')).toHaveText(words('checkin.identity.result.operator.text'));
    await expect(page.getByTestId('identity-operator-requested')).toBeVisible();
    await expectNoPassShown(page);

    const uploads = identity.calls('presence');
    expect(uploads).toHaveLength(2);
    const [first, second] = uploads;
    expectARecording(first);
    expectARecording(second);
    expect(second.headers['idempotency-key']).not.toBe(first.headers['idempotency-key']);
    expect(second.fields.challengeToken).not.toBe(first.fields.challengeToken);
    const issued = identity.challenges();
    expect(issued.indexOf(second.fields.challengeToken)).toBeGreaterThan(issued.indexOf(first.fields.challengeToken));
    expect(identity.calls('request-operator')).toHaveLength(0);
    await expectTheCameraReleased(page);
  });

  test('(c) a camera the guest refuses: the step says why, offers the person and asks for one', async ({ page }) => {
    test.slow();
    const identity = await mockIdentityApi(page, { startAt: 'presence' });
    await installFakeCamera(page, { denied: true });
    await page.goto(identity.entry);

    const problem = page.getByTestId('checkin-presence-camera-problem');
    await expect(problem).toHaveAttribute('data-problem', 'denied', FIRST);
    await expect(problem).toContainText(words('checkin.biometric.capture.cameraDenied'));
    await expect(page.getByTestId('checkin-presence-start')).toHaveCount(0);

    const assisted = page.getByTestId('checkin-identity-assisted-path');
    await expect(assisted).toBeEnabled(FIRST);
    await assisted.click();
    await expectStage(page, 'operator');
    await expect(page.getByTestId('identity-result-operator')).toBeVisible();
    await expect(page.getByTestId('identity-operator-requested')).toBeVisible();
    await expect(page.getByTestId('checkin-next')).toBeEnabled();
    await expectNoPassShown(page);

    expect(identity.calls('request-operator')).toHaveLength(1);
    expect(identity.calls('request-operator')[0].method).toBe('POST');
    expect(identity.calls('presence')).toHaveLength(0);
    expect(await liveCameraTracks(page)).toBe(0);
    expectAnonymousCallsAndCleanAddresses(identity);
  });

  test('(d) the connection breaks during the upload: the same recording is sent again with the same key and the guest is verified', async ({ page }) => {
    test.slow();
    await connectionBreaksDuringTheUpload(page);
  });

  // The start button is not double-tapped on purpose: when it goes away the way to a person moves up under the pointer.
  test('(e) a double tap on the shutter sends one photo', async ({ page }) => {
    test.slow();
    const identity = await mockIdentityApi(page, { startAt: 'document', documentDelayMs: 600 });
    await installFakeCamera(page);
    await page.goto(identity.entry);

    const shutter = page.getByTestId('checkin-identity-camera-capture');
    await expect(documentOf(page)).toHaveAttribute('data-side', 'front', FIRST);
    await expect(shutter).toBeEnabled(FIRST);
    await shutter.dblclick();
    await showCardSide(page, 'back');
    await expect(documentOf(page)).toHaveAttribute('data-side', 'back', FIRST);
    // The answer was held back, so the second tap came while the first photo was on its way.
    expect(identity.calls('document')).toHaveLength(1);

    await expect(shutter).toBeEnabled(FIRST);
    await shutter.click();
    await expectStage(page, 'presence');
    expect(identity.calls('document').map((call) => call.fields.side)).toEqual(['front', 'back']);
    await expect(page.getByTestId('checkin-identity-problem')).toHaveCount(0);
    await expectTheCameraReleased(page);
  });

  test('(e) a double tap on «Invia di nuovo» sends the recording that was kept once, with the same key', async ({ page }) => {
    test.slow();
    // Four failed tries (at once, then after 1, 2 and 4 seconds), then the one the guest asks for.
    const identity = await mockIdentityApi(page, { startAt: 'presence', presence: ['abort', 'abort', 'abort', 'abort', 'ok'] });
    await installFakeCamera(page);
    await page.goto(identity.entry);

    await expectReadyToRecord(page);
    const challengesBefore = identity.challenges().length;
    await startRecording(page);

    const kept = page.getByTestId('checkin-presence-kept');
    await expect(kept).toBeVisible(AFTER_RECORDING);
    await expect(kept).toHaveAttribute('data-problem', 'network');
    await expect(kept).toContainText(words('checkin.identity.presence.kept.offline'));
    expect(identity.calls('presence')).toHaveLength(4);

    await page.getByTestId('checkin-presence-send-again').dblclick();
    await expect(page.getByTestId('identity-result-ok')).toBeVisible(AFTER_RECORDING);

    const uploads = identity.calls('presence');
    expect(uploads.map((upload) => upload.outcome)).toEqual(['aborted', 'aborted', 'aborted', 'aborted', 'answered']);
    uploads.forEach(expectARecording);
    expect(new Set(uploads.map((upload) => upload.headers['idempotency-key'])).size).toBe(1);
    expect(new Set(uploads.map((upload) => upload.fields.challengeToken)).size).toBe(1);
    expect(new Set(uploads.map((upload) => upload.framesDigest)).size).toBe(1);
    expect(identity.challenges()).toHaveLength(challengesBefore);
    await expect(page.getByTestId('checkin-identity-problem')).toHaveCount(0);
    await expectTheCameraReleased(page);
  });

  test('(f) the viewport turns during the recording: it is thrown away, the guest is told, and a new challenge is asked for', async ({ page }) => {
    test.slow();
    await screenTurnsDuringTheRecording(page);
  });

  test('(g) the way to a person is there at every sub-step of the identity step, and it releases the camera', async ({ page }) => {
    test.slow();
    const identity = await mockIdentityApi(page, { refuseFirstDocument: ['document_glare'] });
    await installFakeCamera(page);
    await page.goto(identity.entry);
    const assisted = page.getByTestId('checkin-identity-assisted-path');

    await expectStage(page, 'consent');
    await expect(page.getByTestId('checkin-biometric-decline')).toBeEnabled(FIRST);
    await expect(page.getByTestId('checkin-biometric-accept')).toBeEnabled(FIRST);
    await page.getByTestId('checkin-biometric-accept').click();

    await expect(documentOf(page)).toHaveAttribute('data-side', 'front', FIRST);
    await expect(assisted).toBeEnabled(FIRST);

    await chooseFile(page, 'front');
    await expect(page.getByTestId('checkin-identity-document-guidance-document_glare')).toBeVisible(FIRST);
    await expect(page.getByTestId('checkin-identity-document-operator')).toBeEnabled(FIRST);

    await chooseFile(page, 'front');
    await expect(documentOf(page)).toHaveAttribute('data-side', 'back', FIRST);
    await expect(assisted).toBeEnabled(FIRST);

    await chooseFile(page, 'back');
    await expectStage(page, 'presence');
    await expectReadyToRecord(page);
    await expect(assisted).toBeEnabled(FIRST);
    await page.getByTestId('checkin-presence-start').click();
    await expect(presenceOf(page)).toHaveAttribute('data-phase', 'recording', FIRST);
    await expect(assisted).toBeEnabled(FIRST);

    await assisted.click();
    await expectStage(page, 'operator');
    await expect(page.getByTestId('identity-operator-requested')).toBeVisible();
    await expectNoPassShown(page);
    expect(identity.calls('request-operator')).toHaveLength(1);
    expect(identity.calls('presence')).toHaveLength(0);
    expect(identity.calls('document')).toHaveLength(3);
    await expectTheCameraReleased(page);
    expectAnonymousCallsAndCleanAddresses(identity);
  });

  test('(g) at the notice the person is a choice of the same weight: choosing it records no consent, opens no camera and hands the case to a person', async ({ page }) => {
    test.slow();
    const identity = await mockIdentityApi(page);
    await installFakeCamera(page);
    await page.goto(identity.entry);

    await expectStage(page, 'consent');
    const decline = page.getByTestId('checkin-biometric-decline');
    await expect(decline).toBeEnabled(FIRST);
    await decline.click();
    await expectStage(page, 'operator');
    await expect(page.getByTestId('identity-operator-requested')).toBeVisible();
    await expectNoPassShown(page);

    expect(identity.calls('biometric-consent')).toHaveLength(1);
    expect(identity.calls('biometric-consent')[0].json).toEqual({ consentGiven: false });
    expect(identity.calls('document')).toHaveLength(0);
    expect(identity.calls('presence-challenge')).toHaveLength(0);
    expect(identity.calls('request-operator')).toHaveLength(0);
    await expectTheCameraReleased(page);
    expectAnonymousCallsAndCleanAddresses(identity);
  });

  test('(h) the first step reads the front locally and offers the values to check, and leaves the identity routes alone', async ({ page }) => {
    test.slow();
    const identity = await mockIdentityApi(page);
    await page.goto(identity.link);

    await page.getByTestId('checkin-document-file').setInputFiles({ name: 'front.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fixture-front') });
    await expect(page.getByTestId('checkin-prefill')).toBeVisible(FIRST);
    await expect(page.getByTestId('checkin-prefill-missing-item')).toHaveCount(2);
    await expect(page.getByTestId('checkin-prefill-value-documentNumber')).toBeVisible();

    const readings = identity.calls('read-document');
    expect(readings).toHaveLength(1);
    expect(readings[0].parts.file).toBe(1);
    expect(identity.calls('document')).toHaveLength(0);
    expect(identity.calls('presence-challenge')).toHaveLength(0);
  });

  for (const name of PHONES) {
    const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices[name];

    test.describe(`on a phone: ${name} (emulation)`, () => {
      test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

      test('the connection breaks during the upload: the same recording is sent again with the same key', async ({ page }) => {
        test.slow();
        await connectionBreaksDuringTheUpload(page);
      });

      test('the phone is turned during the recording: it is thrown away and a new challenge is asked for', async ({ page }) => {
        test.slow();
        await screenTurnsDuringTheRecording(page);
      });
    });
  }
});
