import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SearchResultsPage } from '@/features/public-site/search/site-search-page';
import { PLATFORM_SCOPE } from '@/features/public-site/search/search-scope';
import { WHERE_PARAM } from '@/features/public-site/stay/use-stay-state';
import { useSeoMeta } from '@/lib/seo-meta';

/**
 * The public search of CasaZen across all the booking sites (BK-20, A8-13, redone as the results of a site: SEARCH-GLOBAL): «Dove ·
 * Quando · Chi», the free homes of every host with the total of their stay, the filters in a sheet with the count that follows, the
 * map beside the list and the nearby dates when nothing is free. It is the page of the results of a booking site (`SearchResultsPage`)
 * with the scope of all of them, inside the public shell with the look of the brand (never a host's). The search is in the address
 * (`?where=&checkin=&checkout=&guests=…`): it is shared, Back finds it again, and every card leads to the home on the site of its host
 * with the same dates.
 *
 * The page without a search is for the crawlers (title and description of its own); the address of a search (any parameter) is
 * `noindex,follow`: the results change with the dates and a page for each combination would only dilute the real ones.
 */
export function SearchPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const searched = [...params.keys()].length > 0;

  // The old page named the place `city`: a link that was shared opens the same search.
  useEffect(() => {
    const city = params.get('city')?.trim();
    if (city === undefined) return;
    const next = new URLSearchParams(params);
    next.delete('city');
    if (city && !next.get(WHERE_PARAM)) next.set(WHERE_PARAM, city);
    setParams(next, { replace: true });
  }, [params, setParams]);

  useSeoMeta({
    title: t('platformSearch.seo.title'),
    description: t('platformSearch.seo.description'),
    noindex: searched,
    follow: true,
  });

  return <SearchResultsPage scope={PLATFORM_SCOPE} />;
}
