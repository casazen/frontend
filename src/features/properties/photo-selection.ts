/** Rules of the photo upload, as `GET /properties/{id}/images` answers them (PC-04). */
export interface PhotoUploadRules {
  maxPhotos: number;
  maxFilesPerRequest: number;
  maxFileSizeBytes: number;
  allowedContentTypes: string[];
}

export type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/** Same rules as the API when the gallery has not answered yet (they come from `GET /properties/{id}/images`). */
export const FALLBACK_PHOTO_RULES: PhotoUploadRules = {
  maxPhotos: 20,
  maxFilesPerRequest: 10,
  maxFileSizeBytes: 10 * 1024 * 1024,
  allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
};

const EXTENSION_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const toMegabytes = (bytes: number) => Math.floor(bytes / (1024 * 1024));

/**
 * First problem of a selection of files, in the user's language, or null when it can be uploaded. The API checks the
 * same rules (and the content of each file); checking here too only spares a round trip and names the file. A
 * selection is uploaded whole or not at all, like the API does.
 */
export function validatePhotoSelection(
  files: File[],
  current: number,
  rules: PhotoUploadRules,
  t: TranslateFn,
): string | null {
  if (files.length > rules.maxFilesPerRequest) {
    return t('property.photos.selectionTooMany', { max: rules.maxFilesPerRequest });
  }
  const remaining = rules.maxPhotos - current;
  if (files.length > remaining) {
    return t('property.photos.selectionOverLimit', { remaining: Math.max(remaining, 0), max: rules.maxPhotos });
  }
  for (const file of files) {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const type = file.type.toLowerCase();
    const knownType = rules.allowedContentTypes.includes(type) && EXTENSION_TYPES[extension] === type;
    if (!knownType) return t('property.photos.selectionInvalidType', { name: file.name });
    if (file.size === 0 || file.size > rules.maxFileSizeBytes) {
      return t('property.photos.selectionTooLarge', { name: file.name, size: toMegabytes(rules.maxFileSizeBytes) });
    }
  }
  return null;
}
