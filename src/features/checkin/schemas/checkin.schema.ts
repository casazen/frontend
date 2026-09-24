import { z } from 'zod';
import type { AlloggiatiGender, PublicCheckInSubmitRequest } from '@/types/public-checkin.types';

/** Genders offered to the guest: the only ones Alloggiati Web accepts (1 = male, 2 = female). */
export const ALLOGGIATI_GENDERS = ['Male', 'Female'] as const satisfies readonly AlloggiatiGender[];

/**
 * `[Required]` properties of the API DTO `PublicCheckInSubmitRequest` (`Casazen.Web/DTOs/CheckIn/PublicCheckInDtos.cs`).
 * `satisfies` makes the build fail if the request type misses one; the backend test
 * `PublicCheckInSubmitContractTests` keeps the same list, so change both together.
 */
export const PUBLIC_CHECKIN_REQUIRED_FIELDS = [
  'dateOfBirth',
  'documentIssuingCountry',
  'documentNumber',
  'documentType',
  'firstName',
  'gdprConsent',
  'gender',
  'lastName',
  'nationality',
  'placeOfBirth',
] as const satisfies readonly (keyof PublicCheckInSubmitRequest)[];

export const publicCheckInFormSchema = z.object({
  firstName: z.string().min(1, 'checkin.validation.firstName.required').max(100),
  lastName: z.string().min(1, 'checkin.validation.lastName.required').max(100),
  gender: z.enum(ALLOGGIATI_GENDERS, { message: 'checkin.validation.gender.required' }),
  dateOfBirth: z.string().min(1, 'checkin.validation.dateOfBirth.required'),
  placeOfBirth: z.string().min(1, 'checkin.validation.placeOfBirth.required').max(100),
  nationality: z.string().min(1, 'checkin.validation.nationality.required').max(100),
  documentType: z.enum(['Passport', 'IdentityCard', 'DriversLicense', 'Other'], {
    message: 'checkin.validation.documentType.required',
  }),
  documentNumber: z.string().min(1, 'checkin.validation.documentNumber.required').max(50),
  documentIssuingCountry: z.string().min(1, 'checkin.validation.documentIssuingCountry.required').max(100),
  gdprConsent: z.boolean().refine((val) => val === true, {
    message: 'checkin.validation.consentAccepted.required',
  }),
  marketingConsent: z.boolean().optional(),
});

export type PublicCheckInFormValues = z.infer<typeof publicCheckInFormSchema>;

/** Request body sent by the guest portal for valid form values. */
export function toPublicCheckInSubmitRequest(values: PublicCheckInFormValues): PublicCheckInSubmitRequest {
  return {
    firstName: values.firstName,
    lastName: values.lastName,
    dateOfBirth: values.dateOfBirth,
    placeOfBirth: values.placeOfBirth,
    nationality: values.nationality,
    gender: values.gender,
    documentType: values.documentType,
    documentNumber: values.documentNumber,
    documentIssuingCountry: values.documentIssuingCountry,
    gdprConsent: values.gdprConsent,
    marketingConsent: values.marketingConsent ?? false,
  };
}

export const guestCheckInFormSchema = z.object({
  dateOfBirth: z.string().min(1, 'checkin.validation.dateOfBirth.required'),
  placeOfBirth: z.string().min(1, 'checkin.validation.placeOfBirth.required').max(100),
  nationality: z.string().min(1, 'checkin.validation.nationality.required').max(100),
  gender: z.enum(['Male', 'Female', 'Other'], { message: 'checkin.validation.gender.required' }),
  documentType: z.enum(['Passport', 'IdentityCard', 'DriversLicense', 'Other'], {
    message: 'checkin.validation.documentType.required',
  }),
  documentNumber: z.string().min(1, 'checkin.validation.documentNumber.required').max(50),
  documentExpiryDate: z.string().optional(),
  documentIssuingCountry: z.string().min(1, 'checkin.validation.documentIssuingCountry.required').max(100),
  address: z.string().max(500).optional(),
  city: z.string().max(50).optional(),
  postalCode: z.string().max(10).optional(),
  country: z.string().max(100).optional(),
  consentAccepted: z.boolean().refine((val) => val === true, {
    message: 'checkin.validation.consentAccepted.required',
  }),
});

export type GuestCheckInFormValues = z.infer<typeof guestCheckInFormSchema>;
