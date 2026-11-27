import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { devices, type Page } from '@playwright/test';
import { test, expect } from './test';
import { installFakeCamera, liveCameraTracks, showCardSide } from './helpers/fake-camera';
import { LOCK_CODE, PRESENCE_PLAN, mockIdentityApi, type IdentityApiMock, type IdentityCall } from './helpers/identity-api-mock';

/**
 * The identity step of the guest check-in, self-hosted (E74/F04/US01/T01, NF-198, D6, D8, D13): the page of a real browser, a camera that is a canvas (`helpers/fake-camera.ts`) and an API that is the page's own
 * answer (`helpers/identity-api-mock.ts`): no backend, no model, no picture of a person or of a document. What is proven is what the PAGE does: what it asks of the guest, what it sends (the frames of the
 * recording, with their times and one `Idempotency-Key`), what it does when the camera is refused, the connection breaks, a finger taps twice or the phone turns, and that the way to a person is there at every step.
 * Where the server DECIDES (a pass, a retry, a person) the mock follows a script; the decision itself is the business of the backend suites.
 *
 * The page is opened in Italian, as its link says, and the words it shows are read from the same file the page reads them from, so that a change of wording is not a change of the proof. Emulating a phone here is
 * the size, the touch and the pixel ratio of the device in the engine of the suite (Chromium): it is not a substitute for the device, which is a row of the manual QA matrix (D12).
 */

/** The Italian texts of the page, read when a test first needs a word (a text that is not there fails the test that asks for it, not the loading of the file). */
let italian: unknown;

/** What the guest page says for `key` in Italian. */
function words(key: string): string {
  italian ??= JSON.parse(readFileSync(resolve(process.cwd(), 'src/i18n/locales/it.json'), 'utf8'));
  let node: unknown = italian;
  for (const part of key.split('.')) node = typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined;
  if (typeof node !== 'string') throw new Error(`The Italian text ${key} does not exist`);
  return node;
}

/** The prompts a recording shows, in order: the lead-in and then each move. The guest looks at a mirror (`PresenceSequenceCapture`), so `turn_left` is asked as «turn to the right». */
function expectedPrompts(): string[] {
  const asked: Record<(typeof PRESENCE_PLAN.steps)[number], string> = {
    turn_left: words('checkin.identity.presence.move.turnToTheRight'),
    look_up: words('checkin.identity.presence.move.lookUp'),
  };
  return [words('checkin.identity.presence.leadIn'), ...PRESENCE_PLAN.steps.map((move) => asked[move])];
}

/** The first time the page is opened the dev server has to compile what it shows: every wait for a step of the page is generous. */
const FIRST = { timeout: 20_000 };

/** The recording lasts a couple of seconds, and the answer, a retry or a connection that is waited for come after it. */
const AFTER_RECORDING = { timeout: 40_000 };

const stepOf = (page: Page) => page.getByTestId('checkin-identity-step');
const presenceOf = (page: Page) => page.getByTestId('checkin-presence');
const documentOf = (page: Page) => page.getByTestId('checkin-identity-document');

/** The identity step is at `stage` (`consent`, `document`, `presence`, `retry`, `operator` or `done`). */
async function expectStage(page: Page, stage: string): Promise<void> {
  await expect(stepOf(page)).toHaveAttribute('data-stage', stage, FIRST);
}

/**
 * The camera of the presence is open and the challenge is there: the guest may start. The challenges the mock has issued are counted from here and never as an absolute number: the dev server runs React
 * StrictMode, which opens a screen twice, so the screen of the presence asks for its first challenge twice (and drops the first answer).
 */
async function expectReadyToRecord(page: Page): Promise<void> {
  await expect(presenceOf(page)).toHaveAttribute('data-phase', 'ready', FIRST);
}

/** The guest presses «Inizia» and the prompts begin. */
async function startRecording(page: Page): Promise<void> {
  await expectReadyToRecord(page);
  await page.getByTestId('checkin-presence-start').click();
  await expect(presenceOf(page)).toHaveAttribute('data-phase', 'recording', FIRST);
}

/** The photo of a side of the document, chosen from the files of the phone (the second way next to the guided camera): text that stands for a picture, never a picture. */
async function chooseFile(page: Page, side: 'front' | 'back'): Promise<void> {
  await page.getByTestId('checkin-identity-document-file').setInputFiles({ name: `${side}.jpg`, mimeType: 'image/jpeg', buffer: Buffer.from(`fixture-${side}`) });
}

/**
 * Writes down every prompt the screen of the recording shows, in the order it shows them, from now on: a prompt lasts a fraction of a second, and a wait that looks for it can come too late. Resolves with a
 * function that gives what was seen.
 */
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

/** The recording that was sent is a sequence: frames that are JPEGs, each with the time it was taken at, in whole milliseconds from the first, and one key for the whole recording. */
function expectARecording(upload: IdentityCall): void {
  expect(upload.method).toBe('POST');
  const frames = upload.parts.frames ?? 0;
  expect(frames).toBeGreaterThanOrEqual(3);
  expect(upload.picturesAreJpeg).toBe(true);
  expect(upload.parts.timestamps).toBe(1);
  expect(upload.parts.challengeToken).toBe(1);
  // The property keeps its documents: the pictures of the document do not come again with the recording.
  expect(upload.parts.documentPhoto).toBeUndefined();
  expect(upload.parts.documentPhotoBack).toBeUndefined();

  const stamps = JSON.parse(upload.fields.timestamps) as number[];
  expect(stamps).toHaveLength(frames);
  expect(stamps[0]).toBe(0);
  stamps.forEach((stamp, index) => {
    expect(Number.isInteger(stamp)).toBe(true);
    if (index > 0) expect(stamp).toBeGreaterThan(stamps[index - 1]);
  });
  // Made once for this recording: letters, digits and hyphens, 8 to 64 of them.
  expect(upload.headers['idempotency-key']).toMatch(/^[A-Za-z0-9-]{8,64}$/);
}

/** The link is anonymous and nothing of a person goes by the address: no credential on any call, and no query string on the calls that carry a picture or ask for a person. */
function expectAnonymousCallsAndCleanAddresses(identity: IdentityApiMock): void {
  for (const call of identity.calls()) {
    expect(call.headers).not.toHaveProperty('authorization');
    if (['document', 'presence', 'request-operator'].includes(call.endpoint)) expect(call.search).toBe('');
  }
}

/** Every track the camera gave the page is stopped: the light of the camera is off. */
async function expectTheCameraReleased(page: Page): Promise<void> {
  await expect.poll(() => liveCameraTracks(page), { timeout: 10_000 }).toBe(0);
}

/** A verification that did not end with a pass says no «verified» and shows no code: the lock code is for the guest the server approved, and for nobody else. */
async function expectNoPassShown(page: Page): Promise<void> {
  await expect(page.getByTestId('identity-result-ok')).toHaveCount(0);
  await expect(page.getByTestId('identity-lock-code')).toHaveCount(0);
}

/** Writes down what the page says in its console, from now on. */
function listenToTheConsole(page: Page): string[] {
  const said: string[] = [];
  page.on('console', (message) => said.push(message.text()));
  return said;
}

/** What the page remembers or says out loud: no picture and none of the `secrets` (a key, a code) in a storage, in the console or in the address. */
async function expectNothingKept(page: Page, said: string[], secrets: string[]): Promise<void> {
  const stored = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
  const everything = [stored, said.join('\n'), page.url()].join('\n');
  expect(everything).not.toContain('data:image');
  for (const secret of secrets) expect(everything).not.toContain(secret);
}

/** The first recording is sent over a connection that breaks: the same frames go again, with the same key, and nothing is recorded twice. */
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
  // The same recording, resumed: the same key, the same challenge and the very same frames. The guest was not asked to record again.
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

/** The screen turns from landscape to portrait, or the other way, while the guest is recorded: frames of two shapes are not one sequence. */
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

  // The recording is thrown away, the guest is told why, and the screen is ready again with a challenge of its own.
  const notice = page.getByTestId('checkin-presence-notice');
  await expect(notice).toHaveAttribute('data-notice', 'rotated', FIRST);
  await expect(notice).toContainText(words('checkin.identity.presence.notice.rotated'));
  await expectReadyToRecord(page);
  expect(identity.challenges()).toHaveLength(challengesBefore + 1);
  expect(identity.calls('presence')).toHaveLength(0);

  // The guest records again, and what is sent answers the new challenge.
  await startRecording(page);
  await expect(page.getByTestId('identity-result-ok')).toBeVisible(AFTER_RECORDING);
  const uploads = identity.calls('presence');
  expect(uploads).toHaveLength(1);
  expectARecording(uploads[0]);
  expect(uploads[0].fields.challengeToken).toBe(identity.challenges().at(-1));
  await expectTheCameraReleased(page);
}

/** The phones the proof is repeated on: the size, the pixel ratio, the touch and the user agent of the device, in the engine of the suite (the engine of the device itself is a row of the QA matrix). */
const PHONES = ['iPhone 13', 'Pixel 7'] as const;

test.describe('Guest identity, self-hosted: a fake camera and a mocked API', () => {
  test('(a) a guest reads the notice, chooses the automatic check, photographs both sides of the card, follows the prompts and is verified', async ({ page }) => {
    test.slow();
    const said = listenToTheConsole(page);
    const identity = await mockIdentityApi(page, { documentDelayMs: 400 });
    await installFakeCamera(page);
    await page.goto(identity.entry);

    // The notice and the choice: the text the registry serves, the two ways of the same weight, and the step opened with the version of the text on the screen.
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

    // The guided camera: the front. The shutter wakes up when the card lies on the outline, and the card is turned over as soon as it is taken.
    await expect(documentOf(page)).toHaveAttribute('data-side', 'front', FIRST);
    const shutter = page.getByTestId('checkin-identity-camera-capture');
    await expect(shutter).toBeEnabled(FIRST);
    await shutter.click();
    await showCardSide(page, 'back');

    // The answer asks for the back; the same camera is open again for it.
    await expect(documentOf(page)).toHaveAttribute('data-side', 'back', FIRST);
    expect(identity.calls('document')).toHaveLength(1);
    expect(identity.calls('document')[0].fields.side).toBe('front');
    expect(identity.calls('document')[0].parts.document).toBe(1);
    expect(identity.calls('document')[0].picturesAreJpeg).toBe(true);
    await expect(shutter).toBeEnabled(FIRST);
    await shutter.click();

    // The document is complete: the recording of the presence takes the place of the selfies.
    await expectStage(page, 'presence');
    expect(identity.calls('document')).toHaveLength(2);
    expect(identity.calls('document')[1].fields.side).toBe('back');
    await expectReadyToRecord(page);
    const prompts = await watchPrompts(page);
    await startRecording(page);

    await expect(page.getByTestId('identity-result-ok')).toBeVisible(AFTER_RECORDING);
    await expect(page.getByTestId('identity-lock-code')).toHaveText(LOCK_CODE);

    // The prompts came in order, and what was sent is one recording with its times and its key.
    const expected = expectedPrompts();
    expect((await prompts()).filter((text) => expected.includes(text))).toEqual(expected);
    const uploads = identity.calls('presence');
    expect(uploads).toHaveLength(1);
    expectARecording(uploads[0]);
    expect(identity.challenges()).toContain(uploads[0].fields.challengeToken);

    // The step was opened once, and nothing of the legacy path is called; the camera is let go, nothing is kept or said, and the guest may go on.
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
    // The way to a person is on the screen of a retry as well, and the camera is not kept open for the next try. A retry is not a pass.
    await expect(page.getByTestId('identity-ask-operator')).toBeEnabled();
    await expectNoPassShown(page);
    await expectTheCameraReleased(page);

    await page.getByTestId('identity-retake').click();
    await startRecording(page);

    // The server has no further retry to give: the guest is told that a person verifies, and nobody is asked for twice.
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

    // No camera is no dead end: the way to a person is there, and it is a request the operators are told of at once.
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
    // The camera was refused, so none was ever given.
    expect(await liveCameraTracks(page)).toBe(0);
    expectAnonymousCallsAndCleanAddresses(identity);
  });

  test('(d) the connection breaks during the upload: the same recording is sent again with the same key and the guest is verified', async ({ page }) => {
    test.slow();
    await connectionBreaksDuringTheUpload(page);
  });

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
    // The server took its time to answer: the second tap came while the first photo was on its way, and it sent nothing.
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
    // The upload is tried four times (at once, then after 1, 2 and 4 seconds) and fails each time; the fifth request, the one the guest asks for, is answered.
    const identity = await mockIdentityApi(page, { startAt: 'presence', presence: ['abort', 'abort', 'abort', 'abort', 'ok'] });
    await installFakeCamera(page);
    await page.goto(identity.entry);

    await expectReadyToRecord(page);
    const challengesBefore = identity.challenges().length;
    await startRecording(page);

    // The recording is kept in memory, the guest is told why, and nothing is asked of them again but the one tap.
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
    // The same recording every time: one key, one challenge, the very same frames. The second tap of the double tap sent nothing.
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

    // The notice and the choice: the person is the second of two answers of the same weight.
    await expectStage(page, 'consent');
    await expect(page.getByTestId('checkin-biometric-decline')).toBeEnabled(FIRST);
    await expect(page.getByTestId('checkin-biometric-accept')).toBeEnabled(FIRST);
    await page.getByTestId('checkin-biometric-accept').click();

    // The front of the document.
    await expect(documentOf(page)).toHaveAttribute('data-side', 'front', FIRST);
    await expect(assisted).toBeEnabled(FIRST);

    // A photo that cannot be compared: what to change is said, and the person is one tap away on that screen too.
    await chooseFile(page, 'front');
    await expect(page.getByTestId('checkin-identity-document-guidance-document_glare')).toBeVisible(FIRST);
    await expect(page.getByTestId('checkin-identity-document-operator')).toBeEnabled(FIRST);

    // The front taken again is good and the card has a back.
    await chooseFile(page, 'front');
    await expect(documentOf(page)).toHaveAttribute('data-side', 'back', FIRST);
    await expect(assisted).toBeEnabled(FIRST);

    // The recording: before it starts and while it runs.
    await chooseFile(page, 'back');
    await expectStage(page, 'presence');
    await expectReadyToRecord(page);
    await expect(assisted).toBeEnabled(FIRST);
    await page.getByTestId('checkin-presence-start').click();
    await expect(presenceOf(page)).toHaveAttribute('data-phase', 'recording', FIRST);
    await expect(assisted).toBeEnabled(FIRST);

    // Choosing the person in the middle of the recording ends it: nothing is sent, the person is asked for once, and the camera is let go.
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

    // The answer is a refusal: no version of a text is claimed to have been agreed to, and nothing that needs a camera was asked.
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
    // What the reading did not give is asked, one line each; the values it gave are there to be checked.
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
