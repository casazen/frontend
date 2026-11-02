import { useTranslation } from 'react-i18next';
import {
  Binoculars,
  BedDouble,
  Car,
  Coffee,
  Droplet,
  DoorOpen,
  Flame,
  Footprints,
  Heart,
  House,
  Landmark,
  Lock,
  MapPin,
  Mountain,
  PawPrint,
  ShieldCheck,
  Ship,
  Snowflake,
  Sparkles,
  SquareParking,
  Star,
  Sun,
  Sunset,
  TrainFront,
  Trees,
  Tv,
  Umbrella,
  Utensils,
  VolumeX,
  Waves,
  Wifi,
  Wine,
  KeyRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { isItalianFallback, pickText } from '@/features/public-booking/lib/property-profile';
import type { PublicHighlight } from '@/types';
import '@/features/public-booking/property-page.css';

/** The icons a host can give a highlight: the fixed list of the backend (DB-11a), each with the symbol the page draws for it. */
const HIGHLIGHT_ICONS: Record<string, LucideIcon> = {
  waves: Waves,
  walk: Footprints,
  'volume-x': VolumeX,
  trees: Trees,
  sunset: Sunset,
  sun: Sun,
  landmark: Landmark,
  key: KeyRound,
  door: DoorOpen,
  umbrella: Umbrella,
  mountain: Mountain,
  panorama: Binoculars,
  wine: Wine,
  boat: Ship,
  parking: SquareParking,
  coffee: Coffee,
  flame: Flame,
  wifi: Wifi,
  paw: PawPrint,
  bed: BedDouble,
  heart: Heart,
  star: Star,
  home: House,
  utensils: Utensils,
  snow: Snowflake,
  sparkles: Sparkles,
  shield: ShieldCheck,
  lock: Lock,
  tv: Tv,
  droplet: Droplet,
  'map-pin': MapPin,
  car: Car,
  train: TrainFront,
};

/** Up to three things the host wants a guest to know first, each with an icon, a title and a line. Nothing when the host wrote none. */
export function PropertyHighlights({ highlights }: { highlights: readonly PublicHighlight[] | null | undefined }) {
  const { i18n } = useTranslation();
  const items = (highlights ?? [])
    .map((highlight) => ({ highlight, title: pickText(highlight.title, i18n.language) }))
    .filter((item) => item.title !== '')
    .slice(0, 3);
  if (items.length === 0) return null;

  return (
    <ul className="pp-highlights" data-testid="property-highlights">
      {items.map(({ highlight, title }) => {
        const Icon = HIGHLIGHT_ICONS[highlight.icon] ?? Sparkles;
        const text = pickText(highlight.text, i18n.language);
        return (
          <li key={`${highlight.icon}-${title}`} lang={isItalianFallback(highlight.title, i18n.language) ? 'it' : undefined}>
            <span className="pp-highlights__icon" aria-hidden="true">
              <Icon />
            </span>
            <div className="min-w-0">
              <h3 className="public-display text-lg font-semibold">{title}</h3>
              {text ? <p className="text-[var(--cz-public-muted)]">{text}</p> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
