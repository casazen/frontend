import { useTranslation } from 'react-i18next';
import { comuniOf } from '@/features/public-site/home/home-model';
import { homeSectionIds, type HomeSectionId } from '@/features/public-site/home/home-sections';
import { DEFAULT_GUESTS } from '@/lib/booking-url';
import { useOrgStays } from '@/queries/use-public-stays';

export interface SiteNavItem {
  id: HomeSectionId;
  label: string;
  to: string;
}

const SECTION_LABEL: Record<HomeSectionId, string> = {
  case: 'siteHome.nav.homes',
  perche: 'siteHome.nav.why',
  zone: 'siteHome.nav.zones',
  domande: 'siteHome.nav.faq',
};

/** Section links open the unfiltered home. Read its cards even when entering another page directly. */
export function useSiteNavItems(slug: string | undefined, basePath: string): SiteNavItem[] {
  const { t } = useTranslation();
  const { data } = useOrgStays(slug, { adults: DEFAULT_GUESTS, children: 0 });
  const cards = data?.items ?? [];
  return homeSectionIds(cards.length, comuniOf(cards).length).map((id) => ({
    id,
    label: t(SECTION_LABEL[id]),
    to: id === 'case' ? `${basePath}/search` : `${basePath}?sezione=${id}`,
  }));
}
