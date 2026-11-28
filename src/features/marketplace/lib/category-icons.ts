import { BedDouble, Bike, Compass, Droplets, KeyRound, Leaf, PartyPopper, Shirt, Sparkles, Tag, Wrench, Zap, type LucideIcon } from 'lucide-react';

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

export const categoryIcon = (category: string): LucideIcon => CATEGORY_ICONS[category] ?? Tag;
