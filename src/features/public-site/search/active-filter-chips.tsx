import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { formatPrice } from '@/features/public-site/stay/stay-format';
import { listAmenities } from '@/lib/public-amenities';
import { siteLocale } from '@/lib/site-language';
import type { SearchFilters } from './search-state';

/**
 * The filters that are on, as chips that take themselves off with one press (DB-07c): the price range, the rooms, the area, each
 * service and each rule. The category chips of the bar are their own toggles and are not repeated here. The address changes and
 * the list follows; the chip says in its name what it removes («Togli «Piscina»»).
 */
export function ActiveFilterChips({
  filters,
  currency = 'EUR',
  onChange,
}: {
  filters: SearchFilters;
  /** What the price of the chip is written in: the currency of the homes (francs in Switzerland). */
  currency?: string;
  onChange: (patch: Partial<SearchFilters>) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = siteLocale(i18n.language);
  const euros = (value: number) => formatPrice(value * 100, currency, locale);

  const chips: { id: string; label: string; remove: () => void }[] = [];
  if (filters.minPrice || filters.maxPrice) {
    const label =
      filters.minPrice && filters.maxPrice
        ? t('siteSearch.filters.priceBetween', { from: euros(filters.minPrice), to: euros(filters.maxPrice) })
        : filters.minPrice
          ? t('siteSearch.filters.priceFrom', { price: euros(filters.minPrice) })
          : t('siteSearch.filters.priceUpTo', { price: euros(filters.maxPrice ?? 0) });
    chips.push({ id: 'price', label, remove: () => onChange({ minPrice: null, maxPrice: null }) });
  }
  if (filters.bedrooms) chips.push({ id: 'bedrooms', label: t('siteSearch.filters.bedroomsChip', { n: filters.bedrooms }), remove: () => onChange({ bedrooms: null }) });
  if (filters.bathrooms) chips.push({ id: 'bathrooms', label: t('siteSearch.filters.bathroomsChip', { n: filters.bathrooms }), remove: () => onChange({ bathrooms: null }) });
  if (filters.minSqm) chips.push({ id: 'area', label: t('siteSearch.filters.areaAtLeast', { n: filters.minSqm }), remove: () => onChange({ minSqm: null }) });
  for (const name of filters.amenities) {
    const meta = listAmenities([name])[0];
    const label = meta?.labelKey ? t(meta.labelKey) : (meta?.fallbackLabel ?? name);
    chips.push({ id: `amenity-${name}`, label, remove: () => onChange({ amenities: filters.amenities.filter((item) => item !== name) }) });
  }
  for (const rule of filters.rules) {
    chips.push({ id: `rule-${rule}`, label: t(`siteSearch.filters.rule.${rule}`), remove: () => onChange({ rules: filters.rules.filter((item) => item !== rule) }) });
  }

  if (chips.length === 0) return null;
  return (
    <ul className="sr-active" aria-label={t('siteSearch.filters.activeLabel')} data-testid="search-active-filters">
      {chips.map((chip) => (
        <li key={chip.id}>
          <button type="button" className="sr-x" onClick={chip.remove} aria-label={t('siteSearch.filters.remove', { name: chip.label })}>
            <span>{chip.label}</span>
            <X aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
