import { describe, expect, it } from 'vitest';
import type { Property } from '@/types';
import type { ComplianceWizardStep } from '@/types/compliance.types';
import {
  NEW_PROPERTY_DEFAULTS,
  WIZARD_STEP_IDS,
  amenitiesUpdatePayload,
  adoptableFieldsOf,
  baseUpdatePayload,
  descriptionsLengthsSchema,
  descriptionsStepSchema,
  descriptionsUpdatePayload,
  photosStepSchema,
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
    // The catalog decides what can be chosen, not a list of the wizard: an amenity the property has that the step does not show is kept.
    const exotic = wizardDefaults({ ...stored, amenities: ['WiFi', 'Sauna', 'SomethingNew'], name: 'Casa', address: 'Via Roma 1', city: 'Como', postalCode: '', maxGuests: 2, bedrooms: 1, bathrooms: 1 } as Property);
    expect(exotic.amenities).toEqual(['WiFi', 'Sauna', 'SomethingNew']);
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

const PROPERTY = { name: 'Casa', address: 'Via Roma 1', city: 'Como', postalCode: '', maxGuests: 2, bedrooms: 1, bathrooms: 1, amenities: [] } as unknown as Property;

describe('the steps of the wizard (NF-31, NF-37)', () => {
  it('stepIds_DescriptionsAfterTheAmenities_ChannelsBeforeTheLastStep', () => {
    expect(WIZARD_STEP_IDS).toEqual(['base', 'photos', 'amenities', 'descriptions', 'rules', 'prices', 'channels', 'finish']);
  });

  it('descriptionsStepSchema_ItalianAndEnglishTitleAndDescription_AreAllRequiredAndEachIsNamed', () => {
    const answers = { ...NEW_PROPERTY_DEFAULTS };

    const refused = descriptionsStepSchema.safeParse(answers);
    expect(refused.success).toBe(false);
    expect(refused.error?.issues.map((issue) => issue.message).sort()).toEqual([
      'propertyWizard.validation.descriptions.enDescription',
      'propertyWizard.validation.descriptions.enTitle',
      'propertyWizard.validation.descriptions.itDescription',
      'propertyWizard.validation.descriptions.itTitle',
    ]);

    const filled = {
      ...answers,
      listingTitle: 'Trullo con piscina',
      description: 'Un trullo tranquillo.',
      texts: { ...answers.texts, en: { title: 'Trullo with pool', description: 'A quiet trullo.' } },
    };
    expect(descriptionsStepSchema.safeParse(filled).success).toBe(true);
    // Other languages are optional, with the same limits.
    expect(descriptionsStepSchema.safeParse({ ...filled, texts: { ...filled.texts, fr: { title: '', description: '' } } }).success).toBe(true);
    expect(descriptionsStepSchema.safeParse({ ...filled, texts: { ...filled.texts, fr: { title: 'x'.repeat(61), description: '' } } }).success).toBe(false);
  });

  it('descriptionsLengthsSchema_WhereTheChannelManagerIsOff_EmptyTextsAreFine_OnlyTheLengthsAreChecked', () => {
    // The whole schema of the step without the channel manager: the texts of the listing are optional, as they always were.
    expect(descriptionsLengthsSchema.safeParse({ ...NEW_PROPERTY_DEFAULTS }).success).toBe(true);
    expect(descriptionsLengthsSchema.safeParse({ ...NEW_PROPERTY_DEFAULTS, listingTitle: 'x'.repeat(61) }).success).toBe(false);
    expect(descriptionsLengthsSchema.safeParse({ ...NEW_PROPERTY_DEFAULTS, description: 'x'.repeat(2001) }).success).toBe(false);
    expect(
      descriptionsLengthsSchema.safeParse({ ...NEW_PROPERTY_DEFAULTS, texts: { ...NEW_PROPERTY_DEFAULTS.texts, fr: { title: 'x'.repeat(61), description: '' } } }).success,
    ).toBe(false);
  });

  it('adoptableFieldsOf_TheFieldsTheChannelsVersionRewrites_AsTheServerHoldsThem', () => {
    const property = { listingTitle: null, description: 'Testo del canale', houseRules: 'Regole del canale' };
    const profile = { translations: { en: { title: 'Pool trullo', description: 'Text of the channel' } } } as never;

    expect(adoptableFieldsOf(property, profile)).toMatchObject({
      listingTitle: '',
      description: 'Testo del canale',
      houseRules: 'Regole del canale',
      texts: { en: { title: 'Pool trullo', description: 'Text of the channel' }, fr: { title: '', description: '' } },
    });
    // The wizard opens on the same fields.
    expect(wizardDefaults({ ...complete, amenities: [], bedrooms: 1, bathrooms: 1, ...property } as unknown as Property, { rooms: [], stayDiscounts: [], photoMeta: [], siteProfile: profile })).toMatchObject(
      adoptableFieldsOf(property, profile),
    );
  });

  it('descriptionsStepSchema_OnlySpacesAreNotAText', () => {
    const answers = { ...NEW_PROPERTY_DEFAULTS, listingTitle: '   ', description: ' ', texts: { ...NEW_PROPERTY_DEFAULTS.texts, en: { title: ' ', description: ' ' } } };

    expect(descriptionsStepSchema.safeParse(answers).error?.issues).toHaveLength(4);
  });

  it('descriptionsUpdatePayload_TheItalianTextsGoToTheColumnsOfTheProperty', () => {
    expect(descriptionsUpdatePayload({ ...NEW_PROPERTY_DEFAULTS, listingTitle: ' Trullo con piscina ', description: ' Un trullo. ' })).toEqual({
      listingTitle: 'Trullo con piscina',
      description: 'Un trullo.',
    });
  });

  it('photosStepSchema_AnEnglishCaptionWithoutTheItalianOne_IsRefusedOnTheItalianField', () => {
    const photo = { url: 'https://cdn/a.jpg', altIt: '', altEn: 'Living room', roomId: '' };

    const refused = photosStepSchema.safeParse({ photoMeta: [photo] });
    expect(refused.success).toBe(false);
    expect(refused.error?.issues[0]).toMatchObject({ path: ['photoMeta', 0, 'altIt'], message: 'propertyWizard.validation.photos.italianRequired' });
    expect(photosStepSchema.safeParse({ photoMeta: [{ ...photo, altIt: 'Soggiorno' }] }).success).toBe(true);
    expect(photosStepSchema.safeParse({ photoMeta: [] }).success).toBe(true);
    expect(photosStepSchema.safeParse({ photoMeta: [{ ...photo, altIt: 'x'.repeat(201) }] }).success).toBe(false);
  });

  it('rulesUpdatePayload_TheChildrenRuleGoesWithTheOtherStructuredRules', () => {
    expect(rulesUpdatePayload({ ...NEW_PROPERTY_DEFAULTS, childrenPolicy: 'OnRequest' })).toMatchObject({ childrenPolicy: 'OnRequest', petsPolicy: 'No' });
    // A blank answer is left out (the stored rule stays), like the other policies.
    expect(rulesUpdatePayload({ ...NEW_PROPERTY_DEFAULTS, childrenPolicy: '' })).not.toHaveProperty('childrenPolicy');
    expect(rulesStepSchema.safeParse({ ...NEW_PROPERTY_DEFAULTS, childrenPolicy: 'Sometimes' }).success).toBe(false);
  });

  it('wizardDefaults_ChildrenRule_IsTheStoredOneThenWhatTheSiteProfileSaysThenTheDefault', () => {
    const seed = (childrenWelcome: boolean | null) => ({ rooms: [], stayDiscounts: [], photoMeta: [], siteProfile: { childrenWelcome } as never });

    expect(wizardDefaults({ ...PROPERTY, childrenPolicy: 'No' }, seed(true)).childrenPolicy).toBe('No');
    expect(wizardDefaults(PROPERTY, seed(false)).childrenPolicy).toBe('No');
    expect(wizardDefaults(PROPERTY, seed(true)).childrenPolicy).toBe('Yes');
    expect(wizardDefaults(PROPERTY, seed(null)).childrenPolicy).toBe(NEW_PROPERTY_DEFAULTS.childrenPolicy);
  });

  it('wizardDefaults_TheListingDataOfTheServer_FillsTheFormSoTheFirstSaveTakesNothingAway', () => {
    const defaults = wizardDefaults(PROPERTY, {
      rooms: [],
      stayDiscounts: [
        { minNights: 7, percentOff: 10 },
        { minNights: 28, percentOff: 22.5 },
      ],
      photoMeta: [{ url: 'https://cdn/a.jpg', alt: { it: 'Soggiorno', en: 'Living room' }, width: null, height: null, roomId: 'r1' }],
      siteProfile: { childrenWelcome: null, translations: { en: { title: 'Trullo with pool', description: 'A quiet trullo.' }, fr: { title: 'Trullo avec piscine' } } } as never,
    });

    expect(defaults.stayDiscounts).toEqual([
      { minNights: '7', percentOff: '10' },
      { minNights: '28', percentOff: '22.5' },
    ]);
    expect(defaults.photoMeta).toEqual([{ url: 'https://cdn/a.jpg', altIt: 'Soggiorno', altEn: 'Living room', roomId: 'r1' }]);
    expect(defaults.texts.en).toEqual({ title: 'Trullo with pool', description: 'A quiet trullo.' });
    expect(defaults.texts.fr).toEqual({ title: 'Trullo avec piscine', description: '' });
    expect(defaults.texts.de).toEqual({ title: '', description: '' });
  });
});
