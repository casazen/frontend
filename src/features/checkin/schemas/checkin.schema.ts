import { z } from 'zod';

export const publicCheckInFormSchema = z.object({
  firstName: z.string().min(1, 'checkin.validation.firstName.required').max(100),
  lastName: z.string().min(1, 'checkin.validation.lastName.required').max(100),
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
