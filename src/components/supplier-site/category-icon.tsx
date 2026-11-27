import { createElement } from 'react';
import {
  BedDouble,
  Compass,
  Droplets,
  House,
  KeyRound,
  Package,
  PartyPopper,
  Shirt,
  Sparkles,
  Trees,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  cleaning: Sparkles,
  maintenance: Wrench,
  plumbing: Droplets,
  laundry: Shirt,
  linen: BedDouble,
  'check-in': KeyRound,
  gardening: Trees,
  events: PartyPopper,
  rental: Package,
  excursions: Compass,
  electrical: Zap,
};

export function CategoryIcon({ category, className }: { category?: string; className?: string }) {
  return createElement(CATEGORY_ICONS[category ?? ''] ?? House, { className, 'aria-hidden': true });
}
