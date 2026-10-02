import { z } from 'zod';
import { LEASE_CONTRACT_TYPES, LEASE_TAX_REGIMES, type LeaseStatus } from '@/types';
import type { RliRegistrationState } from '@/lib/rli-registration-state';
import { isValidFiscalCode, normalizeFiscalCode } from '@/lib/fiscal-code';

/** At most this many landlords, and as many tenants, per lease (same limit as the API, LT-14). */
export const MAX_PARTIES_PER_ROLE = 10;

const partySchema = z.object({
  role: z.enum(['Landlord', 'Tenant']),
  firstName: z.string().min(1, 'leases.validation.firstName.required').max(100),
  lastName: z.string().min(1, 'leases.validation.lastName.required').max(100),
  // LT-14 (A7-28): 16 characters with the check character (natural person) or 11 digits (company), lib/fiscal-code.
  fiscalCode: z
    .string()
    .min(1, 'leases.validation.fiscalCode.required')
    .refine((value) => value.length === 0 || isValidFiscalCode(value), {
      message: 'leases.validation.fiscalCode.invalid',
    }),
  // ISO 3166-1 alpha-2: the API compares it with the 27 EU member states for the Questura communication (LT-07).
  citizenship: z
    .string()
    .length(2, 'leases.validation.citizenship.length')
    .regex(/^[A-Za-z]{2}$/, 'leases.validation.citizenship.format'),
  contactEmail: z.string().email('leases.validation.contactEmail.format'),
});

export type LeasePartyFormValues = z.infer<typeof partySchema>;

const partiesSchema = (requiredKey: string, maxKey: string) =>
  z.array(partySchema).min(1, requiredKey).max(MAX_PARTIES_PER_ROLE, maxKey);

export const leaseFormSchema = z
  .object({
    propertyId: z.string().min(1, 'leases.validation.propertyId.required'),
    // LT-10 (A7-13): contract type and tax regime are separate; the term rules of each type are checked by the API.
    contractType: z.enum(LEASE_CONTRACT_TYPES),
    taxRegime: z.enum(LEASE_TAX_REGIMES),
    startDate: z.string().min(1, 'leases.validation.startDate.required'),
    endDate: z.string().min(1, 'leases.validation.endDate.required'),
    monthlyRent: z.number().positive('leases.validation.monthlyRent.positive'),
    securityDeposit: z.number().min(0, 'leases.validation.securityDeposit.min').optional(),
    // LT-14 (A7-28): co-owners and co-tenants (e.g. spouses) are all parties of the contract and of the RLI.
    landlords: partiesSchema('leases.validation.landlords.required', 'leases.validation.landlords.max'),
    tenants: partiesSchema('leases.validation.tenants.required', 'leases.validation.tenants.max'),
  })
  .refine((data) => new Date(data.endDate) > new Date(data.startDate), {
    message: 'leases.validation.endDate.afterStart',
    path: ['endDate'],
  })
  .superRefine((data, ctx) => {
    // The same person cannot be two parties of the lease (the API refuses it too).
    const seen = new Set<string>();
    const check = (list: 'landlords' | 'tenants') =>
      data[list].forEach((party, index) => {
        const code = normalizeFiscalCode(party.fiscalCode);
        if (!code || !isValidFiscalCode(code)) return;
        if (seen.has(code)) {
          ctx.addIssue({ code: 'custom', message: 'leases.validation.fiscalCode.duplicate', path: [list, index, 'fiscalCode'] });
        }
        seen.add(code);
      });
    check('landlords');
    check('tenants');
  });

export type LeaseFormValues = z.infer<typeof leaseFormSchema>;

export const LEASE_STATUS_VARIANTS: Record<LeaseStatus, 'default' | 'secondary' | 'outline' | 'destructive' | 'success'> = {
  Draft: 'secondary',
  AwaitingSignature: 'outline',
  PartiallySigned: 'outline',
  Signed: 'default',
  RegistrationPending: 'outline',
  SentToProvider: 'outline',
  Registered: 'success',
  Rejected: 'destructive',
};

/** Badge of the RLI registration state (LT-01): only "registered" is green. */
export const RLI_REGISTRATION_STATE_VARIANTS: Record<RliRegistrationState, 'default' | 'secondary' | 'outline' | 'destructive' | 'success'> = {
  notSigned: 'secondary',
  toRegister: 'outline',
  inProgress: 'outline',
  registered: 'success',
  failed: 'destructive',
};
