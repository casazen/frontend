import { useTranslation } from 'react-i18next';
import { ArrowUpDown, Bath, BedDouble, DoorOpen, Layers, Moon, Ruler, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { floorKind, pickText, positive } from '@/features/public-booking/lib/property-profile';
import type { PublicPropertyDetailDto } from '@/types';
import '@/features/public-booking/property-page.css';

interface Fact {
  icon: LucideIcon;
  /** What is said in big: a number, or a word when a number would not do («Terra»). */
  value: string;
  label: string;
  key: string;
}

type FactsProperty = Pick<
  PublicPropertyDetailDto,
  'maxGuests' | 'bedrooms' | 'bathrooms' | 'minNights' | 'beds' | 'areaSqm' | 'floorLevel' | 'floorNote' | 'amenities'
>;

/**
 * The facts of the house that every guest looks for first (DB-04a): guests, rooms, beds, bathrooms, area, floor and lift, as big
 * tiles with an icon. Only what the host has filled in: a missing or malformed number is left out, never shown as «NaN» or «0», and
 * the lift is said only when the house has it (its absence is not a fact the host stated).
 */
export function PropertyFacts({ property }: { property: FactsProperty }) {
  const { t, i18n } = useTranslation();
  const number = (value: number) => new Intl.NumberFormat(i18n.language).format(value);

  const facts: Fact[] = [];
  const add = (key: string, icon: LucideIcon, value: string, label: string) => facts.push({ key, icon, value, label });

  const guests = positive(property.maxGuests);
  if (guests) add('guests', Users, number(guests), t('publicProperty.facts.guests', { count: guests }));
  const bedrooms = positive(property.bedrooms);
  if (bedrooms) add('bedrooms', DoorOpen, number(bedrooms), t('publicProperty.facts.bedrooms', { count: bedrooms }));
  const beds = positive(property.beds);
  if (beds) add('beds', BedDouble, number(beds), t('publicProperty.facts.beds', { count: beds }));
  const bathrooms = positive(property.bathrooms);
  if (bathrooms) add('bathrooms', Bath, number(bathrooms), t('publicProperty.facts.bathrooms', { count: bathrooms }));
  const area = positive(property.areaSqm);
  if (area) add('area', Ruler, t('publicProperty.facts.areaValue', { value: number(area) }), t('publicProperty.facts.area'));

  if (typeof property.floorLevel === 'number' && Number.isFinite(property.floorLevel)) {
    const kind = floorKind(property.floorLevel);
    const value =
      kind === 'ground'
        ? t('publicProperty.facts.floorGround')
        : kind === 'below'
          ? t('publicProperty.facts.floorBelow')
          : t('publicProperty.facts.floorUpper', { n: property.floorLevel });
    const note = pickText(property.floorNote, i18n.language);
    add('floor', Layers, value, [t('publicProperty.facts.floor'), note].filter(Boolean).join(' · '));
  }

  if ((property.amenities ?? []).includes('Elevator')) {
    add('elevator', ArrowUpDown, t('publicProperty.facts.yes'), t('publicProperty.facts.elevator'));
  }

  // One night is no minimum at all: only a real minimum is worth a tile.
  const minNights = positive(property.minNights);
  if (minNights !== null && minNights > 1) {
    add('minNights', Moon, number(minNights), t('publicProperty.facts.minNights', { count: minNights }));
  }

  if (facts.length === 0) return null;

  return (
    <ul aria-label={t('publicProperty.facts.label')} className="pp-specs" data-testid="property-facts">
      {facts.map(({ key, icon: Icon, value, label }) => (
        <li key={key} className={cn('pp-spec', value.length > 7 && 'pp-spec--wide')}>
          <span className="pp-spec__icon" aria-hidden="true">
            <Icon />
          </span>
          <strong className="pp-spec__value">{value}</strong>
          <span className="pp-spec__label">{label}</span>
        </li>
      ))}
    </ul>
  );
}
