import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Baby, Cigarette, KeyRound, PartyPopper, PawPrint, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { usePortalRootProps } from '@/features/public-site/site-appearance-context';
import { formatPrice } from '@/features/public-site/stay/stay-format';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { listAmenities } from '@/lib/public-amenities';
import { siteLocale } from '@/lib/site-language';
import { cn } from '@/lib/utils';
import { useOrgStays } from '@/queries/use-public-stays';
import type { PublicStayCard } from '@/types/public-stays.types';
import { PRICE_STEP, AREA_STEP, areaBounds, dropUnsupported, isUnsupported, priceBounds } from './filters-model';
import {
  FILTER_AMENITIES,
  FILTER_RULES,
  NO_FILTERS,
  activeFilterCount,
  toStaysQuery,
  type FilterRule,
  type SearchFilters,
} from './search-state';
import type { useSearchState } from './use-search-state';

/** The sliders wait for a pause of the finger before they ask the server how many homes are left. */
const COUNT_DELAY_MS = 250;
const ROOM_CHOICES = [1, 2, 3];
const BATH_CHOICES = [1, 2];

const RULE_ICONS: Record<FilterRule, LucideIcon> = {
  pets: PawPrint,
  children: Baby,
  selfCheckin: KeyRound,
  smoking: Cigarette,
  parties: PartyPopper,
};

interface FiltersSheetProps {
  slug: string;
  state: ReturnType<typeof useSearchState>;
  /** Every home of the site: how far the sliders go comes from all of them. */
  catalog: readonly PublicStayCard[];
}

/**
 * The filters of the results (DB-07c): the button with the number of filters that are on and the window they open (a sheet from the
 * bottom on a phone). The window works on a draft; «Mostra N case» says how many homes the draft leaves, and it follows the
 * choices as they are made (the server is asked after a short pause, so a slider is not a flood of calls, and the number is
 * announced to a screen reader). Nothing is applied until that button is pressed.
 */
export function FiltersSheet({ slug, state, catalog }: FiltersSheetProps) {
  const { t } = useTranslation();
  const portal = usePortalRootProps();
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(state.search.filters);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="sr-filter" data-testid="search-filters-open">
          <SlidersHorizontal aria-hidden="true" />
          <span>{t('siteSearch.filters.open')}</span>
          {count > 0 ? (
            <b className="sr-filter__n" aria-label={t('siteSearch.filters.active', { count })}>
              {count}
            </b>
          ) : null}
        </button>
      </DialogTrigger>
      <DialogContent {...portal} className={cn(portal.className, 'sr-filters sm:max-w-2xl')}>
        {open ? <FiltersForm slug={slug} state={state} catalog={catalog} onClose={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function FiltersForm({ slug, state, catalog, onClose }: FiltersSheetProps & { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const locale = siteLocale(i18n.language);
  const { stay, search, setSearch } = state;
  const hasDates = Boolean(stay.checkIn && stay.checkOut);
  const [draft, setDraft] = useState<SearchFilters>(search.filters);

  // How many homes the draft leaves: the same call as the list, with the draft in place of the filters.
  const settled = useDebouncedValue(draft, COUNT_DELAY_MS);
  const preview = useOrgStays(slug, toStaysQuery(stay, { ...search, filters: settled }), { keepPrevious: true });
  const unsupported = preview.data?.unsupportedFilters ?? [];
  const clean = dropUnsupported(draft, unsupported);
  const waiting = settled !== draft || preview.isFetching;
  const left = preview.data ? (hasDates ? preview.data.availableCount : preview.data.totalCount) : null;
  const button =
    left === null ? t('siteSearch.filters.show') : left > 0 ? t('siteSearch.filters.showCount', { count: left }) : t('siteSearch.filters.showNone');

  const prices = priceBounds(catalog);
  const areas = areaBounds(catalog);
  const update = (patch: Partial<SearchFilters>) => setDraft((current) => ({ ...current, ...patch }));
  const toggle = <T extends string>(list: T[], value: T): T[] => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  const euros = (value: number) => formatPrice(value * 100, 'EUR', locale);
  // The icon and the words of each service are the catalog of the site (the same as on the page of a home).
  // What the server could not apply is not offered.
  const amenityOptions = FILTER_AMENITIES.flatMap((name) => {
    const meta = listAmenities([name])[0];
    return meta && !isUnsupported(unsupported, 'amenities', name) ? [{ name, meta }] : [];
  });
  const ruleOptions = FILTER_RULES.filter((rule) => !isUnsupported(unsupported, 'rules', rule));

  const priceText =
    draft.minPrice && draft.maxPrice
      ? t('siteSearch.filters.priceBetween', { from: euros(draft.minPrice), to: euros(draft.maxPrice) })
      : draft.minPrice
        ? t('siteSearch.filters.priceFrom', { price: euros(draft.minPrice) })
        : draft.maxPrice
          ? t('siteSearch.filters.priceUpTo', { price: euros(draft.maxPrice) })
          : t('siteSearch.filters.any');

  return (
    <>
      <DialogHeader>
        <DialogTitle className="public-display text-xl">{t('siteSearch.filters.title')}</DialogTitle>
        <DialogDescription className="sr-only">{t('siteSearch.filters.description')}</DialogDescription>
      </DialogHeader>

      <form className="sr-ff" onSubmit={(event) => event.preventDefault()} noValidate data-testid="search-filters-form">
        {prices ? (
          <Group legend={t('siteSearch.filters.price')} output={priceText}>
            <RangeField
              label={t('siteSearch.filters.priceMin')}
              value={draft.minPrice ?? prices.min}
              min={prices.min}
              max={prices.max}
              step={PRICE_STEP}
              output={draft.minPrice ? euros(draft.minPrice) : t('siteSearch.filters.noMin')}
              onChange={(value) => update({ minPrice: value <= prices.min ? null : Math.min(value, draft.maxPrice ?? prices.max) })}
            />
            <RangeField
              label={t('siteSearch.filters.priceMax')}
              value={draft.maxPrice ?? prices.max}
              min={prices.min}
              max={prices.max}
              step={PRICE_STEP}
              output={draft.maxPrice ? euros(draft.maxPrice) : t('siteSearch.filters.noMax')}
              onChange={(value) => update({ maxPrice: value >= prices.max ? null : Math.max(value, draft.minPrice ?? prices.min) })}
            />
          </Group>
        ) : null}

        <div className="sr-ff__row">
          <Group legend={t('siteSearch.filters.bedrooms')}>
            <ChoiceChips
              name="bedrooms"
              value={draft.bedrooms}
              choices={ROOM_CHOICES}
              any={t('siteSearch.filters.any')}
              label={(n) => t('siteSearch.filters.orMore', { n })}
              onChange={(bedrooms) => update({ bedrooms })}
            />
          </Group>
          <Group legend={t('siteSearch.filters.bathrooms')}>
            <ChoiceChips
              name="bathrooms"
              value={draft.bathrooms}
              choices={BATH_CHOICES}
              any={t('siteSearch.filters.any')}
              label={(n) => t('siteSearch.filters.orMore', { n })}
              onChange={(bathrooms) => update({ bathrooms })}
            />
          </Group>
        </div>

        {areas ? (
          <Group legend={t('siteSearch.filters.area')} output={draft.minSqm ? t('siteSearch.filters.areaAtLeast', { n: draft.minSqm }) : t('siteSearch.filters.any')}>
            <RangeField
              label={t('siteSearch.filters.area')}
              hideLabel
              value={draft.minSqm ?? areas.min}
              min={areas.min}
              max={areas.max}
              step={AREA_STEP}
              output=""
              onChange={(value) => update({ minSqm: value <= areas.min ? null : value })}
            />
          </Group>
        ) : null}

        <Group legend={t('siteSearch.filters.amenities')}>
          <div className="sr-ff__chips">
            {amenityOptions.map(({ name, meta }) => {
              const Icon = meta.icon;
              return (
                <CheckChip key={name} checked={draft.amenities.includes(name)} onChange={() => update({ amenities: toggle(draft.amenities, name) })}>
                  <Icon aria-hidden="true" />
                  {meta.labelKey ? t(meta.labelKey) : meta.fallbackLabel}
                </CheckChip>
              );
            })}
          </div>
        </Group>

        <Group legend={t('siteSearch.filters.rules')}>
          <div className="sr-ff__chips">
            {ruleOptions.map((rule) => {
              const Icon = RULE_ICONS[rule];
              return (
                <CheckChip key={rule} checked={draft.rules.includes(rule)} onChange={() => update({ rules: toggle(draft.rules, rule) })}>
                  <Icon aria-hidden="true" />
                  {t(`siteSearch.filters.rule.${rule}`)}
                </CheckChip>
              );
            })}
          </div>
        </Group>
      </form>

      {/* The number the button says, for a screen reader, once it has settled. */}
      <p className="sr-only" role="status" aria-live="polite">
        {waiting ? '' : button}
      </p>
      <DialogFooter className="sr-filters__foot">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setDraft({ ...NO_FILTERS, tags: draft.tags })}
          disabled={activeFilterCount(draft) === 0}
          data-testid="search-filters-clear"
        >
          {t('siteSearch.filters.clear')}
        </Button>
        <Button
          type="button"
          className="public-site-cta border-0"
          aria-busy={waiting || undefined}
          onClick={() => {
            setSearch({ filters: clean });
            onClose();
          }}
          data-testid="search-filters-apply"
        >
          {button}
        </Button>
      </DialogFooter>
    </>
  );
}

/** A group of the form: a legend, the value it stands at on the right, and what it holds. */
function Group({ legend, output, children }: { legend: string; output?: string; children: ReactNode }) {
  return (
    <fieldset className="sr-fs">
      <legend className="sr-fs__t">
        <span>{legend}</span>
        {output ? <output className="sr-fs__o">{output}</output> : null}
      </legend>
      {children}
    </fieldset>
  );
}

function RangeField({
  label,
  hideLabel = false,
  value,
  min,
  max,
  step,
  output,
  onChange,
}: {
  label: string;
  hideLabel?: boolean;
  value: number;
  min: number;
  max: number;
  step: number;
  output: string;
  onChange: (value: number) => void;
}) {
  const id = `sr-range-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className="sr-range">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : undefined}>
        {label}
        {output ? <output>{output}</output> : null}
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}

function ChoiceChips({
  name,
  value,
  choices,
  any,
  label,
  onChange,
}: {
  name: string;
  value: number | null;
  choices: readonly number[];
  any: string;
  label: (n: number) => string;
  onChange: (value: number | null) => void;
}) {
  return (
    <div className="sr-ff__chips">
      {[null, ...choices].map((choice) => (
        <label key={choice ?? 'any'} className="sr-chipf">
          <input type="radio" className="sr-only" name={name} checked={value === choice} onChange={() => onChange(choice)} />
          {choice === null ? any : label(choice)}
        </label>
      ))}
    </div>
  );
}

function CheckChip({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <label className="sr-chipf">
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
      {children}
    </label>
  );
}
