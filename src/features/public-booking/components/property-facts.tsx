import { useTranslation } from 'react-i18next';
import { Bath, BedDouble, Moon, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PublicPropertyDetailDto } from '@/types';

/** A positive finite count, or null: a missing or malformed number is left out, never shown as "NaN" or "0". */
function positiveCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

interface Fact {
  icon: LucideIcon;
  count: number;
  /** Plural noun of the fact ("guests", "bedrooms"): the count goes in front of it. */
  labelKey: string;
}

/** The facts of the house that every guest looks for first, as a short row of tiles. Only what the host has filled in. */
export function PropertyFacts({ property }: { property: Pick<PublicPropertyDetailDto, 'maxGuests' | 'bedrooms' | 'bathrooms' | 'minNights'> }) {
  const { t } = useTranslation();
  const minNights = positiveCount(property.minNights);

  const candidates: Array<Omit<Fact, 'count'> & { count: number | null }> = [
    { icon: Users, count: positiveCount(property.maxGuests), labelKey: 'publicProperty.facts.guests' },
    { icon: BedDouble, count: positiveCount(property.bedrooms), labelKey: 'publicProperty.facts.bedrooms' },
    { icon: Bath, count: positiveCount(property.bathrooms), labelKey: 'publicProperty.facts.bathrooms' },
    // One night is no minimum at all: only a real minimum is worth a tile.
    { icon: Moon, count: minNights !== null && minNights > 1 ? minNights : null, labelKey: 'publicProperty.facts.minNights' },
  ];
  const facts = candidates.filter((fact): fact is Fact => fact.count !== null);
  if (facts.length === 0) return null;

  return (
    <ul
      aria-label={t('publicProperty.facts.label')}
      className={cn('grid gap-3', facts.length > 3 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3')}
      data-testid="property-facts"
    >
      {facts.map(({ icon: Icon, count, labelKey }) => (
        <li key={labelKey} className="public-site-card flex min-w-0 flex-col gap-2 p-4">
          <Icon className="h-5 w-5 text-[var(--cz-public-primary-text)]" aria-hidden />
          <p className="min-w-0">
            <strong className="public-display text-2xl font-semibold leading-none">{count}</strong>{' '}
            <span className="text-sm text-[var(--cz-public-muted)]">{t(labelKey, { count })}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}
