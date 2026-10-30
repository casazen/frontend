import { describe, expect, it } from 'vitest';
import type { Property } from '@/types';
import type { ComplianceWizardStep } from '@/types/compliance.types';
import {
  NEW_PROPERTY_DEFAULTS,
  amenitiesUpdatePayload,
  baseUpdatePayload,
  pricesStepSchema,
  pricesUpdatePayload,
  resumeStepFor,
  rulesStepSchema,
  rulesUpdatePayload,
  wizardDefaults,
} from '../property-wizard-model';

const step = (id: string, open: boolean, blocker = true): ComplianceWizardStep => ({
  id,
  label: id,
  status: open ? 'pending' : 'complete',
  blocker,
});

const complete = { name: 'Casa', address: 'Via Roma 1', city: 'Como', maxGuests: 4 };

describe('resumeStepFor', () => {
  it('resumeStepFor_FirstOpenBlockerOfTheWizard_IsTheStepToReopen', () => {
    const steps = (open: string[]) => ['base-data', 'cin', 'documents', 'safety'].map((id) => step(id, open.includes(id)));

    // The server says what is open; the wizard only picks the first of ITS steps that has something open.
    expect(resumeStepFor({ ...complete, name: '' }, steps(['base-data']))).toBe('base');
    expect(resumeStepFor({ ...complete, maxGuests: 0 }, steps(['base-data']))).toBe('base');
    expect(resumeStepFor(complete, steps(['base-data']))).toBe('prices');
    expect(resumeStepFor(complete, steps(['safety']))).toBe('amenities');
    expect(resumeStepFor(complete, steps(['cin']))).toBe('finish');
    expect(resumeStepFor(complete, steps(['documents']))).toBe('finish');
    expect(resumeStepFor(complete, steps(['cin', 'safety']))).toBe('amenities');
    expect(resumeStepFor(complete, steps(['base-data', 'safety']))).toBe('amenities');
    expect(resumeStepFor({ ...complete, city: '' }, steps(['base-data', 'safety', 'cin']))).toBe('base');
    // Nothing open, or only advice that does not block: the last step, where the property is activated.
    expect(resumeStepFor(complete, steps([]))).toBe('finish');
    expect(resumeStepFor(complete, [step('tourist-tax', true, false), step('ical', true, false)])).toBe('finish');
  });
});

describe('what the steps save', () => {
  it('baseUpdatePayload_SavedAgain_NeverTouchesTheRateTheDescriptionOrTheAmenities', () => {
    // PATCH: the first step is saved every time it is gone through again; the price or the text written elsewhere must stay.
    const payload = baseUpdatePayload({ ...NEW_PROPERTY_DEFAULTS, name: 'Casa Lago', address: 'Via Roma 1', city: 'Como', areaSqm: '70' });

    expect(payload).not.toHaveProperty('nightlyRate');
    expect(payload).not.toHaveProperty('description');
    expect(payload).not.toHaveProperty('amenities');
    expect(payload.areaSqm).toBe(70);
  });

  it('amenitiesUpdatePayload_TheRulesDecideTwoAmenities_TheStepNeverTakesThemAway', () => {
    const stored = { amenities: ['WiFi', 'PetFriendly', 'SmokingAllowed', 'Garden'] };

    // The step shows the 21 amenities it asks about, saves the list as a whole and keeps the two that the house rules decide.
    expect(amenitiesUpdatePayload({ ...NEW_PROPERTY_DEFAULTS, amenities: ['WiFi', 'Pool'] }, stored).amenities).toEqual([
      'WiFi',
      'Pool',
      'PetFriendly',
      'SmokingAllowed',
    ]);
    const reopened = wizardDefaults({ ...stored, name: 'Casa', address: 'Via Roma 1', city: 'Como', postalCode: '', maxGuests: 2, bedrooms: 1, bathrooms: 1 } as Property);
    expect(reopened.amenities).toEqual(['WiFi', 'Garden']);
  });
});

describe('what the rules and prices steps save', () => {
  it('rulesUpdatePayload_BlankAnswers_ClearWhatTheApiClearsAndLeaveTheRestAlone', () => {
    const payload = rulesUpdatePayload({
      ...NEW_PROPERTY_DEFAULTS,
      checkInFrom: '',
      smokingPolicy: '',
      extraGuestFee: '',
      quietHoursFrom: '',
      quietHoursTo: '',
      cancellationPolicyId: '',
    });

    // PATCH: a blank fee or quiet hours is null (taken off); a blank time, rule or policy is left out (the stored one stays).
    expect(payload).toMatchObject({ extraGuestFeePerNight: null, quietHoursFrom: null, quietHoursTo: null });
    expect(payload).not.toHaveProperty('checkInFrom');
    expect(payload).not.toHaveProperty('smokingPolicy');
    expect(payload).not.toHaveProperty('cancellationPolicyId');
    // The policy the host chose, the fee written with a comma and the times are sent as they are meant.
    expect(
      rulesUpdatePayload({ ...NEW_PROPERTY_DEFAULTS, extraGuestFee: '12,50', quietHoursFrom: '22:00', quietHoursTo: '08:00', cancellationPolicyId: 'p1' }),
    ).toMatchObject({ extraGuestFeePerNight: 12.5, quietHoursFrom: '22:00', quietHoursTo: '08:00', cancellationPolicyId: 'p1', checkInFrom: '15:00' });
  });

  it('rulesStepSchema_OneQuietHourWithoutTheOther_IsRefusedOnThatField', () => {
    const answers = { ...NEW_PROPERTY_DEFAULTS };

    expect(rulesStepSchema.safeParse({ ...answers, quietHoursFrom: '22:00', quietHoursTo: '' }).error?.issues[0]?.path).toEqual(['quietHoursTo']);
    expect(rulesStepSchema.safeParse({ ...answers, quietHoursFrom: '', quietHoursTo: '08:00' }).error?.issues[0]?.path).toEqual(['quietHoursFrom']);
    expect(rulesStepSchema.safeParse({ ...answers, quietHoursFrom: '22:00', quietHoursTo: '08:00' }).success).toBe(true);
    expect(rulesStepSchema.safeParse(answers).success).toBe(true);
  });

  it('pricesUpdatePayload_BlankAnswers_TurnOffWhatTheApiTurnsOffAndKeepTheRate', () => {
    // A blank surcharge is 0 (leaving it out would keep an old one), one night is no minimum (null), a blank rate is left out.
    const blank = pricesUpdatePayload({ ...NEW_PROPERTY_DEFAULTS });
    expect(blank).toEqual({ weekendSurchargePercent: 0, cleaningFee: 0, minNights: null });

    expect(pricesUpdatePayload({ ...NEW_PROPERTY_DEFAULTS, nightlyRate: '135,5', weekendSurcharge: '15', cleaningFee: '50', minNights: 3 })).toEqual({
      nightlyRate: 135.5,
      weekendSurchargePercent: 15,
      cleaningFee: 50,
      minNights: 3,
    });
  });

  it('pricesStepSchema_AmountsOutsideTheLimitsOfTheApi_AreRefused', () => {
    const answers = { ...NEW_PROPERTY_DEFAULTS };

    expect(pricesStepSchema.safeParse(answers).success).toBe(true);
    expect(pricesStepSchema.safeParse({ ...answers, nightlyRate: '0' }).success).toBe(false);
    expect(pricesStepSchema.safeParse({ ...answers, nightlyRate: '100001' }).success).toBe(false);
    expect(pricesStepSchema.safeParse({ ...answers, weekendSurcharge: '101' }).success).toBe(false);
    expect(pricesStepSchema.safeParse({ ...answers, cleaningFee: '10001' }).success).toBe(false);
    expect(pricesStepSchema.safeParse({ ...answers, minNights: 31 }).success).toBe(false);
    expect(pricesStepSchema.safeParse({ ...answers, nightlyRate: '135,50', weekendSurcharge: '12.5', cleaningFee: '50', minNights: 30 }).success).toBe(true);
  });
});
