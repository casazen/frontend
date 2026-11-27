import type { PublicShowcaseWork } from '@/api/public-supplier.api';
import { isDisplayableMediaUrl } from '@/lib/media-url';
import type { SupplierService } from '@/types/supplier-services';

export interface PoolPhoto {
  url: string;
  from: { kind: 'profile' } | { kind: 'service'; name: string };
  number: number;
}

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

export function worksWithPhoto(gallery: readonly PublicShowcaseWork[] | undefined): number {
  return (gallery ?? []).filter((work) => (work.photoUrl ?? '').trim() !== '').length;
}

export const ADVISED_WORKS = 3;
