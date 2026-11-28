/**
 * The live guidance of the camera that photographs the identity document (E71/F02/US01/T01, NF-189): while the guest holds the card in front of the camera the page says, in one
 * line, what to change (turn the phone, more or less light, show the whole card, a reflection, a blurred picture) and lets the photo be taken once everything has held for a moment.
 *
 * It is GUIDE only. These are pure functions on the pixels of a downscaled frame (an `ImageData`: `width`, `height` and RGBA `data`), so that each check is tested with synthetic
 * pixels and none of them touches the camera, the DOM, a storage or a log. The numbers decide which hint is shown and when the button of the photo wakes up: a picture that
 * passes them is not accepted by that, and one that fails them is not refused. The server decides on the photo that is sent (its codes come back after the upload) with its own
 * rules (`CaptureQualityRules`, the geometry of the format); these are values of the same kind, provisional until they are measured on real devices (Safari on iOS, Chrome on
 * Android, a desktop browser: a manual follow-up of the qualification, D12). A change of any of them is a new `GUIDE_RULES_VERSION`.
 */

export const GUIDE_RULES_VERSION = 'document-guide-2026.11-1';

const ID1_CARD_WIDTH_MM = 85.6;

const ID1_CARD_HEIGHT_MM = 53.98;

export const ID1_CARD_RATIO = ID1_CARD_WIDTH_MM / ID1_CARD_HEIGHT_MM;

const OVERLAY_WIDTH_SHARE = 0.88;

const OVERLAY_HEIGHT_SHARE = 0.8;

export const GUIDE_WORKING_SIDE = 480;

const MIN_MEAN_LUMINANCE = 55;

const MAX_MEAN_LUMINANCE = 210;

const SATURATED_LUMINANCE = 250;

const MAX_GLARE_SHARE = 0.08;

const MIN_SHARPNESS = 40;

const EDGE_GRADIENT = 30;

const MIN_EDGE_SHARE = 0.5;

const EDGE_BAND_SHARE = 0.04;

const EDGE_CORNER_TRIM = 0.1;

export const GUIDE_STEADY_MS = 500;

const MIN_FRAME_SIDE = 16;

export interface GuideFrame {
  readonly width: number;
  readonly height: number;
  readonly data: ArrayLike<number>;
}

export interface GuideRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * What the live guidance can find wrong, in the order the hint takes them: the first that fails is the one said, because it is the one that makes the others
 * meaningless (a phone held upright, a dark room) or the one the guest can fix first.
 */
export const GUIDE_CHECKS = ['orientation', 'dark', 'bright', 'edges', 'glare', 'blur'] as const;
export type GuideCheck = (typeof GUIDE_CHECKS)[number];

export interface GuideMetrics {
  meanLuminance: number;
  glareShare: number;
  sharpness: number;
  edgeShares: { top: number; right: number; bottom: number; left: number };
}

export interface GuideReport {
  failing: readonly GuideCheck[];
  first: GuideCheck | null;
  metrics: GuideMetrics;
}

export function overlayOf(width: number, height: number): GuideRect {
  let cardWidth = width * OVERLAY_WIDTH_SHARE;
  let cardHeight = cardWidth / ID1_CARD_RATIO;
  if (cardHeight > height * OVERLAY_HEIGHT_SHARE) {
    cardHeight = height * OVERLAY_HEIGHT_SHARE;
    cardWidth = cardHeight * ID1_CARD_RATIO;
  }
  return { left: (width - cardWidth) / 2, top: (height - cardHeight) / 2, width: cardWidth, height: cardHeight };
}

export function workingSizeOf(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, GUIDE_WORKING_SIDE / Math.max(width, height, 1));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function wholePixels(rect: GuideRect, width: number, height: number): { left: number; top: number; right: number; bottom: number } {
  const left = Math.max(0, Math.round(rect.left));
  const top = Math.max(0, Math.round(rect.top));
  return { left, top, right: Math.min(width, Math.round(rect.left + rect.width)), bottom: Math.min(height, Math.round(rect.top + rect.height)) };
}

function grayOf(frame: GuideFrame): Uint8Array {
  const { width, height, data } = frame;
  const gray = new Uint8Array(width * height);
  for (let index = 0, at = 0; index < gray.length; index += 1, at += 4) {
    gray[index] = Math.floor((data[at] * 299 + data[at + 1] * 587 + data[at + 2] * 114 + 500) / 1000);
  }
  return gray;
}

function meanOf(gray: Uint8Array): number {
  if (gray.length === 0) return 0;
  let sum = 0;
  for (let index = 0; index < gray.length; index += 1) sum += gray[index];
  return sum / gray.length;
}

function saturatedShareOf(gray: Uint8Array, width: number, area: { left: number; top: number; right: number; bottom: number }): number {
  let saturated = 0;
  let count = 0;
  for (let y = area.top; y < area.bottom; y += 1) {
    for (let x = area.left; x < area.right; x += 1) {
      count += 1;
      if (gray[y * width + x] >= SATURATED_LUMINANCE) saturated += 1;
    }
  }
  return count === 0 ? 0 : saturated / count;
}

function laplacianVarianceOf(gray: Uint8Array, width: number, area: { left: number; top: number; right: number; bottom: number }): number {
  let sum = 0;
  let sumOfSquares = 0;
  let count = 0;
  for (let y = area.top + 1; y < area.bottom - 1; y += 1) {
    for (let x = area.left + 1; x < area.right - 1; x += 1) {
      const at = y * width + x;
      const laplacian = gray[at - width] + gray[at + width] + gray[at - 1] + gray[at + 1] - 4 * gray[at];
      sum += laplacian;
      sumOfSquares += laplacian * laplacian;
      count += 1;
    }
  }
  if (count === 0) return 0;
  const mean = sum / count;
  return sumOfSquares / count - mean * mean;
}

function edgeSharesOf(
  gray: Uint8Array,
  width: number,
  height: number,
  area: { left: number; top: number; right: number; bottom: number },
): GuideMetrics['edgeShares'] {
  const band = Math.max(2, Math.round(Math.min(area.right - area.left, area.bottom - area.top) * EDGE_BAND_SHARE));
  const trimX = Math.round((area.right - area.left) * EDGE_CORNER_TRIM);
  const trimY = Math.round((area.bottom - area.top) * EDGE_CORNER_TRIM);
  const verticalGradient = (x: number, y: number) => Math.abs(gray[(y + 1) * width + x] - gray[(y - 1) * width + x]);
  const horizontalGradient = (x: number, y: number) => Math.abs(gray[y * width + x + 1] - gray[y * width + x - 1]);

  const shareOf = (
    from: number,
    to: number,
    centre: number,
    limit: number,
    gradientAt: (along: number, across: number) => number,
  ): number => {
    let hits = 0;
    let positions = 0;
    for (let along = from; along < to; along += 1) {
      positions += 1;
      for (let across = Math.max(1, centre - band); across <= Math.min(limit - 2, centre + band); across += 1) {
        if (gradientAt(along, across) >= EDGE_GRADIENT) {
          hits += 1;
          break;
        }
      }
    }
    return positions === 0 ? 0 : hits / positions;
  };

  return {
    top: shareOf(area.left + trimX, area.right - trimX, area.top, height, verticalGradient),
    bottom: shareOf(area.left + trimX, area.right - trimX, area.bottom - 1, height, verticalGradient),
    left: shareOf(area.top + trimY, area.bottom - trimY, area.left, width, (along, across) => horizontalGradient(across, along)),
    right: shareOf(area.top + trimY, area.bottom - trimY, area.right - 1, width, (along, across) => horizontalGradient(across, along)),
  };
}

const NOTHING_TO_SEE: GuideReport = {
  failing: ['edges'],
  first: 'edges',
  metrics: { meanLuminance: 0, glareShare: 0, sharpness: 0, edgeShares: { top: 0, right: 0, bottom: 0, left: 0 } },
};

export function assessFrame(frame: GuideFrame): GuideReport {
  const { width, height } = frame;
  if (width < MIN_FRAME_SIDE || height < MIN_FRAME_SIDE || frame.data.length < width * height * 4) return NOTHING_TO_SEE;

  const gray = grayOf(frame);
  const area = wholePixels(overlayOf(width, height), width, height);
  const meanLuminance = meanOf(gray);
  const glareShare = saturatedShareOf(gray, width, area);
  const sharpness = laplacianVarianceOf(gray, width, area);
  const edgeShares = edgeSharesOf(gray, width, height, area);

  const failing: GuideCheck[] = [];
  if (height > width) failing.push('orientation');
  if (meanLuminance < MIN_MEAN_LUMINANCE) failing.push('dark');
  else if (meanLuminance > MAX_MEAN_LUMINANCE) failing.push('bright');
  if (Object.values(edgeShares).some((share) => share < MIN_EDGE_SHARE)) failing.push('edges');
  if (glareShare > MAX_GLARE_SHARE) failing.push('glare');
  if (sharpness < MIN_SHARPNESS) failing.push('blur');

  return { failing, first: failing[0] ?? null, metrics: { meanLuminance, glareShare, sharpness, edgeShares } };
}

/**
 * Since when the checks have all passed without a break: `previous` is that moment (`null` when they did not pass at the last frame), `passing` whether they pass now. A frame that
 * fails starts the wait again, so a hand that moves never takes the photo.
 */
export function steadySince(previous: number | null, passing: boolean, nowMs: number): number | null {
  if (!passing) return null;
  return previous ?? nowMs;
}

export function isSteady(since: number | null, nowMs: number): boolean {
  return since !== null && nowMs - since >= GUIDE_STEADY_MS;
}

export type GuideHint = GuideCheck | 'waiting' | 'settling' | 'ready';

export interface HintState {
  shown: GuideHint;
  candidate: GuideHint | null;
  seen: number;
}

export const FIRST_HINT: HintState = { shown: 'waiting', candidate: null, seen: 0 };

const FRAMES_TO_CHANGE_HINT = 2;

export function nextHint(previous: HintState, wanted: GuideHint): HintState {
  if (wanted === previous.shown) return previous.candidate === null ? previous : { shown: previous.shown, candidate: null, seen: 0 };
  const seen = previous.candidate === wanted ? previous.seen + 1 : 1;
  if (seen >= FRAMES_TO_CHANGE_HINT) return { shown: wanted, candidate: null, seen: 0 };
  return { shown: previous.shown, candidate: wanted, seen };
}
