import { describe, expect, it } from 'vitest';
import type { Property } from '@/types';
import type { ComplianceWizardStep } from '@/types/compliance.types';
import { NEW_PROPERTY_DEFAULTS, amenitiesUpdatePayload, baseUpdatePayload, resumeStepFor, wizardDefaults } from '../property-wizard-model';

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
