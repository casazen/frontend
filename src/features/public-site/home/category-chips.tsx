import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutGrid } from 'lucide-react';
import { SITE_TAG_ICONS, countTags } from '@/features/public-site/cards/site-tags';
import { searchHref } from '@/features/public-site/search/search-href';
import type { PublicStayCard } from '@/types/public-stays.types';

/**
 * The categories of the home (DB-07b): chips to scroll through (all the homes, then Mare, Centro storico, Con piscina...) built from
 * the labels the homes carry, each with how many. A label no home carries is not there, and with fewer than two categories the
 * whole row goes: one chip would be «all» again. Each chip opens the results already filtered, with the stay chosen so far.
 */
export function CategoryChips({ cards, searchPath }: { cards: readonly PublicStayCard[]; searchPath: string }) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const tags = countTags(cards);
  if (tags.length < 2) return null;

  return (
    <nav className="hm-cats" aria-label={t('siteHome.categories.label')} data-testid="home-categories">
      <ul>
        <li>
          <Link className="hm-cat" to={searchHref(searchPath, searchParams)}>
            <span className="hm-cat__i">
              <LayoutGrid aria-hidden="true" />
            </span>
            <span className="hm-cat__t">
              <strong>{t('siteHome.categories.all')}</strong>
              <small>{t('siteHome.categories.homes', { count: cards.length })}</small>
            </span>
          </Link>
        </li>
        {tags.map(({ tag, count }) => {
          const Icon = SITE_TAG_ICONS[tag];
          return (
            <li key={tag}>
              <Link className="hm-cat" to={searchHref(searchPath, searchParams, { tags: tag })}>
                <span className="hm-cat__i">
                  <Icon aria-hidden="true" />
                </span>
                <span className="hm-cat__t">
                  <strong>{t(`siteHome.tags.${tag}`)}</strong>
                  <small>{t('siteHome.categories.homes', { count })}</small>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
