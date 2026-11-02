import { useTranslation } from 'react-i18next';
import { useHomeSections, type HomeSectionId } from '@/features/public-site/home/home-sections';
import { useOrgProperties } from '@/queries/use-public-org';

export interface SiteNavItem {
  id: 'homes' | HomeSectionId;
  label: string;
  to: string;
}

const SECTION_LABEL: Record<HomeSectionId, string> = {
  case: 'siteHome.nav.homes',
  perche: 'siteHome.nav.why',
  zone: 'siteHome.nav.zones',
  domande: 'siteHome.nav.faq',
};

/**
 * The links of the menu of a booking site with several homes (DB-07b): «Le case» (the results) on every page, and, on the home,
 * the sections it has drawn: «Zone», «Perché prenotare qui», «Domande frequenti». A site with one home has no menu: there is
 * nothing to choose between. The homes are the list the header already reads for the hearts (no new request).
 */
export function useSiteNavItems(slug: string | undefined, basePath: string): SiteNavItem[] {
  const { t } = useTranslation();
  const sections = useHomeSections();
  const properties = useOrgProperties(slug);
  if ((properties.data?.length ?? 0) < 2) return [];
  return [
    { id: 'homes', label: t('siteHome.nav.homes'), to: `${basePath}/search` },
    ...sections
      .filter((id) => id !== 'case')
      .map((id) => ({ id, label: t(SECTION_LABEL[id]), to: `${basePath}?sezione=${id}` })),
  ];
}
