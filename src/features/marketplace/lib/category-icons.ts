import { BedDouble, Bike, Compass, Droplets, KeyRound, Leaf, PartyPopper, Shirt, Sparkles, Tag, Wrench, Zap, type LucideIcon } from 'lucide-react';

/** One icon for each category of the catalog (`GET api/service-categories`), the tile of the page of the categories. */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  cleaning: Sparkles,
  maintenance: Wrench,
  plumbing: Droplets,
  laundry: Shirt,
  linen: BedDouble,
  'check-in': KeyRound,
  gardening: Leaf,
  events: PartyPopper,
  rental: Bike,
  excursions: Compass,
  electrical: Zap,
};

/** The icon of a category; a plain tag for a code the catalog gained after this list was written. */
export const categoryIcon = (category: string): LucideIcon => CATEGORY_ICONS[category] ?? Tag;
