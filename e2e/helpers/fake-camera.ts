import type { Page } from '@playwright/test';
import { overlayOf } from '../../src/features/checkin/lib/document-guidance';

/**
 * The fake camera of the guest identity proofs (E74/F04/US01/T01, NF-198): `navigator.mediaDevices.getUserMedia` of the page is replaced by a stream made from a `<canvas>` (`captureStream`), so that a real
 * browser opens a "camera", plays it in a real `<video>` and takes real frames from it, with no device, no flag of the browser and no picture of a person or of a document anywhere: every pixel is generated
 * here, when the page asks for the camera. Only the API is faked next to it (`identity-api-mock.ts`).
 *
 * What the camera shows depends on which one the page asks for. The front camera (`facingMode: 'user'`, the recording of the presence) shows a plain, slowly moving shape: the server is the one that looks at it,
 * and here there is no server. The rear camera (`facingMode: 'environment'`, the guided photo of the document) shows a generated card, laid exactly on the outline the guidance draws, with the face side or the
 * back side of it (`showCardSide`: the guest turns the card over): a plain picture would never pass the live checks of the guidance (the four edges of the card on the outline, enough light and sharpness) and the
 * button of the photo would stay asleep. The pixels are rectangles of a flat grey, so that what the guidance measures is known: the scenes were run through `assessFrame` and the difference hash of the page at
 * three ways of scaling the picture (nearest, bilinear, box), and pass the live checks with a wide margin and differ by more than twice the distance that makes a back look like a front (see the pull request).
 *
 * Next to the camera the fake gives the page a `requestVideoFrameCallback` that fires at the pace of a camera: a headless browser does not always call the real one for a video that is not wholly on the screen,
 * and the frames of a recording must not depend on that.
 */

/** What the camera sends: width and height of a picture, as the front and the rear camera of a phone send them in landscape. */
const FRAME = { width: 640, height: 480 } as const;

/** Frames a second: the stream and the drawing of it. */
const FRAMES_PER_SECOND = 10;

/** One filled rectangle of a generated picture: left, top, width and height in pixels, and the grey (0 to 255) it is filled with. */
type Rect = readonly [number, number, number, number, number];

/** The greys of the card scene: the table the card lies on, the card, and the ink of what is printed on it. None is near the saturation the glare check looks for. */
const TABLE = 70;
const CARD = 190;
const INK = 50;
const PHOTO_FACE = 120;

/**
 * The card as the rear camera sees it: laid on the outline the guidance asks for (`overlayOf`, the same function), with a dark photo and lines of text on its face side, and with the three lines of letters
 * and a chip on its back side. The two sides differ in where the dark parts are, so that the back does not look like the front to the check that warns before the same side is sent twice.
 */
function cardScene(side: 'front' | 'back'): Rect[] {
  const outline = overlayOf(FRAME.width, FRAME.height);
  const left = Math.round(outline.left);
  const top = Math.round(outline.top);
  const width = Math.round(outline.width);
  const height = Math.round(outline.height);
  const rects: Rect[] = [
    [0, 0, FRAME.width, FRAME.height, TABLE],
    [left, top, width, height, CARD],
  ];
  /** A part of the card, placed by shares of its width and height. */
  const part = (x: number, y: number, w: number, h: number, grey = INK) => {
    rects.push([left + Math.round(x * width), top + Math.round(y * height), Math.max(1, Math.round(w * width)), Math.max(1, Math.round(h * height)), grey]);
  };

  if (side === 'front') {
    part(0.06, 0.2, 0.26, 0.62);
    part(0.1, 0.3, 0.18, 0.4, PHOTO_FACE);
    for (let line = 0; line < 7; line += 1) part(0.38, 0.14 + line * 0.1, 0.5 - (line % 3) * 0.06, 0.035);
  } else {
    for (let line = 0; line < 3; line += 1) {
      for (let letter = 0; letter < 28; letter += 1) part(0.05 + letter * 0.0325, 0.62 + line * 0.1, 0.018, 0.06);
    }
    part(0.72, 0.1, 0.2, 0.3);
    for (let line = 0; line < 4; line += 1) part(0.06, 0.12 + line * 0.1, 0.5 - (line % 2) * 0.1, 0.03);
  }
  return rects;
}

/** What the page-side half of the camera keeps, for the proofs to read back: the permission, the side of the card, and every track the page was given. */
interface CameraState {
  denied: boolean;
  cardSide: 'front' | 'back';
  tracks: MediaStreamTrack[];
}

/** What the page-side half needs of this module: plain data, because the function that runs in the page cannot reach anything outside itself. */
interface CameraConfig {
  denied: boolean;
  width: number;
  height: number;
  framesPerSecond: number;
  scenes: { front: Rect[]; back: Rect[] };
}

export interface FakeCameraOptions {
  /** The browser says no to the camera, as it does when the guest refuses its question: every request is answered with `NotAllowedError`. */
  denied?: boolean;
}

/** The page-side half. It runs in the page before any script of it does, and again for every new document. */
function installInPage(config: CameraConfig): void {
  const state: CameraState = { denied: config.denied, cardSide: 'front', tracks: [] };
  (window as unknown as { __czFakeCamera: CameraState }).__czFakeCamera = state;

  // A page that is not on a secure address has no `mediaDevices` at all: the proof is about the flow, not about the address, so the fake brings its own.
  if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {} });

  // A browser calls a `requestVideoFrameCallback` when its compositor shows a new frame of the video, and a headless one does not always do it for a video that is not fully on the screen (the start button of
  // the recording is lower than the picture, so the page is scrolled to it). The recorder takes its frames from that call: the fake calls it at the rate of a camera, so that how many frames a recording has does
  // not depend on what the compositor happens to draw. The frames it then reads are still the real ones of the video.
  HTMLVideoElement.prototype.requestVideoFrameCallback = function (callback: VideoFrameRequestCallback): number {
    return window.setTimeout(() => callback(performance.now(), {} as VideoFrameCallbackMetadata), 1000 / 30);
  };
  HTMLVideoElement.prototype.cancelVideoFrameCallback = function (handle: number): void {
    window.clearTimeout(handle);
  };

  const wantsTheRearCamera = (constraints?: MediaStreamConstraints): boolean => {
    const video = constraints?.video;
    if (typeof video !== 'object' || video === null) return false;
    const facing = video.facingMode;
    if (typeof facing === 'string') return facing === 'environment';
    if (Array.isArray(facing)) return facing.includes('environment');
    return facing?.exact === 'environment' || facing?.ideal === 'environment';
  };

  const open = async (constraints?: MediaStreamConstraints): Promise<MediaStream> => {
    if (state.denied) throw new DOMException('Permission denied', 'NotAllowedError');

    const rear = wantsTheRearCamera(constraints);
    const canvas = document.createElement('canvas');
    canvas.width = config.width;
    canvas.height = config.height;
    const context = canvas.getContext('2d');
    if (!context) throw new DOMException('No canvas to draw the camera on', 'NotReadableError');

    let tick = 0;
    const paint = () => {
      tick += 1;
      if (rear) {
        for (const [x, y, w, h, grey] of config.scenes[state.cardSide]) {
          context.fillStyle = `rgb(${grey},${grey},${grey})`;
          context.fillRect(x, y, w, h);
        }
        return;
      }
      // The front camera: a plain wall and a shape that moves a little, so that no two frames are the same picture.
      const wall = 105 + (tick % 24);
      context.fillStyle = `rgb(${wall},${wall},${wall + 12})`;
      context.fillRect(0, 0, config.width, config.height);
      context.fillStyle = 'rgb(196,168,150)';
      context.beginPath();
      context.ellipse(config.width / 2 + Math.sin(tick / 4) * 36, config.height / 2, config.width * 0.17, config.height * 0.3, 0, 0, Math.PI * 2);
      context.fill();
    };
    paint();

    const stream = canvas.captureStream(config.framesPerSecond);
    const timer = setInterval(paint, 1000 / config.framesPerSecond);
    for (const track of stream.getTracks()) {
      state.tracks.push(track);
      const stop = track.stop.bind(track);
      // The page stops a track when it is done with the camera: the drawing stops with it, as a real camera's light goes off.
      track.stop = () => {
        stop();
        clearInterval(timer);
      };
    }
    return stream;
  };

  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, writable: true, value: open });
}

/**
 * Puts the fake camera in the page. Call it before the first `goto`: the replacement runs before the scripts of the page. The legacy selfie of the older check-in and the guided capture of the self-hosted
 * identity step both take their pictures from it.
 */
export async function installFakeCamera(page: Page, options: FakeCameraOptions = {}): Promise<void> {
  const config: CameraConfig = {
    denied: options.denied === true,
    width: FRAME.width,
    height: FRAME.height,
    framesPerSecond: FRAMES_PER_SECOND,
    scenes: { front: cardScene('front'), back: cardScene('back') },
  };
  await page.addInitScript(installInPage, config);
}

/** The guest turns the card over: the rear camera shows `side` from the next frame on. Streams that are already open follow, as a real camera follows the card. */
export async function showCardSide(page: Page, side: 'front' | 'back'): Promise<void> {
  await page.evaluate((wanted) => {
    const state = (window as unknown as { __czFakeCamera?: CameraState }).__czFakeCamera;
    if (state) state.cardSide = wanted;
  }, side);
}

/** How many of the tracks the camera gave the page are still live: a camera whose light is on. The page is to stop every one of them when it is done. */
export async function liveCameraTracks(page: Page): Promise<number> {
  return page.evaluate(() => {
    const state = (window as unknown as { __czFakeCamera?: CameraState }).__czFakeCamera;
    return state?.tracks.filter((track) => track.readyState === 'live').length ?? 0;
  });
}
