/**
 * The difference hash of the photo of a side of the document (E71/F02/US01/T02, NF-189): 64 bits that say, for 64 pairs of neighbouring parts of the picture, which of the two is the
 * brighter. The page uses it for one thing, before the upload: the photo of the back that looks like the photo of the front just taken is probably the same side twice, and the guest
 * is asked once whether to take it again or to send it anyway.
 *
 * It is the algorithm of the server (`PerceptualHash.DHash64`): the picture is reduced to a thumbnail of 9 by 8 cells, each the mean luminance of the pixels it covers (ITU-R BT.601,
 * in whole numbers); each of the 8 rows gives 8 bits, one for each pair of neighbouring cells, 1 when the left cell is brighter than the right one (a tie is 0), in reading order, the
 * first pair of the top row being the most significant bit. The server computes it on the whole picture, this page on a copy of 90 by 80 pixels drawn by the browser, so two hashes of the
 * same photo may differ in a bit or two: the distance below is a margin for that and for a hand that moved.
 *
 * It is a CLIENT HINT ONLY. The server decides (`document_side_duplicate`, with its own distance of the policy) on the photo that is sent, whatever this page said, and a hint that is
 * wrong costs the guest one tap. The hash is a value derived from the document: it lives in memory for the length of the step, never in a storage, an address, a log or a request.
 */

const COLUMNS = 9;

const ROWS = 8;

const SAMPLE = { width: COLUMNS * 10, height: ROWS * 10 };

export const SAME_SIDE_MAX_DISTANCE = 6;

export interface FingerprintPixels {
  readonly width: number;
  readonly height: number;
  readonly data: ArrayLike<number>;
}

export function differenceHash(pixels: FingerprintPixels): string | null {
  const { width, height, data } = pixels;
  if (width < 1 || height < 1 || data.length < width * height * 4) return null;

  const sums: number[] = [];
  const counts: number[] = [];
  for (let row = 0; row < ROWS; row += 1) {
    const top = Math.floor((row * height) / ROWS);
    const bottom = Math.max(top + 1, Math.floor(((row + 1) * height) / ROWS));
    for (let column = 0; column < COLUMNS; column += 1) {
      const left = Math.floor((column * width) / COLUMNS);
      const right = Math.max(left + 1, Math.floor(((column + 1) * width) / COLUMNS));
      let sum = 0;
      for (let y = top; y < bottom; y += 1) {
        for (let x = left; x < right; x += 1) {
          const at = (y * width + x) * 4;
          sum += Math.floor((data[at] * 299 + data[at + 1] * 587 + data[at + 2] * 114 + 500) / 1000);
        }
      }
      sums.push(sum);
      counts.push((bottom - top) * (right - left));
    }
  }

  // The left cell is the brighter one when its sum over its count is larger: compared by cross-multiplication, so that no rounding decides.
  let bits = '';
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS - 1; column += 1) {
      const left = row * COLUMNS + column;
      bits += sums[left] * counts[left + 1] > sums[left + 1] * counts[left] ? '1' : '0';
    }
  }

  let hex = '';
  for (let at = 0; at < bits.length; at += 4) hex += Number.parseInt(bits.slice(at, at + 4), 2).toString(16);
  return hex;
}

export function hashDistance(a: string, b: string): number {
  if (!/^[0-9a-f]{16}$/i.test(a) || !/^[0-9a-f]{16}$/i.test(b)) return Number.POSITIVE_INFINITY;
  let distance = 0;
  for (let at = 0; at < 16; at += 1) {
    let bits = Number.parseInt(a[at], 16) ^ Number.parseInt(b[at], 16);
    while (bits !== 0) {
      distance += bits & 1;
      bits >>= 1;
    }
  }
  return distance;
}

export function looksLikeTheSameSide(front: string, back: string): boolean {
  return hashDistance(front, back) <= SAME_SIDE_MAX_DISTANCE;
}

export function fingerprintOfCanvas(source: HTMLCanvasElement): string | null {
  if (source.width < 1 || source.height < 1) return null;

  const sample = document.createElement('canvas');
  sample.width = SAMPLE.width;
  sample.height = SAMPLE.height;
  try {
    const context = sample.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(source, 0, 0, SAMPLE.width, SAMPLE.height);
    return differenceHash(context.getImageData(0, 0, SAMPLE.width, SAMPLE.height));
  } catch {
    return null;
  } finally {
    sample.width = 0;
    sample.height = 0;
  }
}
