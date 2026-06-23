import { z } from 'zod';

const partySchema = z.object({
  role: z.enum(['Landlord', 'Tenant']),
  firstName: z.string().min(1, 'leases.validation.firstName.required').max(100),
  lastName: z.string().min(1, 'leases.validation.lastName.required').max(100),
  fiscalCode: z
    .string()
    .min(11, 'leases.validation.fiscalCode.minLength')
    .max(16, 'leases.validation.fiscalCode.maxLength'),
  citizenship: z
    .string()
    .length(2, 'leases.validation.citizenship.length'),
  contactEmail: z.string().email('leases.validation.contactEmail.format'),
});

export const leaseFormSchema = z
  .object({
    propertyId: z.string().min(1, 'leases.validation.propertyId.required'),
    fiscalRegime: z.enum(['CedolareSecca', 'RegimeOrdinario', 'CanoneConcordato']),
    startDate: z.string().min(1, 'leases.validation.startDate.required'),
    endDate: z.string().min(1, 'leases.validation.endDate.required'),
    monthlyRent: z.number().positive('leases.validation.monthlyRent.positive'),
    landlord: partySchema,
    tenant: partySchema.extend({ role: z.literal('Tenant') }),
  })
  .refine((data) => new Date(data.endDate) > new Date(data.startDate), {
    message: 'leases.validation.endDate.afterStart',
    path: ['endDate'],
  });

export type LeaseFormValues = z.infer<typeof leaseFormSchema>;

/** @deprecated Use getFiscalRegimeLabel from @/lib/i18n-labels */
export const FISCAL_REGIME_I18N_KEYS: Record<LeaseFormValues['fiscalRegime'], string> = {
  CedolareSecca: 'leases.fiscalRegimeLabel.CedolareSecca',
  RegimeOrdinario: 'leases.fiscalRegimeLabel.RegimeOrdinario',
  CanoneConcordato: 'leases.fiscalRegimeLabel.CanoneConcordato',
};

export const LEASE_STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive' | 'success'> = {
  Draft: 'secondary',
  AwaitingSignature: 'outline',
  PartiallySigned: 'outline',
  Signed: 'default',
  RegistrationPending: 'outline',
  SentToProvider: 'outline',
  Registered: 'success',
  Rejected: 'destructive',
};

export const REGISTRATION_STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive' | 'success'> = {
  Pending: 'secondary',
  SentToProvider: 'outline',
  Registered: 'success',
  Failed: 'destructive',
};
