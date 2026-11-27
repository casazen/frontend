import type { Page } from '@playwright/test';
import { overlayOf } from '../../src/features/checkin/lib/document-guidance';

const FRAME = { width: 640, height: 480 } as const;

const FRAMES_PER_SECOND = 10;

type Rect = readonly [number, number, number, number, number];

const TABLE = 70;
const CARD = 190;
const INK = 50;
const PHOTO_FACE = 120;

// The rear camera shows a card laid on the outline of the live guidance: a plain picture never passes its checks (edges on the outline, light, sharpness), so the shutter of the guided capture would stay asleep.
// The two sides differ enough for the back not to look like the front to the duplicate-side hint.
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

interface CameraState {
  denied: boolean;
  cardSide: 'front' | 'back';
  tracks: MediaStreamTrack[];
}

interface CameraConfig {
  denied: boolean;
  width: number;
  height: number;
  framesPerSecond: number;
  scenes: { front: Rect[]; back: Rect[] };
}

export interface FakeCameraOptions {
  denied?: boolean;
}

// Runs in the page: it is serialized, so nothing outside this function is reachable from it.
function installInPage(config: CameraConfig): void {
  const state: CameraState = { denied: config.denied, cardSide: 'front', tracks: [] };
  (window as unknown as { __czFakeCamera: CameraState }).__czFakeCamera = state;

  if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {} });

  // A headless browser does not always call the real requestVideoFrameCallback for a video that is not wholly on the screen, and the recorder takes its frames from it.
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
      track.stop = () => {
        stop();
        clearInterval(timer);
      };
    }
    return stream;
  };

  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, writable: true, value: open });
}

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

export async function showCardSide(page: Page, side: 'front' | 'back'): Promise<void> {
  await page.evaluate((wanted) => {
    const state = (window as unknown as { __czFakeCamera?: CameraState }).__czFakeCamera;
    if (state) state.cardSide = wanted;
  }, side);
}

export async function liveCameraTracks(page: Page): Promise<number> {
  return page.evaluate(() => {
    const state = (window as unknown as { __czFakeCamera?: CameraState }).__czFakeCamera;
    return state?.tracks.filter((track) => track.readyState === 'live').length ?? 0;
  });
}
