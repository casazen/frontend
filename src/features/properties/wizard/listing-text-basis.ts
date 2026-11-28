import type { ListingTextBasis } from '@/api/listing-text.api';
import { joinList } from '@/lib/listing-texts';

type Translate = (key: string, options?: Record<string, unknown>) => string;

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
