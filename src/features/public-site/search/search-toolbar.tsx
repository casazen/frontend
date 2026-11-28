import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart } from 'lucide-react';
import { useEmbed } from '@/features/embed/embed-context';
import { SITE_TAG_ICONS, type SiteTag } from '@/features/public-site/cards/site-tags';
import { destinationOptions } from '@/features/public-site/home/home-model';
import { SearchBar } from '@/features/public-site/stay/search-bar';
import { usePublicSiteCalendar } from '@/features/public-site/stay/use-public-site-calendar';
import { cn } from '@/lib/utils';
import type { PublicDestination, PublicStaysSort } from '@/types/public-stays.types';
import { SORTS } from './search-state';
import { FiltersPanel, FiltersPanelButton, FiltersSheet } from './filters-sheet';
import type { SearchFacets } from './search-facets';
import type { SearchScope } from './search-scope';
import type { useSearchState } from './use-search-state';

interface SearchToolbarProps {
  scope: SearchScope;
  state: ReturnType<typeof useSearchState>;
  facets: SearchFacets;
  destinations: readonly PublicDestination[] | undefined;
  favoritesCount: number;
  onSearch: () => void;
}

function typedPlaceLabel(text: string): string {
  const spaced = text.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : text;
}

export function SearchToolbar({ scope, state, facets, destinations, favoritesCount, onSearch }: SearchToolbarProps) {
  const { t } = useTranslation();
  const embed = useEmbed();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersButton = useRef<HTMLButtonElement>(null);
  const closeFilters = () => {
    setFiltersOpen(false);
    filtersButton.current?.focus({ preventScroll: true });
  };
  const { stay, setStay, where, setWhere, search, setSearch } = state;
  const platform = scope.kind === 'platform';
  const { maxGuests, tags } = facets;
  const calendar = usePublicSiteCalendar(
    platform ? undefined : scope.slug,
    { adults: stay.adults, children: stay.children },
    platform ? { where } : undefined,
  );
  const options = useMemo(() => {
    const list = destinationOptions(destinations, (count) => t('siteHome.hero.destinationHomes', { count }));
    if (platform && where && !list.some((option) => option.id === where)) list.unshift({ id: where, label: typedPlaceLabel(where) });
    return list;
  }, [destinations, platform, where, t]);

  const toggleTag = (tag: SiteTag) => {
    const on = search.filters.tags.includes(tag);
    setSearch({ filters: { tags: on ? search.filters.tags.filter((item) => item !== tag) : [...search.filters.tags, tag] } });
  };

  return (
    <div className="sr-bar" data-testid="search-toolbar">
      <div className="sr-bar__stay">
        <SearchBar
          destination={where}
          onDestinationChange={setWhere}
          destinations={options}
          stay={stay}
          onStayChange={setStay}
          calendar={calendar}
          maxGuests={maxGuests}
          showDestination={platform || options.length > 1}
          onSearch={onSearch}
        />
      </div>
      <div className="sr-bar__tools">
        {embed ? (
          <FiltersPanelButton ref={filtersButton} state={state} open={filtersOpen} onToggle={() => setFiltersOpen((open) => !open)} />
        ) : (
          <FiltersSheet scope={scope} state={state} facets={facets} />
        )}
        <label className="sr-only" htmlFor="sr-sort">
          {t('siteSearch.sort.label')}
        </label>
        <select
          id="sr-sort"
          className="sr-sort"
          value={search.sort}
          onChange={(event) => setSearch({ sort: event.target.value as PublicStaysSort })}
          data-testid="search-sort"
        >
          {SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {t(`siteSearch.sort.${sort}`)}
            </option>
          ))}
        </select>
        <ul className="sr-cats" aria-label={t('siteSearch.categories')}>
          {!platform && !embed && (favoritesCount > 0 || search.onlyFavorites) ? (
            <li>
              <button
                type="button"
                className="sr-chip"
                aria-pressed={search.onlyFavorites}
                onClick={() => setSearch({ onlyFavorites: !search.onlyFavorites })}
                data-testid="search-only-favorites"
              >
                <Heart aria-hidden="true" />
                {t('siteSearch.onlyFavorites')}
              </button>
            </li>
          ) : null}
          {tags.map(({ tag }) => {
            const Icon = SITE_TAG_ICONS[tag];
            const on = search.filters.tags.includes(tag);
            return (
              <li key={tag}>
                <button type="button" className={cn('sr-chip')} aria-pressed={on} onClick={() => toggleTag(tag)}>
                  <Icon aria-hidden="true" />
                  {t(`siteHome.tags.${tag}`)}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {embed ? <FiltersPanel scope={scope} state={state} facets={facets} open={filtersOpen} onClose={closeFilters} /> : null}
    </div>
  );
}
