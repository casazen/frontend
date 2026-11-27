import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { listAmenities } from '@/lib/public-amenities';
import { siteLocale } from '@/lib/site-language';
import { writeFacetPrice, type FacetsCurrency } from './search-facets';
import type { SearchFilters } from './search-state';

export function ActiveFilterChips({
  filters,
  facets,
  onChange,
}: {
  filters: SearchFilters;
  facets: FacetsCurrency;
  onChange: (patch: Partial<SearchFilters>) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = siteLocale(i18n.language);
  const euros = (value: number) => writeFacetPrice(value, facets, locale, t);

  const chips: { id: string; label: string; remove: () => void }[] = [];
  // While the homes are not in, the currency is not known: that is not «no currency», so the chip waits for it instead of saying the currency is not available.
  if ((filters.minPrice || filters.maxPrice) && facets.currencyState !== 'pending') {
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
