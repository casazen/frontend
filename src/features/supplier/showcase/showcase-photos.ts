import type { PublicShowcaseWork } from '@/api/public-supplier.api';
import { isDisplayableMediaUrl } from '@/lib/media-url';
import type { SupplierService } from '@/types/supplier-services';

/**
 * A photo the supplier can choose for its showcase: one it already has, on its profile or on a service. They all sit in its own folder of
 * the storage (`suppliers/{orgId}/`), which is the only place the content of a showcase may point to (SP-13a). The upload of new ones
 * from the editor is SP-13b.
 */
export interface PoolPhoto {
  url: string;
  from: { kind: 'profile' } | { kind: 'service'; name: string };
  /** The place of the photo in its own list, from 1. */
  number: number;
}

/** Every displayable photo of the profile and of the services, once each, the profile first. */
export function buildPhotoPool(profilePhotos: readonly string[] | undefined, services: readonly SupplierService[] | undefined): PoolPhoto[] {
  const seen = new Set<string>();
  const pool: PoolPhoto[] = [];
  const add = (url: string, from: PoolPhoto['from'], number: number) => {
    if (!isDisplayableMediaUrl(url) || seen.has(url)) return;
    seen.add(url);
    pool.push({ url, from, number });
  };
  (profilePhotos ?? []).forEach((url, index) => add(url, { kind: 'profile' }, index + 1));
  for (const service of services ?? []) service.photoUrls.forEach((url, index) => add(url, { kind: 'service', name: service.name }, index + 1));
  return pool;
}

/** The jobs with a photo: what the advised "three jobs with a photo" counts. */
export function worksWithPhoto(gallery: readonly PublicShowcaseWork[] | undefined): number {
  return (gallery ?? []).filter((work) => (work.photoUrl ?? '').trim() !== '').length;
}

/** The tip of the editor: with this many jobs with a photo the page is convincing (the same number the checks of the server advise). */
export const ADVISED_WORKS = 3;
