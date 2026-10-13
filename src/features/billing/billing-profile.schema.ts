import { z } from 'zod';
import { isIsoCountryCode } from '@/lib/countries';
import { isVatIdShapeValid, normalizeVatId } from './billing-utils';
import type { BillingProfileRequest } from '@/types';

/** Country and optional VAT id of the billing profile. Messages are i18n keys translated by FormFieldError. */
export const billingProfileSchema = z.object({
  billingCountry: z.string().refine((value): boolean => isIsoCountryCode(value), 'billing.profile.validation.countryRequired'),
  vatId: z
    .string()
    .trim()
    .refine((value) => value === '' || isVatIdShapeValid(value), 'billing.profile.validation.vatIdInvalid'),
});

export type BillingProfileValues = z.infer<typeof billingProfileSchema>;

/** Values as sent to the API: VAT id normalized, omitted when empty. */
export function toBillingProfileRequest(values: BillingProfileValues): BillingProfileRequest {
  const vatId = normalizeVatId(values.vatId);
  return { billingCountry: values.billingCountry, ...(vatId ? { vatId } : {}) };
}
