import type { TFunction } from 'i18next';
import { SERVICE_LIMITS, SERVICE_PHOTO_TYPES } from './service-limits';

const T = 'supplier.services.photos';
const EXTENSIONS = /\.(jpe?g|png|webp)$/i;

/**
 * What is wrong with the files a person picked, in words, before anything goes up (the API checks the content again and
 * refuses all of them if one is not good): no room left, too many for the room, not a photo, empty or too large. `null`
 * when they can go. A file whose type the browser does not know is judged by its extension.
 */
export function refuseFiles(files: readonly File[], current: number, t: TFunction): string | null {
  const room = SERVICE_LIMITS.maxPhotos - current;
  if (room <= 0) return t(`${T}.errors.full`, { max: SERVICE_LIMITS.maxPhotos });
  if (files.length > room) return t(`${T}.errors.tooMany`, { count: room, chosen: files.length });
  const notPhoto = files.find((file) => (file.type ? !(SERVICE_PHOTO_TYPES as readonly string[]).includes(file.type) : !EXTENSIONS.test(file.name)));
  if (notPhoto) return t(`${T}.errors.type`, { name: notPhoto.name });
  const badSize = files.find((file) => file.size === 0 || file.size > SERVICE_LIMITS.maxPhotoBytes);
  if (badSize) return t(`${T}.errors.size`, { name: badSize.name, max: SERVICE_LIMITS.maxPhotoBytes / (1024 * 1024) });
  return null;
}
