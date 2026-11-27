export const AI_PHOTO_MAX_SIDE = 1024;

export const AI_PHOTOS_MAX = 6;

const JPEG_QUALITY = 0.8;

const LOAD_TIMEOUT_MS = 15_000;

/**
 * The photo as an image the page may draw and read back. The gallery is a public bucket that answers any origin; the address gets a
 * parameter of its own so that the copy the gallery already shows (loaded without CORS) is not the one reused here.
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = window.setTimeout(() => reject(new Error('timeout')), LOAD_TIMEOUT_MS);
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => {
      window.clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error('not loaded'));
    };
    const address = new URL(url, window.location.href);
    address.searchParams.set('for', 'ai');
    image.src = address.toString();
  });
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

export async function reducePhotoForAi(url: string): Promise<string | null> {
  try {
    const image = await loadImage(url);
    const scale = Math.min(1, AI_PHOTO_MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    canvas.width = 0;
    canvas.height = 0;
    return jpeg ? await readAsDataUrl(jpeg) : null;
  } catch {
    return null;
  }
}

export async function reducePhotosForAi(urls: readonly string[]): Promise<string[]> {
  const reduced = await Promise.all(urls.slice(0, AI_PHOTOS_MAX).map((url) => reducePhotoForAi(url)));
  return reduced.filter((photo): photo is string => photo !== null);
}
