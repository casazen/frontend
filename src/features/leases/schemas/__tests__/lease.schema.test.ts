import { describe, it, expect } from 'vitest';
import { leaseFormSchema } from '../lease.schema';

const validForm = {
  propertyId: '11111111-1111-1111-1111-111111111111',
  contractType: 'Libero' as const,
  taxRegime: 'CedolareSecca' as const,
  startDate: '2026-09-01',
  endDate: '2030-08-31',
  monthlyRent: 1200,
  landlords: [{
    role: 'Landlord' as const,
    firstName: 'Mario',
    lastName: 'Rossi',
    fiscalCode: 'RSSMRA80A01H501U',
    citizenship: 'IT',
    contactEmail: 'mario@example.com',
  }],
  tenants: [{
    role: 'Tenant' as const,
    firstName: 'Luigi',
    lastName: 'Verdi',
    fiscalCode: 'VRDLGU85B02F205C',
    citizenship: 'IT',
    contactEmail: 'luigi@example.com',
  }],
};

/** Issues of a failed parse as `path: message`. */
function issues(value: unknown): string[] {
  const result = leaseFormSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
}

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

  // LT-14 (A7-28): co-owners and co-tenants, fiscal code with the official check.
  it('leaseFormSchema_TwoLandlordsAndACompanyTenant_IsValid', () => {
    const result = leaseFormSchema.safeParse({
      ...validForm,
      landlords: [...validForm.landlords, { ...validForm.landlords[0], fiscalCode: 'BNCNNA82A41F205W' }],
      tenants: [{ ...validForm.tenants[0], fiscalCode: '00123456782' }],
    });
    expect(result.success).toBe(true);
  });

  it('leaseFormSchema_FiscalCodeWithWrongCheckCharacter_ReportsInvalidOnThatParty', () => {
    expect(issues({ ...validForm, tenants: [{ ...validForm.tenants[0], fiscalCode: 'VRDLGU85B02F205X' }] })).toEqual([
      'tenants.0.fiscalCode: leases.validation.fiscalCode.invalid',
    ]);
  });

  it('leaseFormSchema_SameFiscalCodeTwice_ReportsDuplicateOnTheSecond', () => {
    expect(
      issues({ ...validForm, tenants: [{ ...validForm.tenants[0], fiscalCode: 'rssmra80a01h501u' }] }),
    ).toEqual(['tenants.0.fiscalCode: leases.validation.fiscalCode.duplicate']);
  });

  it('leaseFormSchema_NoLandlord_ReportsRequired', () => {
    expect(issues({ ...validForm, landlords: [] })).toEqual(['landlords: leases.validation.landlords.required']);
  });

  it('leaseFormSchema_ElevenTenants_ReportsMax', () => {
    const tenants = Array.from({ length: 11 }, () => validForm.tenants[0]);
    expect(issues({ ...validForm, tenants })).toContain('tenants: leases.validation.tenants.max');
  });
});
