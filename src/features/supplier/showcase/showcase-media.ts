import { isCancel } from 'axios';
import { getHttpStatus, getProblemCode, getProblemMessage } from '@/lib/api-errors';
import type { ShowcaseMediaKind } from '@/types/supplier-showcase';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export const SHOWCASE_MEDIA = {
  logoMaxBytes: 200 * 1024,
  photoMaxBytes: 10 * 1024 * 1024,
  types: ['image/jpeg', 'image/png', 'image/webp'],
  galleryWorks: 12,
  galleryPhotos: 24,
  photoMaxSide: 2400,
  photoSendAsIsBytes: 1.5 * 1024 * 1024,
  logoMaxSide: 640,
} as const;

export const limitLabelOf = (kind: ShowcaseMediaKind) => (kind === 'logo' ? '200 KB' : '10 MB');

export const maxBytesOf = (kind: ShowcaseMediaKind) => (kind === 'logo' ? SHOWCASE_MEDIA.logoMaxBytes : SHOWCASE_MEDIA.photoMaxBytes);

export type ShowcaseFileProblem = 'empty' | 'type' | 'tooLarge';

const EXTENSION = /\.(jpe?g|png|webp)$/i;

export function isShowcaseImageType(file: Pick<File, 'name' | 'type'>): boolean {
  const type = file.type.trim().toLowerCase();
  return type === '' ? EXTENSION.test(file.name) : (SHOWCASE_MEDIA.types as readonly string[]).includes(type);
}

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

export function fileProblemMessage(problem: ShowcaseFileProblem, kind: ShowcaseMediaKind, t: Translate): string {
  if (problem === 'tooLarge') return t('supplier.showcase.media.errors.tooLarge', { limit: limitLabelOf(kind) });
  return t(problem === 'empty' ? 'supplier.showcase.media.errors.empty' : 'supplier.showcase.media.errors.unsupportedType');
}

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

type RedrawType = 'image/jpeg' | 'image/webp' | 'image/png';

const EXTENSION_OF: Record<RedrawType, string> = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' };

function renamed(name: string, type: RedrawType): string {
  const base = name.replace(/\.[^./\\]+$/, '') || 'immagine';
  return `${base}.${EXTENSION_OF[type]}`;
}

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
