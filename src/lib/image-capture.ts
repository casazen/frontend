/**
 * The pictures of the identity check (E03/F04/US03/T01): what is sent to the API is made no larger than it needs to be, in the browser. The pictures
 * are held in memory for the request only: nothing here writes to a storage, a cache or a log.
 */

/** The widest a selfie is sent, in pixels (ADR-013-R12). */
export const SELFIE_MAX_WIDTH = 1920;

/** The quality of the JPEG of a selfie, 0 to 1 (ADR-013-R12: 80 %). */
export const SELFIE_JPEG_QUALITY = 0.8;

/** The widest a photo of the document is sent when it has to be made smaller: wider than a selfie, the two lines of the MRZ must stay legible. */
export const DOCUMENT_MAX_WIDTH = 2560;

/** The quality of the JPEG of a photo of the document that had to be redrawn. */
export const DOCUMENT_JPEG_QUALITY = 0.85;

/** What the API accepts of one request: the WHOLE body, every picture in it (`MaxImageRequestBytes` of the public check-in controller). */
export const REQUEST_LIMIT_BYTES = 10_000_000;

/** What is sent as it is stays under this when the request carries one picture: the API refuses a request over 10 MB. */
export const IMAGE_SEND_AS_IS_BYTES = 9_000_000;

/**
 * What a selfie (at most 1920 px wide, a JPEG at 80 %, ADR-013-R12) is allowed to weigh in the sum of a request that also carries the photo of the
 * document: it is 0.3 to 0.9 MB as a rule and up to about 1.5 MB for a noisy frame taken in poor light.
 */
export const SELFIE_BUDGET_BYTES = 2_000_000;

/**
 * What goes as it is of the photo of a document that comes again with every selfie (a property that keeps no document, ADR-013-R6): the request of the
 * selfie carries both pictures and the API refuses it over {@link REQUEST_LIMIT_BYTES}, so the document leaves room for the selfie and the form.
 */
export const DOCUMENT_WITH_SELFIE_AS_IS_BYTES = 5_000_000;

/** The types of image the API accepts for the document and the selfie. */
const ACCEPTED_TYPES: ReadonlySet<string> = new Set(['image/jpeg', 'image/jpg', 'image/png']);

/** The size of a picture no wider than `maxWidth`, with the same proportions (never larger than it is). */
export function fitWidth(width: number, height: number, maxWidth: number): { width: number; height: number } {
  if (width <= maxWidth) return { width, height };
  return { width: maxWidth, height: Math.max(1, Math.round((height * maxWidth) / width)) };
}

/**
 * The picture as a JPEG no wider than `maxWidth`. The canvas it draws on is emptied before it returns, so that a phone does not keep the pixels.
 * Rejects when the browser cannot draw or encode it.
 */
export async function canvasToJpeg(
  source: HTMLCanvasElement,
  maxWidth: number = SELFIE_MAX_WIDTH,
  quality: number = SELFIE_JPEG_QUALITY,
): Promise<Blob> {
  const size = fitWidth(source.width, source.height, maxWidth);
  if (size.width < 1 || size.height < 1) throw new Error('empty picture');

  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no canvas');
    context.drawImage(source, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) throw new Error('not encoded');
    return blob;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

/** A photo of the document that can be sent, or why it cannot: a type the API does not read, or a size it refuses that this browser could not reduce. */
export type PreparedPhoto = { ok: true; blob: Blob } | { ok: false; problem: 'unsupported' | 'too_large' };

/** The file drawn again as a JPEG no wider than `maxWidth`, upright; `null` when this browser cannot decode it (an old browser, a type it does not know). */
async function redrawAsJpeg(file: File, maxWidth: number, quality: number): Promise<Blob | null> {
  if (typeof createImageBitmap !== 'function') return null;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return null;
  }

  try {
    const size = fitWidth(bitmap.width, bitmap.height, maxWidth);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    canvas.width = 0;
    canvas.height = 0;
    return blob;
  } catch {
    return null;
  } finally {
    bitmap.close();
  }
}

/**
 * The photo of the document as it is sent: a JPEG or a PNG under {@link IMAGE_SEND_AS_IS_BYTES} goes as it is (nothing is redrawn, nothing of its
 * legibility is lost); anything else is drawn again as a JPEG of {@link DOCUMENT_MAX_WIDTH} at most, when this browser can; otherwise it is said
 * why it cannot be sent and the guest takes the photo again. A photo that will come again with every selfie (`withSelfie`, a property that keeps no
 * document) is held to {@link DOCUMENT_WITH_SELFIE_AS_IS_BYTES} instead, so that the request of the selfie, which carries both, stays under the limit
 * of the API: the document is redrawn from there up, which keeps the lines of its MRZ legible at {@link DOCUMENT_MAX_WIDTH}.
 */
export async function prepareDocumentPhoto(file: File, options: { withSelfie?: boolean } = {}): Promise<PreparedPhoto> {
  const asIsBytes = options.withSelfie ? DOCUMENT_WITH_SELFIE_AS_IS_BYTES : IMAGE_SEND_AS_IS_BYTES;
  const accepted = ACCEPTED_TYPES.has(file.type.toLowerCase());
  if (accepted && file.size <= asIsBytes) return { ok: true, blob: file };

  const redrawn = await redrawAsJpeg(file, DOCUMENT_MAX_WIDTH, DOCUMENT_JPEG_QUALITY);
  if (redrawn && redrawn.size <= asIsBytes) return { ok: true, blob: redrawn };
  return { ok: false, problem: accepted ? 'too_large' : 'unsupported' };
}
