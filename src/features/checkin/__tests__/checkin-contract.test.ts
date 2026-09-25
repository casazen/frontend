import { describe, it, expect } from 'vitest';
import sample from './fixtures/public-checkin-submit.sample.json';
import {
  ALLOGGIATI_GENDERS,
  PUBLIC_CHECKIN_REQUIRED_FIELDS,
  STAY_GUEST_REQUIRED_FIELDS,
  publicCheckInFormSchema,
  stayGuestDefaults,
  toPublicCheckInSubmitRequest,
} from '../schemas/checkin.schema';

/**
 * Contract with the API DTOs `PublicCheckInSubmitRequest` and `StayGuestSubmitDto` (A5-04: the API required `gender`
 * and the form never sent it; CO-12: one entry per guest of the stay). The fixture is identical to the backend
 * `Casazen.Tests/Fixtures/public-checkin-submit.frontend.json`, which the backend deserializes and validates;
 * the two lists below mirror the `[Required]` properties checked there.
 */
const BACKEND_REQUIRED_FIELDS = ['guests'];
const BACKEND_REQUIRED_GUEST_FIELDS = ['bornInItaly', 'citizenshipName', 'dateOfBirth', 'firstName', 'gender', 'lastName', 'type'];

function isFilled(value: unknown): boolean {
  if (typeof value === 'string') return value.trim() !== '';
  return value !== undefined && value !== null;
}

describe('public check-in request contract', () => {
  it('requiredFields_matchBackendRequiredProperties', () => {
    expect([...PUBLIC_CHECKIN_REQUIRED_FIELDS].sort()).toEqual([...BACKEND_REQUIRED_FIELDS].sort());
    expect([...STAY_GUEST_REQUIRED_FIELDS].sort()).toEqual([...BACKEND_REQUIRED_GUEST_FIELDS].sort());
  });

  it('toPublicCheckInSubmitRequest_validFamilyForm_producesBackendSampleWithEveryRequiredField', () => {
    const values = publicCheckInFormSchema.parse({
      guests: [
        {
          ...stayGuestDefaults('HeadOfFamily'),
          firstName: 'Giulia',
          lastName: 'Bianchi',
          gender: 'Female',
          dateOfBirth: '1992-03-08',
          bornInItaly: 'yes',
          birthComuneName: 'Firenze',
          birthProvince: 'fi',
          citizenshipName: 'Italia',
          documentType: 'IdentityCard',
          documentNumber: 'ca 12345 ab',
          documentIssuePlaceName: 'Firenze',
        },
        {
          ...stayGuestDefaults('FamilyMember'),
          firstName: 'Marco',
          lastName: 'Bianchi',
          gender: 'Male',
          dateOfBirth: '2018-07-21',
          bornInItaly: 'no',
          birthCountryName: 'Francia',
          citizenshipName: 'Italia',
          // Typed by mistake for a family member: never sent, members have no document in the record.
          documentNumber: 'XX999',
        },
      ],
    });

    const payload: Record<string, unknown> = JSON.parse(JSON.stringify(toPublicCheckInSubmitRequest(values)));

    expect(payload).toEqual(sample);
    expect(BACKEND_REQUIRED_FIELDS.filter((field) => !isFilled(payload[field]))).toEqual([]);
    for (const guest of payload.guests as Record<string, unknown>[]) {
      expect(BACKEND_REQUIRED_GUEST_FIELDS.filter((field) => !isFilled(guest[field]))).toEqual([]);
    }
  });

  it('genderOptions_onlyAlloggiatiValuesAcceptedByBackend', () => {
    expect([...ALLOGGIATI_GENDERS]).toEqual(['Male', 'Female']);
    const other = publicCheckInFormSchema.safeParse({
      guests: [{ ...stayGuestDefaults('SingleGuest'), gender: 'Other' }],
    });
    expect(other.success).toBe(false);
    expect(other.error?.issues.some((issue) => issue.path.join('.') === 'guests.0.gender')).toBe(true);
  });
});
