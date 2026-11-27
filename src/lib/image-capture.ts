export const SELFIE_MAX_WIDTH = 1920;

export const SELFIE_JPEG_QUALITY = 0.8;

export const DOCUMENT_MAX_WIDTH = 2560;

export const DOCUMENT_JPEG_QUALITY = 0.85;

export const REQUEST_LIMIT_BYTES = 10_000_000;

export const IMAGE_SEND_AS_IS_BYTES = 9_000_000;

export const SELFIE_BUDGET_BYTES = 2_000_000;

export const DOCUMENT_WITH_SELFIE_AS_IS_BYTES = 5_000_000;

const ACCEPTED_TYPES: ReadonlySet<string> = new Set(['image/jpeg', 'image/jpg', 'image/png']);

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

/**
 * The frame the guest took with the camera that guides the photo of the document (E71/F02/US01/T01) as the file the step sends: a JPEG of {@link DOCUMENT_MAX_WIDTH} at most at
 * {@link DOCUMENT_JPEG_QUALITY}, the limits of a photo of the document that had to be redrawn. `postDocument` takes it as it is when it is under the request limits, and the step makes it
 * smaller when it must (`prepareDocumentPhoto`). Rejects when the browser cannot draw or encode it. Like {@link canvasToJpeg} it empties the canvas it draws on; the canvas it is given is the caller's.
 */
export async function frameToDocumentPhoto(frame: HTMLCanvasElement): Promise<File> {
  const jpeg = await canvasToJpeg(frame, DOCUMENT_MAX_WIDTH, DOCUMENT_JPEG_QUALITY);
  return new File([jpeg], 'document.jpg', { type: 'image/jpeg' });
}

export type PreparedPhoto = { ok: true; blob: Blob } | { ok: false; problem: 'unsupported' | 'too_large' };

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
