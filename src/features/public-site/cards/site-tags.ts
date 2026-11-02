import { Droplets, Landmark, PawPrint, Sun, Sunset, Trees, Waves, type LucideIcon } from 'lucide-react';

/**
 * The labels a home of the booking site can carry (the `Tags` vocabulary of the site profile, DB-11a), in the order the backend
 * keeps them: the categories of the home page and the chips of the results. An id is part of the API: it is never renamed. The
 * words are `siteHome.tags.<id>` (IT and EN); a label the page does not know is not drawn.
 */
export const SITE_TAGS = ['mare', 'centro', 'piscina', 'pet', 'campagna', 'terrazza', 'vista-mare'] as const;

export type SiteTag = (typeof SITE_TAGS)[number];

export const SITE_TAG_ICONS: Record<SiteTag, LucideIcon> = {
  mare: Waves,
  centro: Landmark,
  piscina: Droplets,
  pet: PawPrint,
  campagna: Trees,
  terrazza: Sun,
  'vista-mare': Sunset,
};

export function isSiteTag(value: string): value is SiteTag {
  return (SITE_TAGS as readonly string[]).includes(value);
}

/** The labels of a list of homes that the page knows, with how many homes carry each, in the order of the vocabulary. */
export function countTags(cards: readonly { tags: readonly string[] }[]): { tag: SiteTag; count: number }[] {
  const counts = new Map<SiteTag, number>();
  for (const card of cards) {
    for (const tag of new Set(card.tags)) {
      if (isSiteTag(tag)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return SITE_TAGS.filter((tag) => counts.has(tag)).map((tag) => ({ tag, count: counts.get(tag) ?? 0 }));
}
