import { z } from 'zod';

const partySchema = z.object({
  role: z.enum(['Landlord', 'Tenant']),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  fiscalCode: z
    .string()
    .min(11, 'Fiscal code must be at least 11 characters')
    .max(16, 'Fiscal code must be at most 16 characters'),
  citizenship: z
    .string()
    .length(2, 'Use ISO 3166-1 alpha-2 country code (e.g. IT)'),
  contactEmail: z.string().email('Valid email is required'),
});

export const leaseFormSchema = z
  .object({
    propertyId: z.string().min(1, 'Property is required'),
    fiscalRegime: z.enum(['CedolareSecca', 'RegimeOrdinario', 'CanoneConcordato']),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    monthlyRent: z.number().positive('Monthly rent must be greater than zero'),
    landlord: partySchema,
    tenant: partySchema.extend({ role: z.literal('Tenant') }),
  })
  .refine((data) => new Date(data.endDate) > new Date(data.startDate), {
    message: 'End date must be after start date',
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
