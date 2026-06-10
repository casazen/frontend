import { z } from 'zod';

export const guestCheckInFormSchema = z.object({
  dateOfBirth: z.string().min(1, 'Data di nascita obbligatoria'),
  placeOfBirth: z.string().min(1, 'Luogo di nascita obbligatorio').max(100),
  nationality: z.string().min(1, 'Nazionalità obbligatoria').max(100),
  gender: z.enum(['Male', 'Female', 'Other'], { message: 'Seleziona il sesso' }),
  documentType: z.enum(['Passport', 'IdentityCard', 'DriversLicense', 'Other'], {
    message: 'Seleziona il tipo di documento',
  }),
  documentNumber: z.string().min(1, 'Numero documento obbligatorio').max(50),
  documentExpiryDate: z.string().optional(),
  documentIssuingCountry: z.string().min(1, 'Paese di rilascio obbligatorio').max(100),
  address: z.string().max(500).optional(),
  city: z.string().max(50).optional(),
  postalCode: z.string().max(10).optional(),
  country: z.string().max(100).optional(),
  consentAccepted: z.boolean().refine((val) => val === true, {
    message: 'Devi accettare il trattamento dei dati',
  }),
});

export type GuestCheckInFormValues = z.infer<typeof guestCheckInFormSchema>;

export const DOCUMENT_TYPE_LABELS: Record<GuestCheckInFormValues['documentType'], string> = {
  Passport: 'Passaporto',
  IdentityCard: 'Carta d\'identità',
  DriversLicense: 'Patente di guida',
  Other: 'Altro',
};

export const GENDER_LABELS: Record<GuestCheckInFormValues['gender'], string> = {
  Male: 'Maschio',
  Female: 'Femmina',
  Other: 'Altro',
};
