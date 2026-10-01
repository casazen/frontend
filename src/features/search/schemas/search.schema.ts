import { z } from 'zod';

/**
 * Filters of the public search (BK-20, A8-13). Every field is optional; an empty input is "no filter", never `NaN`
 * (`valueAsNumber` turned an empty number input into `NaN`, which the old schema rejected, so "Cerca" did nothing until
 * every field was filled). The form converts its inputs with `parseOptionalNumber` and this schema checks the result.
 * Messages are i18n keys, translated by `FormFieldError`. Limits mirror the backend (`PropertiesController.Search`,
 * which answers 400 outside them).
 */
export const SEARCH_LIMITS = {
  cityMaxLength: 100,
  priceMax: 1_000_000,
  roomsMax: 50,
  guestsMin: 1,
  guestsMax: 100,
} as const;

/** The value of a number input as a form value: empty (or blank) is `undefined`, anything else is `Number(...)`. */
export function parseOptionalNumber(value: unknown): number | undefined {
  if (value === '' || value === null || value === undefined) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return Number(value);
}

const price = () =>
  z
    .number({ error: 'search.errors.invalidNumber' })
    .min(0, 'search.errors.negative')
    .max(SEARCH_LIMITS.priceMax, 'search.errors.tooHigh')
    .optional();

const rooms = () =>
  z
    .number({ error: 'search.errors.invalidNumber' })
    .int('search.errors.wholeNumber')
    .min(0, 'search.errors.negative')
    .max(SEARCH_LIMITS.roomsMax, 'search.errors.tooHigh')
    .optional();

export const searchFiltersSchema = z
  .object({
    city: z.string().trim().max(SEARCH_LIMITS.cityMaxLength, 'search.errors.cityTooLong').optional(),
    minPrice: price(),
    maxPrice: price(),
    minBedrooms: rooms(),
    minBathrooms: rooms(),
    guests: z
      .number({ error: 'search.errors.invalidNumber' })
      .int('search.errors.wholeNumber')
      .min(SEARCH_LIMITS.guestsMin, 'search.errors.guestsMin')
      .max(SEARCH_LIMITS.guestsMax, 'search.errors.tooHigh')
      .optional(),
  })
  .refine(
    (filters) => filters.minPrice === undefined || filters.maxPrice === undefined || filters.minPrice <= filters.maxPrice,
    { path: ['maxPrice'], message: 'search.errors.priceRange' },
  );

export type SearchFiltersFormValues = z.infer<typeof searchFiltersSchema>;
