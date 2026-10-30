import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Home, Info } from 'lucide-react';
import { RegionMap, useMapLink, type MapPinData } from '@/features/site-maps';
import { searchHref } from '@/features/public-site/search/search-href';
import { formatPrice } from '@/features/public-site/stay/stay-format';
import { siteLocale } from '@/lib/site-language';
import type { HomeZone } from './home-model';

/**
 * «Dove sono le case» (DB-07b): the zones of the site, one for each comune where it has homes, as a list and as pins on the
 * schematic map (DB-19, nothing from a map provider). A zone is its name, how many homes it has, the lowest night among them and the
 * photo of the first: the host's own words about a zone are not in the data yet (DB-D10), so none is written here. The list and
 * the map are the same zones (the one lights the other), each leads to the results of that place, and the pins sit at the middle
 * of the rounded positions of the homes, never at an exact one. The section needs two zones to be worth a map.
 */
export function ZonesSection({ zones, searchPath }: { zones: readonly HomeZone[]; searchPath: string }) {
  const { t, i18n } = useTranslation();
  const locale = siteLocale(i18n.language);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const link = useMapLink();
  const hrefOf = (zone: HomeZone) => searchHref(searchPath, searchParams, { where: zone.id });

  const pins = useMemo<MapPinData[]>(
    () =>
      zones.map((zone) => ({
        id: zone.id,
        lat: zone.lat,
        lon: zone.lon,
        label: zone.name,
        name: t('siteHome.zones.pinName', { name: zone.name, count: zone.count }),
        tone: 'zone',
      })),
    [zones, t],
  );

  return (
    <section className="hm-band hm-zones" id="zone" data-section="zone" aria-labelledby="home-zones-title" data-testid="home-zones">
      <header className="hm-head">
        <div className="hm-head__text">
          <p className="hm-eyebrow">{t('siteHome.zones.eyebrow')}</p>
          <h2 id="home-zones-title">{t('siteHome.zones.title')}</h2>
          <p className="hm-head__lead">{t('siteHome.zones.lead')}</p>
        </div>
      </header>
      <div className="hm-zones__in">
        <ul className="hm-zones__list">
          {zones.map((zone) => (
            <li key={zone.id}>
              <Link className="hm-zone" to={hrefOf(zone)} {...link.bind(zone.id)} data-testid="home-zone">
                <span className="hm-zone__pic">
                  {zone.photo ? <img src={zone.photo} alt="" loading="lazy" decoding="async" /> : <Home aria-hidden="true" />}
                </span>
                <span className="hm-zone__t">
                  <strong>{zone.name}</strong>
                  <small>
                    {t('siteHome.categories.homes', { count: zone.count })} · {t('publicSite.card.from')}{' '}
                    {formatPrice(zone.fromPerNightCents, zone.currency, locale)} / {t('siteHome.card.night')}
                  </small>
                </span>
                <span className="hm-zone__go">
                  <ArrowRight aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="hm-zones__map">
          <RegionMap
            pins={pins}
            activeId={link.activeId}
            onActiveChange={link.setActiveId}
            onSelect={(id) => {
              const zone = zones.find((item) => item.id === id);
              if (zone) navigate(hrefOf(zone));
            }}
            labels="major"
            aspect={4 / 3}
          />
          <p className="hm-zones__note">
            <Info aria-hidden="true" />
            {t('siteHome.zones.note')}
          </p>
        </div>
      </div>
    </section>
  );
}
