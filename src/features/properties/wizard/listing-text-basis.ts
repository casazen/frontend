import type { ListingTextBasis } from '@/api/listing-text.api';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** «a», «a e b», «a, b e c». */
function joinList(parts: readonly string[], and: string): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} ${and} ${parts[parts.length - 1]}`;
}

/**
 * What a text of the AI was written from, in words, for the line under it: «6 foto, il comune di Como (CO), 3 annunci simili della zona e i
 * dati dell'immobile». Only what there was: no photos read, no comune or no similar listing leave their part out.
 */
export function describeBasis(basis: ListingTextBasis, t: Translate): string {
  const parts: string[] = [];
  if (basis.photos > 0) parts.push(t('propertyWizard.photos.listing.basis.photos', { count: basis.photos }));
  if (basis.comune) {
    const place = basis.province ? `${basis.comune} (${basis.province})` : basis.comune;
    parts.push(t('propertyWizard.photos.listing.basis.comune', { place }));
  }
  if (basis.similarListings > 0) parts.push(t('propertyWizard.photos.listing.basis.similar', { count: basis.similarListings }));
  parts.push(t('propertyWizard.photos.listing.basis.facts'));
  return joinList(parts, t('propertyWizard.suggest.and'));
}
