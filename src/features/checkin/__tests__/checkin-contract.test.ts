import { describe, it, expect } from 'vitest';
import sample from './fixtures/public-checkin-submit.sample.json';
import {
  ALLOGGIATI_GENDERS,
  PUBLIC_CHECKIN_REQUIRED_FIELDS,
  publicCheckInFormSchema,
  toPublicCheckInSubmitRequest,
} from '../schemas/checkin.schema';

/**
 * Contract with the API DTO `PublicCheckInSubmitRequest` (A5-04: the API required `gender` and the form never sent it).
 * The fixture is identical to the backend `Casazen.Tests/Fixtures/public-checkin-submit.frontend.json`, which the
 * backend deserializes and validates; `BACKEND_REQUIRED_FIELDS` mirrors the `[Required]` list checked there.
 */
const BACKEND_REQUIRED_FIELDS = [
  'dateOfBirth',
  'documentIssuingCountry',
  'documentNumber',
  'documentType',
  'firstName',
  'gdprConsent',
  'gender',
  'lastName',
  'nationality',
  'placeOfBirth',
];

function isFilled(value: unknown): boolean {
  if (typeof value === 'string') return value.trim() !== '';
  return value !== undefined && value !== null;
}

describe('public check-in request contract', () => {
  it('requiredFields_matchBackendRequiredProperties', () => {
    expect([...PUBLIC_CHECKIN_REQUIRED_FIELDS].sort()).toEqual([...BACKEND_REQUIRED_FIELDS].sort());
  });

  it('toPublicCheckInSubmitRequest_validForm_producesBackendSampleWithEveryRequiredField', () => {
    const values = publicCheckInFormSchema.parse({
      firstName: 'Giulia',
      lastName: 'Bianchi',
      gender: 'Female',
      dateOfBirth: '1992-03-08',
      placeOfBirth: 'Firenze',
      nationality: 'Italiana',
      documentType: 'IdentityCard',
      documentNumber: 'CA12345AB',
      documentIssuingCountry: 'Italia',
      gdprConsent: true,
    });

    const payload: Record<string, unknown> = JSON.parse(JSON.stringify(toPublicCheckInSubmitRequest(values)));

    expect(payload).toEqual(sample);
    const missing = BACKEND_REQUIRED_FIELDS.filter((field) => !isFilled(payload[field]));
    expect(missing).toEqual([]);
  });

  it('genderOptions_onlyAlloggiatiValuesAcceptedByBackend', () => {
    expect([...ALLOGGIATI_GENDERS]).toEqual(['Male', 'Female']);
    expect(publicCheckInFormSchema.shape.gender.safeParse('Other').success).toBe(false);
  });
});
