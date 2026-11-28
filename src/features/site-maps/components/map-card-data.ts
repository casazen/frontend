import type { TFunction } from 'i18next';
import type { MapPinData } from './types';

export interface MapCardData {
  id: string;
  name: string;
  zone?: string;
  photoUrl?: string;
  rating?: number;
  priceLabel: string;
  unavailableNote?: string;
  href?: string;
}

export function mapCardOfPin(pin: MapPinData, t: TFunction): MapCardData | null {
  if (pin.tone === 'zone') return null;
  return {
    id: pin.id,
    name: pin.name,
    zone: pin.card?.zone,
    photoUrl: pin.card?.photoUrl,
    rating: pin.card?.rating,
    priceLabel: pin.card?.priceLabel ?? pin.label,
    unavailableNote: pin.available === false ? (pin.unavailableNote ?? t('siteMap.unavailable')) : undefined,
    href: pin.href,
  };
}
