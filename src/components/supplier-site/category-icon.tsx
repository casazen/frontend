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

/** The mark of each category of the catalog (`ServiceCategories` of the backend): what stands in for a photo the supplier has not uploaded yet. */
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

/**
 * The icon of a service category, from a fixed table (never a new component, so it is safe as an element type; `createElement` says
 * so to the linter that cannot know it).
 */
export function CategoryIcon({ category, className }: { category?: string; className?: string }) {
  return createElement(CATEGORY_ICONS[category ?? ''] ?? House, { className, 'aria-hidden': true });
}
