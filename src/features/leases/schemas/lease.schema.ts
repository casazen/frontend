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

export const FISCAL_REGIME_LABELS: Record<
  LeaseFormValues['fiscalRegime'],
  string
> = {
  CedolareSecca: 'Cedolare secca',
  RegimeOrdinario: 'Regime ordinario',
  CanoneConcordato: 'Canone concordato',
};

export const LEASE_STATUS_LABELS: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' | 'success' }
> = {
  Draft: { label: 'Draft', variant: 'secondary' },
  AwaitingSignature: { label: 'Awaiting signature', variant: 'outline' },
  PartiallySigned: { label: 'Partially signed', variant: 'outline' },
  Signed: { label: 'Signed', variant: 'default' },
  RegistrationPending: { label: 'Registration pending', variant: 'outline' },
  SentToProvider: { label: 'Sent to provider', variant: 'outline' },
  Registered: { label: 'Registered', variant: 'success' },
  Rejected: { label: 'Rejected', variant: 'destructive' },
};

export const REGISTRATION_STATUS_LABELS: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' | 'success' }
> = {
  Pending: { label: 'Pending', variant: 'secondary' },
  SentToProvider: { label: 'Sent to provider', variant: 'outline' },
  Registered: { label: 'Registered', variant: 'success' },
  Failed: { label: 'Failed', variant: 'destructive' },
};
