import { describe, it, expect } from 'vitest';
import { leaseFormSchema } from '../lease.schema';

const validForm = {
  propertyId: '11111111-1111-1111-1111-111111111111',
  fiscalRegime: 'CedolareSecca' as const,
  startDate: '2026-09-01',
  endDate: '2030-08-31',
  monthlyRent: 1200,
  landlord: {
    role: 'Landlord' as const,
    firstName: 'Mario',
    lastName: 'Rossi',
    fiscalCode: 'RSSMRA80A01H501U',
    citizenship: 'IT',
    contactEmail: 'mario@example.com',
  },
  tenant: {
    role: 'Tenant' as const,
    firstName: 'Luigi',
    lastName: 'Verdi',
    fiscalCode: 'VRDLGU85B02F205X',
    citizenship: 'IT',
    contactEmail: 'luigi@example.com',
  },
};

describe('leaseFormSchema', () => {
  it('accepts valid lease form data', () => {
    expect(leaseFormSchema.safeParse(validForm).success).toBe(true);
  });

  it('rejects end date before start date', () => {
    const result = leaseFormSchema.safeParse({
      ...validForm,
      startDate: '2026-09-01',
      endDate: '2026-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-positive monthly rent', () => {
    const result = leaseFormSchema.safeParse({ ...validForm, monthlyRent: 0 });
    expect(result.success).toBe(false);
  });
});
