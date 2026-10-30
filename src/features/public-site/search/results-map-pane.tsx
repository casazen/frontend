import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { RegionMap, type MapLink, type MapPinData } from '@/features/site-maps';
import { availabilityNote, cardLink, cardPrice, placeOfCard } from '@/features/public-site/cards/house-card-model';
import { formatPrice } from '@/features/public-site/stay/stay-format';
import type { StayState } from '@/features/public-site/stay/stay-state';
import { displayableMediaUrls } from '@/lib/media-url';
import { siteLocale } from '@/lib/site-language';
import type { PublicStayCard } from '@/types/public-stays.types';

interface ResultsMapPaneProps {
  cards: readonly PublicStayCard[];
  /** The slug of the booking site; left out in the search across all the sites, where each home brings its own. */
  orgSlug?: string;
  /** The nights of the stay chosen: with them a pin says the total, without them the night. */
  nights: number | null;
  stay: StayState | null;
  /** The link between the list and the map (`useMapLink`): a card lights its pin and a pin lights its card. */
  link: MapLink;
}

/**
 * The map of the results (DB-07c): one pin for each home, with the price it says in the list (the total of the stay, else the night),
 * grey and striped for a home that is not free, on the schematic map of DB-19 (no tiles, no provider). The pins sit at the rounded
 * position the server publishes (about a kilometre) and the map says so; the information is also in the list next to it, so the
 * map is an aid and nothing is only there. A pin selected opens a card with the photo and the link to the home (a sheet on a phone).
 */
export function ResultsMapPane({ cards, orgSlug, nights, stay, link }: ResultsMapPaneProps) {
  const { t, i18n } = useTranslation();
  const locale = siteLocale(i18n.language);

  const pins = useMemo<MapPinData[]>(
    () =>
      cards.map((card) => {
        const price = cardPrice(card, nights);
        const currency = card.price.currency || 'EUR';
        const cents = price.kind === 'total' ? price.totalCents : price.perNightCents;
        return {
          id: card.id,
          lat: card.latitude,
          lon: card.longitude,
          label: formatPrice(cents, currency, locale),
          name: card.name,
          href: cardLink(orgSlug ?? card.orgSlug ?? '', card, stay),
          available: card.availability.available,
          unavailableNote: availabilityNote(card, t, locale) ?? undefined,
          card: {
            zone: placeOfCard(card, i18n.language),
            photoUrl: displayableMediaUrls(card.photos)[0],
            rating: card.rating?.average,
          },
        };
      }),
    [cards, nights, orgSlug, stay, locale, i18n.language, t],
  );

  return (
    <div className="sr-map" data-testid="results-map">
      <RegionMap pins={pins} activeId={link.activeId} onActiveChange={link.setActiveId} labels="auto" className="sr-map__box" />
      <p className="sr-map__note">
        <Info aria-hidden="true" />
        {t('siteSearch.map.note')}
      </p>
    </div>
  );
}
