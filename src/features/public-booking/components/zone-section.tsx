import { lazy, Suspense, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Car, Cross, Footprints, Landmark, MapPin, ShoppingBag, SquareParking, TrainFront, Umbrella, Utensils } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatDistance, pickText, usablePoints } from '@/features/public-booking/lib/property-profile';
import { useMapLink } from '@/features/site-maps/components/use-map-link';
import type { LocalKind } from '@/features/site-maps/engine/local';
import type { LocalPoi } from '@/features/site-maps/components/types-local';
import { PUBLIC_POI_TYPES, type PublicAreaKind, type PublicPropertyDetailDto } from '@/types';
import '@/features/public-booking/property-page.css';

// The drawing and its data come with the section, not with the page: the map loads after the page does.
const LocalMap = lazy(() => import('@/features/site-maps/components/local-map').then((m) => ({ default: m.LocalMap })));

const POI_ICONS: Record<string, LucideIcon> = {
  beach: Umbrella,
  sight: Landmark,
  food: Utensils,
  shop: ShoppingBag,
  transport: TrainFront,
  health: Cross,
  parking: SquareParking,
};

const AREA_KINDS: Record<PublicAreaKind, LocalKind> = { Country: 'country', Coast: 'coast', Historic: 'historic' };

/** The direction of the beach nearest to the house: on a coast map the sea is drawn on that side. */
function seaBearing(points: readonly LocalPoi[]): number | undefined {
  const beaches = points.filter((poi) => poi.type === 'beach');
  if (beaches.length === 0) return undefined;
  return beaches.reduce((nearest, poi) => (poi.distM < nearest.distM ? poi : nearest)).bearingDeg;
}

/**
 * «Zona» (DB-04a): where the house is, in the host's words, a schematic map of the neighbourhood when the host said what kind of place
 * it is, and the places near it with the time to get there. The map is a scheme drawn by us around a circle (the exact address is
 * never on it, and the note says when it arrives); the list says the same things in words, so the map is a help and never the only way.
 */
export function ZoneSection({ property }: { property: PublicPropertyDetailDto }) {
  const { t, i18n } = useTranslation();
  const link = useMapLink();
  const language = i18n.language;

  const zone = pickText(property.zone, language);
  const near = pickText(property.near, language);
  const lead = [zone, near].filter(Boolean).join(' · ');

  const points = useMemo(
    () =>
      usablePoints(property).map<LocalPoi>((poi) => ({
        id: poi.id,
        type: poi.type,
        name: pickText(poi.name, language) || t('publicProperty.zone.unnamed'),
        mode: poi.mode,
        minutes: Math.round(poi.minutes),
        bearingDeg: poi.bearingDeg,
        distM: poi.distanceM,
      })),
    [property, language, t],
  );
  const groups = [...PUBLIC_POI_TYPES, 'other'].map((type) => ({
    type,
    list: points
      .filter((poi) => (type === 'other' ? !(PUBLIC_POI_TYPES as readonly string[]).includes(poi.type) : poi.type === type))
      .sort((a, b) => a.minutes - b.minutes || a.distM - b.distM),
  })).filter((group) => group.list.length > 0);

  const kind = property.areaKind ? AREA_KINDS[property.areaKind] : undefined;

  return (
    <section id="zona" aria-labelledby="property-zone-title" className="scroll-mt-20 space-y-6" data-testid="property-zone">
      <div>
        <p className="pp-eyebrow">{t('publicProperty.zone.eyebrow')}</p>
        <h2 id="property-zone-title" className="public-display text-2xl font-semibold">
          {t('publicProperty.zone.title')}
        </h2>
        {lead ? <p className="mt-2 max-w-[60ch] text-[var(--cz-public-muted)]">{lead}</p> : null}
      </div>

      {kind ? (
        <Suspense fallback={<div aria-hidden className="aspect-[4/3] animate-pulse rounded-2xl bg-[var(--cz-public-border)] motion-reduce:animate-none" />}>
          <LocalMap
            kind={kind}
            seed={property.slug || property.id}
            pois={points}
            seaBearingDeg={kind === 'coast' ? seaBearing(points) : undefined}
            activeId={link.activeId}
            onActiveChange={link.setActiveId}
          />
        </Suspense>
      ) : null}

      {groups.length > 0 ? (
        <div className="pp-poi" data-testid="property-poi">
          {groups.map(({ type, list }) => {
            const Icon = POI_ICONS[type] ?? MapPin;
            return (
              <section key={type} aria-label={t(`publicProperty.zone.types.${type}`)}>
                <h3 className="pp-poi__title">
                  <Icon aria-hidden />
                  {t(`publicProperty.zone.types.${type}`)}
                </h3>
                <ul className="m-0 list-none p-0">
                  {list.map((poi) => {
                    const ModeIcon = poi.mode === 'walk' ? Footprints : Car;
                    return (
                      <li key={poi.id} className="pp-poi__row" {...link.bind(poi.id)}>
                        <span className="font-semibold">{poi.name}</span>
                        <span className="pp-poi__time">
                          <ModeIcon aria-hidden />
                          {t(poi.mode === 'walk' ? 'publicProperty.zone.onFoot' : 'publicProperty.zone.byCar', { minutes: poi.minutes })}
                          <small>· {formatDistance(poi.distM, language)}</small>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
