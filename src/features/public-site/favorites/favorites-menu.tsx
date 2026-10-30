import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Heart, Home, X } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useSiteMoney } from '@/features/public-site/hooks/use-site-money';
import { usePortalRootProps } from '@/features/public-site/site-appearance-context';
import { FROM_TABLET_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { buildOrgBookingPath, buildPropertyBookingPath } from '@/lib/booking-url';
import { displayableMediaUrls } from '@/lib/media-url';
import { useOrgProperties } from '@/queries/use-public-org';
import type { PublicPropertyDto } from '@/types';
import { useFavorites } from './use-favorites';

/** One saved home: its photo, name, place and price from, a link to its page and the way to forget it. */
function SavedHome({
  site,
  property,
  onOpen,
  onRemove,
}: {
  site: string;
  property: PublicPropertyDto;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const money = useSiteMoney();
  const [photo] = displayableMediaUrls(property.photoUrls);

  return (
    <li className="flex items-center gap-2 py-2.5" data-testid="favorite-item">
      <Link
        to={buildPropertyBookingPath(site, property)}
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-[var(--cz-public-radius)] py-0.5"
      >
        {photo ? (
          <img src={photo} alt="" loading="lazy" decoding="async" className="h-16 w-16 shrink-0 rounded-[var(--cz-public-radius)] object-cover" />
        ) : (
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-[var(--cz-public-radius)] bg-[var(--cz-public-bg)] text-[var(--cz-public-muted)]">
            <Home className="h-6 w-6" aria-hidden />
          </span>
        )}
        <span className="min-w-0">
          <strong className="public-display block truncate text-base font-semibold">{property.name}</strong>
          {property.city ? <span className="block truncate text-sm text-[var(--cz-public-muted)]">{property.city}</span> : null}
          {property.nightlyRate > 0 ? (
            <span className="block text-sm">
              <span className="text-[var(--cz-public-muted)]">{t('publicSite.card.from')} </span>
              {money(property.nightlyRate)}
              <span className="text-[var(--cz-public-muted)]"> {t('publicSite.card.perNight')}</span>
            </span>
          ) : null}
        </span>
      </Link>
      <button
        type="button"
        aria-label={t('favorites.remove', { name: property.name })}
        className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-black/5"
        onClick={onRemove}
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </li>
  );
}

/**
 * The heart of the header with the number of homes saved, and the list of them in a sheet (DB-02b): from the right on a tablet and
 * a desktop, from the bottom on a phone. Each saved home links to its page and has a way to forget it; the list says it is kept on
 * this device ("non serve un account"). It is there only on a site with several homes (with one there is nothing to choose between)
 * and only once the homes are known; a saved home that the site no longer lists is not shown and not counted (it is kept: a home that
 * is paused for a while comes back in the list).
 */
export function FavoritesMenu({ site }: { site: string }) {
  const { t } = useTranslation();
  const portal = usePortalRootProps();
  const fromTablet = useMediaQuery(FROM_TABLET_QUERY);
  const [open, setOpen] = useState(false);
  const { ids, remove } = useFavorites(site);
  const { data: properties, isLoading, isError } = useOrgProperties(site);

  const saved = useMemo(() => {
    const byId = new Map((properties ?? []).map((property) => [property.id, property]));
    return ids.flatMap((id) => {
      const property = byId.get(id);
      return property ? [property] : [];
    });
  }, [ids, properties]);

  if ((properties?.length ?? 0) < 2) return null;

  const count = saved.length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={count > 0 ? t('favorites.open', { count }) : t('favorites.openEmpty')}
          className="relative grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-[var(--cz-public-radius)] hover:bg-black/5"
          data-testid="favorites-trigger"
        >
          <Heart className="h-6 w-6" aria-hidden />
          {count > 0 ? (
            <span
              aria-hidden
              className="absolute right-0 top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--cz-public-primary)] px-1 text-[11px] font-bold leading-none text-[var(--cz-public-on-primary)]"
              data-testid="favorites-count"
            >
              {count}
            </span>
          ) : null}
        </button>
      </SheetTrigger>
      <SheetContent {...portal} side={fromTablet ? 'right' : 'bottom'} data-testid="favorites-sheet">
        <SheetHeader className="px-5 pb-2 pr-14 pt-5 max-sm:pt-0">
          <SheetTitle className="public-display text-xl">{t('favorites.title')}</SheetTitle>
          <SheetDescription>{count > 0 ? t('favorites.description') : t('favorites.descriptionEmpty')}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {isLoading ? (
            <p className="py-6 text-sm text-[var(--cz-public-muted)]">{t('publicSite.loadingProperties')}</p>
          ) : isError ? (
            <p className="py-6 text-sm" role="alert">
              {t('publicSite.propertiesError.title')}
            </p>
          ) : count === 0 ? (
            <div className="grid justify-items-start gap-3 py-4">
              <Heart className="h-8 w-8 text-[var(--cz-public-primary-text)]" aria-hidden />
              <p className="text-sm">{t('favorites.emptyHint')}</p>
              <Link
                to={buildOrgBookingPath(site)}
                onClick={() => setOpen(false)}
                className="public-site-cta inline-flex h-11 items-center px-5 text-sm"
              >
                {t('favorites.seeHomes')}
              </Link>
            </div>
          ) : (
            <ul className="divide-y" data-testid="favorites-list">
              {saved.map((property) => (
                <SavedHome
                  key={property.id}
                  site={site}
                  property={property}
                  onOpen={() => setOpen(false)}
                  onRemove={() => remove(property.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
