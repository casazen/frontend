import { isCancel } from 'axios';
import { getHttpStatus, getProblemCode, getProblemMessage } from '@/lib/api-errors';
import type { ShowcaseMediaKind } from '@/types/supplier-showcase';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * What the server accepts for the images of the showcase (`ShowcaseMediaLimits`, backend SP-13b), and how the editor prepares them: one
 * place, so the upload zone, the texts and the server cannot drift apart.
 */
export const SHOWCASE_MEDIA = {
  /** A logo, as it arrives: it is a mark, not a photograph. */
  logoMaxBytes: 200 * 1024,
  /** A photo, as it arrives. */
  photoMaxBytes: 10 * 1024 * 1024,
  /** The types the server accepts, read from the content of the file (never an SVG). */
  types: ['image/jpeg', 'image/png', 'image/webp'],
  /** The jobs of the gallery, and the photos they can hold (each job has its photo and, if the supplier wants, its "before"). */
  galleryWorks: 12,
  galleryPhotos: 24,
  /** The server keeps what it receives (minus the metadata): the editor makes a photo smaller first, to this side at most. */
  photoMaxSide: 2400,
  /** A photo lighter than this and not wider than the side above is sent as it is. */
  photoSendAsIsBytes: 1.5 * 1024 * 1024,
  /** A logo heavier than its limit is redrawn to this side at most, before the server is bothered. */
  logoMaxSide: 640,
} as const;

/** The limit of a kind as the person reads it ("200 KB", "10 MB"). */
export const limitLabelOf = (kind: ShowcaseMediaKind) => (kind === 'logo' ? '200 KB' : '10 MB');

export const maxBytesOf = (kind: ShowcaseMediaKind) => (kind === 'logo' ? SHOWCASE_MEDIA.logoMaxBytes : SHOWCASE_MEDIA.photoMaxBytes);

/** What is wrong with a file before anything is sent. */
export type ShowcaseFileProblem = 'empty' | 'type' | 'tooLarge';

const EXTENSION = /\.(jpe?g|png|webp)$/i;

/**
 * True for a file the browser calls a PNG, a JPEG or a WebP or, when it names no type at all (dragged from another app), whose name ends
 * like one. The server decides again on the content: this only spares a round trip.
 */
export function isShowcaseImageType(file: Pick<File, 'name' | 'type'>): boolean {
  const type = file.type.trim().toLowerCase();
  return type === '' ? EXTENSION.test(file.name) : (SHOWCASE_MEDIA.types as readonly string[]).includes(type);
}

/** An empty file, or one that is not an image of an accepted type: the part of the check that does not depend on the size. */
export function checkShowcaseFileKind(file: Pick<File, 'name' | 'type' | 'size'>): Exclude<ShowcaseFileProblem, 'tooLarge'> | null {
  if (file.size === 0) return 'empty';
  return isShowcaseImageType(file) ? null : 'type';
}

/**
 * What is wrong with a file about to be sent, or null: empty, not a PNG, JPEG or WebP, or heavier than its kind allows (a logo 200 KB, a
 * photo 10 MB). It is asked of the file **after** the editor made it smaller, since that is the one that goes.
 */
export function validateShowcaseFile(file: Pick<File, 'name' | 'type' | 'size'>, kind: ShowcaseMediaKind): ShowcaseFileProblem | null {
  const problem = checkShowcaseFileKind(file);
  if (problem) return problem;
  return file.size > maxBytesOf(kind) ? 'tooLarge' : null;
}

/** The text of a problem found before sending, in the person's words. */
export function fileProblemMessage(problem: ShowcaseFileProblem, kind: ShowcaseMediaKind, t: Translate): string {
  if (problem === 'tooLarge') return t('supplier.showcase.media.errors.tooLarge', { limit: limitLabelOf(kind) });
  return t(problem === 'empty' ? 'supplier.showcase.media.errors.empty' : 'supplier.showcase.media.errors.unsupportedType');
}

/**
 * The text for a failed upload, never a generic one when the server said what is wrong: 413 (too heavy: the limit of the kind), 415 (not an
 * accepted image), 422 (damaged or animated, too many pixels, too many files), 429 (too many in a short time), no answer (the network).
 */
export function uploadErrorMessage(error: unknown, kind: ShowcaseMediaKind, t: Translate): string {
  const status = getHttpStatus(error);
  const code = isCancel(error) ? undefined : errorCodeOf(error);

  if (status === 413) return t('supplier.showcase.media.errors.tooLarge', { limit: limitLabelOf(kind) });
  if (status === 415) return t('supplier.showcase.media.errors.unsupportedType');
  if (code === 'showcase_media_invalid_image') return t('supplier.showcase.media.errors.invalidImage');
  if (code === 'showcase_media_dimensions') return t('supplier.showcase.media.errors.dimensions');
  if (code === 'showcase_media_limit_reached') return t('supplier.showcase.media.errors.limitReached');

  return getProblemMessage(error, t) ?? t('supplier.showcase.media.errors.failed');
}

function errorCodeOf(error: unknown): string | undefined {
  const data = (error as { response?: { data?: unknown } } | null)?.response?.data;
  return getProblemCode(data);
}

// ─── Making a photo smaller, in the browser ──────────────────────────────────────────────────────

type RedrawType = 'image/jpeg' | 'image/webp' | 'image/png';

const EXTENSION_OF: Record<RedrawType, string> = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' };

/** The file name with the extension of the type it is redrawn as. */
function renamed(name: string, type: RedrawType): string {
  const base = name.replace(/\.[^./\\]+$/, '') || 'immagine';
  return `${base}.${EXTENSION_OF[type]}`;
}

/**
 * The picture drawn again, no wider or higher than `maxSide`, with the orientation of the camera applied (the pixels are turned, so the
 * file needs no EXIF to be upright) and written as `type`. A JPEG has no transparency: it is drawn on white. `null` when this browser
 * cannot decode the file or cannot write that type (a browser that cannot write a WebP answers a PNG: it is not taken for one).
 */
async function redraw(file: File, maxSide: number, type: RedrawType, quality?: number): Promise<File | null> {
  if (typeof createImageBitmap !== 'function') return null;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return null;
  }

  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return null;

    if (type === 'image/jpeg') {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    canvas.width = 0;
    canvas.height = 0;
    return blob && blob.type === type ? new File([blob], renamed(file.name, type), { type }) : null;
  } catch {
    return null;
  } finally {
    bitmap.close();
  }
}

/**
 * The file that is sent. The server stores what it receives (minus the metadata) and never makes a picture smaller, so the editor does:
 * a **photo** heavier than 1.5 MB is drawn again as a JPEG of 2,400 pixels at most, upright, and sent in its place when that is lighter
 * (or when the original is over the limit); a **logo** over its 200 KB is drawn again small, as a WebP or a PNG, which keep the transparency.
 * Anything this browser cannot do leaves the file as it was: the server has the last word and says what is wrong.
 */
export async function prepareShowcaseImage(file: File, kind: ShowcaseMediaKind): Promise<File> {
  if (kind === 'logo') {
    if (file.size <= SHOWCASE_MEDIA.logoMaxBytes) return file;

    for (const type of ['image/webp', 'image/png'] as const) {
      const smaller = await redraw(file, SHOWCASE_MEDIA.logoMaxSide, type, type === 'image/webp' ? 0.9 : undefined);
      if (smaller && smaller.size <= SHOWCASE_MEDIA.logoMaxBytes) return smaller;
    }
    return file;
  }

  if (file.size <= SHOWCASE_MEDIA.photoSendAsIsBytes) return file;

  const smaller = await redraw(file, SHOWCASE_MEDIA.photoMaxSide, 'image/jpeg', 0.85);
  if (!smaller) return file;
  return smaller.size < file.size || file.size > SHOWCASE_MEDIA.photoMaxBytes ? smaller : file;
}
