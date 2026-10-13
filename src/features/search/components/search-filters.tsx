import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormFieldError } from '@/components/shared/form-field-error';
import { SEARCH_LIMITS, parseOptionalNumber, searchFiltersSchema, type SearchFiltersFormValues } from '../schemas/search.schema';

interface SearchFiltersProps {
  /** The filters in force (from the page URL, memoized): the form shows them and follows them when they change. */
  values: SearchFiltersFormValues;
  onSearch: (filters: SearchFiltersFormValues) => void;
  onReset: () => void;
}

type NumberField = 'minPrice' | 'maxPrice' | 'minBedrooms' | 'minBathrooms' | 'guests';
type Field = 'city' | NumberField;

/** What the inputs hold: text as typed. An empty text is "no filter", never a number. */
type FormState = Record<Field, string>;

/** The number inputs: label key, placeholder (a hint, not a value), step and bounds. */
const NUMBER_FIELDS: { name: NumberField; labelKey: string; placeholder: string; step?: string; min: number; max: number }[] = [
  { name: 'minPrice', labelKey: 'search.filters.minPrice', placeholder: '0', step: 'any', min: 0, max: SEARCH_LIMITS.priceMax },
  { name: 'maxPrice', labelKey: 'search.filters.maxPrice', placeholder: '1000', step: 'any', min: 0, max: SEARCH_LIMITS.priceMax },
  { name: 'minBedrooms', labelKey: 'search.filters.minBedrooms', placeholder: '1', min: 0, max: SEARCH_LIMITS.roomsMax },
  { name: 'minBathrooms', labelKey: 'search.filters.minBathrooms', placeholder: '1', min: 0, max: SEARCH_LIMITS.roomsMax },
  { name: 'guests', labelKey: 'search.filters.guests', placeholder: '2', min: SEARCH_LIMITS.guestsMin, max: SEARCH_LIMITS.guestsMax },
];

function toFormState(values: SearchFiltersFormValues): FormState {
  const text = (value: number | undefined) => (value === undefined ? '' : String(value));
  return {
    city: values.city ?? '',
    minPrice: text(values.minPrice),
    maxPrice: text(values.maxPrice),
    minBedrooms: text(values.minBedrooms),
    minBathrooms: text(values.minBathrooms),
    guests: text(values.guests),
  };
}

/**
 * Filters of the public search (BK-20, A8-13). An empty field is "no filter"; every field that is filled in is checked
 * and its error shown, so "Cerca" never does nothing silently.
 */
export function SearchFilters({ values, onSearch, onReset }: SearchFiltersProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(() => toFormState(values));
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  // The URL is the source of truth: when the filters change (back button, shared link, reset) the form follows them.
  const [synced, setSynced] = useState(values);
  if (values !== synced) {
    setSynced(values);
    setForm(toFormState(values));
    setErrors({});
  }

  const setField = (name: Field, value: string) => setForm((current) => ({ ...current, [name]: value }));

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = searchFiltersSchema.safeParse({
      city: form.city,
      minPrice: parseOptionalNumber(form.minPrice),
      maxPrice: parseOptionalNumber(form.maxPrice),
      minBedrooms: parseOptionalNumber(form.minBedrooms),
      minBathrooms: parseOptionalNumber(form.minBathrooms),
      guests: parseOptionalNumber(form.guests),
    });
    if (!result.success) {
      // Every wrong field gets its message, not only the first one found.
      const next: Partial<Record<Field, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as Field;
        if (!next[field]) next[field] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    onSearch(result.data);
  };

  const handleReset = () => {
    setForm(toFormState({}));
    setErrors({});
    onReset();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" aria-hidden />
          {t('search.filters.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate data-testid="search-filters-form">
          <div className="space-y-2">
            <Label htmlFor="city">{t('search.filters.city')}</Label>
            <Input
              id="city"
              value={form.city}
              maxLength={SEARCH_LIMITS.cityMaxLength}
              onChange={(e) => setField('city', e.target.value)}
              placeholder={t('search.filters.cityPlaceholder')}
              aria-invalid={errors.city ? true : undefined}
            />
            <FormFieldError message={errors.city} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {NUMBER_FIELDS.map(({ name, labelKey, placeholder, step, min, max }) => (
              <div key={name} className="space-y-2">
                <Label htmlFor={name}>{t(labelKey)}</Label>
                <Input
                  id={name}
                  type="number"
                  inputMode={step ? 'decimal' : 'numeric'}
                  min={min}
                  max={max}
                  step={step}
                  value={form[name]}
                  onChange={(e) => setField(name, e.target.value)}
                  placeholder={placeholder}
                  aria-invalid={errors[name] ? true : undefined}
                />
                <FormFieldError message={errors[name]} />
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" data-testid="search-submit">
              <Search className="mr-2 h-4 w-4" aria-hidden />
              {t('search.filters.search')}
            </Button>
            <Button type="button" variant="outline" onClick={handleReset} data-testid="search-reset">
              <X className="mr-2 h-4 w-4" aria-hidden />
              {t('search.filters.reset')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
