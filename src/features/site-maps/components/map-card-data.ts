import type { TFunction } from 'i18next';
import type { MapPinData } from './types';

/** What the card of a selected pin shows. */
export interface MapCardData {
  id: string;
  name: string;
  /** Zone or town. */
  zone?: string;
  photoUrl?: string;
  /** 0..5, only when the house has reviews. */
  rating?: number;
  /** The price as the page writes it («145 € a notte»). */
  priceLabel: string;
  /** Why the house is not free, when it is not («Non libera dal 12 ottobre»). */
  unavailableNote?: string;
  /** The page of the house. */
  href?: string;
}

/** What the card of a pin says: the name, the place, the mark and the price of the pin, and why it is not free when it is not. A zone pin has no card. */
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
