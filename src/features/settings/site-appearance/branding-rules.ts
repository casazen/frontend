import { isAxiosError } from 'axios';
import type { TFunction } from 'i18next';
import { getProblemCode, getProblemMessage } from '@/lib/api-errors';
import type { BrandingImageKind } from '@/types';

/**
 * Limits of the public-site branding (BK-12). Mirror of the backend `Casazen.Core/Branding/OrgBrandingRules.cs`,
 * which validates again (image type and pixel size from the bytes): keep the two in sync.
 */
export const TAGLINE_MAX_LENGTH = 160;

export interface BrandingImageLimits {
  maxBytes: number;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
}

export const BRANDING_IMAGE_LIMITS: Record<BrandingImageKind, BrandingImageLimits> = {
  logo: { maxBytes: 2 * 1024 * 1024, minWidth: 64, minHeight: 32, maxWidth: 4000, maxHeight: 4000 },
  hero: { maxBytes: 10 * 1024 * 1024, minWidth: 1200, minHeight: 400, maxWidth: 8000, maxHeight: 8000 },
};

/** PNG, JPEG, WebP: no SVG (it can carry scripts) and no GIF. */
export const BRANDING_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** Value of the file input `accept` attribute. */
export const BRANDING_IMAGE_ACCEPT = BRANDING_IMAGE_TYPES.join(',');

/** Parameters of the limit messages of an image kind (`siteAppearance.errors.*`, `siteAppearance.images.*Hint`). */
export function imageLimitParams(kind: BrandingImageKind) {
  const limits = BRANDING_IMAGE_LIMITS[kind];
  return {
    maxMb: limits.maxBytes / (1024 * 1024),
    minWidth: limits.minWidth,
    minHeight: limits.minHeight,
    maxWidth: limits.maxWidth,
    maxHeight: limits.maxHeight,
  };
}

/**
 * Translation key of the client-side check of a picked file (type and size), or null when it can be uploaded. The
 * pixel size is checked by the server only.
 */
export function checkBrandingImageFile(kind: BrandingImageKind, file: File): string | null {
  if (file.size === 0) return 'siteAppearance.errors.imageEmpty';
  if (!(BRANDING_IMAGE_TYPES as readonly string[]).includes(file.type)) return 'siteAppearance.errors.imageType';
  if (file.size > BRANDING_IMAGE_LIMITS[kind].maxBytes) return 'siteAppearance.errors.imageTooLarge';
  return null;
}

/** Translation keys of the branding error codes of the backend (`OrgBrandingRules`). */
const BRANDING_CODE_KEYS: Record<string, string> = {
  org_branding_color_invalid: 'siteAppearance.errors.colorInvalid',
  org_branding_theme_invalid: 'siteAppearance.errors.themeInvalid',
  org_branding_tagline_too_long: 'siteAppearance.errors.taglineTooLong',
  org_branding_image_empty: 'siteAppearance.errors.imageEmpty',
  org_branding_image_too_large: 'siteAppearance.errors.imageTooLarge',
  org_branding_image_type_invalid: 'siteAppearance.errors.imageType',
  org_branding_image_dimensions_invalid: 'siteAppearance.errors.imageDimensions',
};

/**
 * The message of a failed branding request: the branding codes with this frontend's limits for the image kind,
 * otherwise the generic problem message, otherwise `fallbackKey`.
 */
export function brandingErrorMessage(
  error: unknown,
  t: TFunction,
  fallbackKey: string,
  kind?: BrandingImageKind,
): string {
  const code = isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
  const key = code ? BRANDING_CODE_KEYS[code] : undefined;
  if (key) {
    return t(key, { ...imageLimitParams(kind ?? 'logo'), maxLength: TAGLINE_MAX_LENGTH });
  }
  return getProblemMessage(error, t) ?? t(fallbackKey);
}
