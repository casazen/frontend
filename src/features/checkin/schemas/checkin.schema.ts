import { z } from 'zod';

export const guestCheckInFormSchema = z.object({
  dateOfBirth: z.string().min(1, 'checkin.validation.dateOfBirth.required'),
  placeOfBirth: z.string().min(1, 'checkin.validation.placeOfBirth.required').max(100, 'checkin.validation.placeOfBirth.maxLength'),
  nationality: z.string().min(1, 'checkin.validation.nationality.required').max(100, 'checkin.validation.nationality.maxLength'),
  gender: z.enum(['Male', 'Female', 'Other'], { message: 'checkin.validation.gender.required' }),
  documentType: z.enum(['Passport', 'IdentityCard', 'DriversLicense', 'Other'], {
    message: 'checkin.validation.documentType.required',
  }),
  documentNumber: z.string().min(1, 'checkin.validation.documentNumber.required').max(50, 'checkin.validation.documentNumber.maxLength'),
  documentExpiryDate: z.string().optional(),
  documentIssuingCountry: z.string().min(1, 'checkin.validation.documentIssuingCountry.required').max(100, 'checkin.validation.documentIssuingCountry.maxLength'),
  address: z.string().max(500).optional(),
  city: z.string().max(50).optional(),
  postalCode: z.string().max(10).optional(),
  country: z.string().max(100).optional(),
  consentAccepted: z.boolean().refine((val) => val === true, {
    message: 'checkin.validation.consentAccepted.required',
  }),
});

export type GuestCheckInFormValues = z.infer<typeof guestCheckInFormSchema>;

// Document type and gender labels are now resolved via getDocumentTypeLabel() / getGenderLabel()
// from @/lib/i18n-labels. See checkin.documentType.{key} and checkin.gender.{key} in locale JSONs.
