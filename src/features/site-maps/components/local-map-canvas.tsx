import { Car, Footprints, Home, Landmark, Lock, MapPin, ParkingSquare, ShoppingBag, TrainFront, Umbrella, Utensils, Cross, type LucideIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { localMapSvg, localPlace } from '../engine/local';
import { cn } from '@/lib/utils';
import { SvgHost } from './svg-host';
import type { LocalMapProps, LocalPoi } from './types-local';
import { useElementSize } from './use-element-size';

const ICONS: Record<string, LucideIcon> = {
  beach: Umbrella,
  sight: Landmark,
  food: Utensils,
  shop: ShoppingBag,
  transport: TrainFront,
  health: Cross,
  parking: ParkingSquare,
};
const FAR_M = 20000; // farther than this (airports) a point stays in the list only

/**
 * Distance of a point on the drawing, in metres: the direction is true, the distance is compressed (square root) inside an
 * ellipse that fills the 4:3 frame, so that the points on foot and by car all fit in the map. It is a scheme of the zone, never
 * a measure: no distance is read from the map, and no coordinate takes part in it.
 */
function drawDistance(p: LocalPoi, maxD: number, spanM: number): number {
  const th = (p.bearingDeg * Math.PI) / 180;
  const A = 0.5 * spanM * 0.84;
  const B = 0.375 * spanM * 0.78;
  const R = 1 / Math.sqrt((Math.sin(th) / A) ** 2 + (Math.cos(th) / B) ** 2);
  return (0.36 + 0.64 * Math.sqrt(Math.min(p.distM, maxD) / maxD)) * R;
}

/** The map of the zone: loaded on demand by `LocalMap`. */
export default function LocalMapCanvas({ kind, seed, spanM = 1500, seaBearingDeg, pois = [], activeId, onActiveChange, addressUnlocked = false, labels }: LocalMapProps) {
  const { t } = useTranslation();
  const [box, size] = useElementSize<HTMLDivElement>();
  const drawWidth = Math.max(320, Math.min(1000, Math.round(size.w / 20) * 20));
  const svg = useMemo(() => (size.w > 0 ? localMapSvg({ kind, seed, spanM, seaBearingDeg, width: drawWidth, labels }) : ''), [kind, seed, spanM, seaBearingDeg, drawWidth, labels, size.w]);
  const near = pois.filter((p) => p.distM <= FAR_M);
  const maxD = Math.max(300, ...near.map((p) => p.distM));
  const placed = near.map((p) => ({ poi: p, ...localPlace({ kind, seed, spanM, seaBearingDeg }, { bearingDeg: p.bearingDeg, distM: drawDistance(p, maxD, spanM) }) }));
  return (
    <div ref={box} className="absolute inset-0" data-testid="local-map">
      <SvgHost svg={svg} />
      <span aria-hidden="true" className="absolute left-1/2 top-1/2 aspect-square w-[17%] min-w-[92px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-[var(--cz-public-primary,#111)] bg-[var(--cz-public-primary,#111)]/15" />
      <span aria-hidden="true" className="absolute left-1/2 top-1/2 z-10 grid h-[46px] w-[46px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-white bg-[var(--cz-public-primary,#111)] text-[var(--cz-public-on-primary,#fff)] shadow-lg">
        <Home className="h-5 w-5" />
      </span>
      <ul aria-label={t('siteMap.local.poisLabel')} className="absolute inset-0 z-20 m-0 list-none p-0">
        {placed.map(({ poi, x, y }) => {
          const Icon = ICONS[poi.type] ?? MapPin;
          const lit = poi.id === activeId;
          const ModeIcon = poi.mode === 'walk' ? Footprints : Car;
          return (
            <li key={poi.id} className="absolute" style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)', zIndex: lit ? 30 : 20 }}>
              <button
                type="button"
                data-poi-id={poi.id}
                aria-label={t(poi.mode === 'walk' ? 'siteMap.local.poiWalk' : 'siteMap.local.poiCar', { name: poi.name, minutes: poi.minutes })}
                onMouseEnter={() => onActiveChange?.(poi.id)}
                onMouseLeave={() => onActiveChange?.(null)}
                onFocus={() => onActiveChange?.(poi.id)}
                onBlur={() => onActiveChange?.(null)}
                className="group relative grid h-11 w-11 place-items-center rounded-full focus-visible:outline-none"
              >
                <span
                  className={cn(
                    'grid h-[34px] w-[34px] place-items-center rounded-full border-2 border-[var(--cz-public-primary,#111)] shadow-md motion-safe:transition-transform group-focus-visible:ring-2 group-focus-visible:ring-[var(--cz-public-primary-text,#1d4ed8)] group-focus-visible:ring-offset-2',
                    lit
                      ? 'scale-110 bg-[var(--cz-public-primary,#111)] text-[var(--cz-public-on-primary,#fff)]'
                      : 'bg-[var(--cz-public-surface,#fff)] text-[var(--cz-public-text,#111)]',
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                {lit ? (
                  <span className="pointer-events-none absolute top-full mt-1 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[var(--cz-public-surface,#fff)] px-2.5 py-1 text-xs font-bold text-[var(--cz-public-text,#111)] shadow-md" aria-hidden="true">
                    {poi.name}
                    <ModeIcon className="h-3 w-3" />
                    {t('siteMap.local.minutes', { minutes: poi.minutes })}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="absolute bottom-3 left-3 right-3 z-30 flex max-w-[calc(100%-1.5rem)] items-start gap-1.5 rounded-2xl bg-[var(--cz-public-surface,#fff)]/92 px-3 py-1.5 text-xs text-[var(--cz-public-muted,#555)] shadow-sm sm:right-auto">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          {addressUnlocked ? t('siteMap.local.unlocked') : t('siteMap.local.approximate')} {t('siteMap.local.scheme')}
        </span>
      </p>
    </div>
  );
}
