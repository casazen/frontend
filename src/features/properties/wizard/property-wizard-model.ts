import { z, type ZodType } from 'zod';
import type { FieldValues } from 'react-hook-form';
import { isOpenBlocker } from '@/features/compliance/activation-wizard-model';
import { ACCOMMODATION_TYPES } from '@/types';
import type { AccommodationType, CreatePropertyDto, PartiesPolicy, PetsPolicy, Property, SmokingPolicy, UpdatePropertyDto } from '@/types';
import type { ComplianceWizardStep } from '@/types/compliance.types';
import { DEFAULT_PROPERTY_TIMEZONE } from '../schemas/property.schema';

/** The steps of «Aggiungi immobile», in order. The address carries the id (`?step=photos`), so a step can be linked to. */
export const WIZARD_STEP_IDS = ['base', 'photos', 'amenities', 'rules', 'prices', 'finish'] as const;
export type WizardStepId = (typeof WIZARD_STEP_IDS)[number];

/** Name of the query parameter that carries the property once it exists on the server (the end of the first step). */
export const PROPERTY_ID_PARAM = 'propertyId';

/**
 * What the host answers in the wizard. `WizardShell` holds them as the values of its form; the step lives in the address
 * (`?step=`) and the property, once created, in `?propertyId=`.
 */
export interface PropertyWizardValues {
  // 1 · Dati base
  accommodationType: AccommodationType | '';
  name: string;
  address: string;
  /** Piano e interno, optional. */
  unit: string;
  /** ISTAT code of the comune chosen from the official list. */
  comuneIstatCode: string;
  /** The comune's name: what is stored as the city of the property. */
  city: string;
  /** Optional: an Italian postal code, 5 digits. */
  postalCode: string;
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  /** Optional, whole square metres; text because it is typed. */
  areaSqm: string;
  // 2 · Foto e annuncio (the photos themselves are on the server, not in the form)
  /** The headline of the listing; blank = the listing uses the name. */
  listingTitle: string;
  description: string;
  // 3 · Dotazioni (the ones the host chooses here; PetFriendly and SmokingAllowed follow the house rules)
  amenities: string[];
  // 4 · Regole. Times are `HH:mm`; blank = the host did not say.
  checkInFrom: string;
  checkOutBy: string;
  smokingPolicy: SmokingPolicy | '';
  petsPolicy: PetsPolicy | '';
  partiesPolicy: PartiesPolicy | '';
  /** Quiet hours come as a pair: both or none. */
  quietHoursFrom: string;
  quietHoursTo: string;
  /** Euros a night for each extra guest, as typed; blank = extra guests are not accepted. */
  extraGuestFee: string;
  /** One of the catalog; blank = none chosen (the refund then follows the default rule of the booking site). */
  cancellationPolicyId: string;
  houseRules: string;
  // 5 · Prezzi. The amounts are typed, so they are text here and numbers in what is sent.
  nightlyRate: string;
  /** Percent on the nights that start on a Friday or a Saturday; blank = none. */
  weekendSurcharge: string;
  cleaningFee: string;
  /** 1 = no minimum. */
  minNights: number;
}

type StepSchema = ZodType<unknown, FieldValues>;

/** A civic number, or «snc» (senza numero civico), somewhere in the address. */
const CIVIC_NUMBER = /\d|\bsnc\b|\bs\.\s?n\.\s?c\.?/i;

/** The limits are the ones of the API and of the form of today (`property.schema.ts`): whole numbers, a studio flat has 0 bedrooms. */
export const baseStepSchema: StepSchema = z.object({
  accommodationType: z.enum(ACCOMMODATION_TYPES).or(z.literal('')),
  name: z.string().trim().min(3, 'propertyWizard.validation.name.min').max(100, 'propertyWizard.validation.name.max'),
  address: z
    .string()
    .trim()
    .min(5, 'propertyWizard.validation.address.required')
    .max(500, 'propertyWizard.validation.address.max')
    .refine((value) => CIVIC_NUMBER.test(value), 'propertyWizard.validation.address.civic'),
  unit: z.string().max(30, 'propertyWizard.validation.unit.max'),
  // The comune is what the regional rules, the CIN check and the tourist tax follow: it is chosen from the official list.
  comuneIstatCode: z.string().regex(/^[0-9]{6}$/, 'propertyWizard.validation.comune.required'),
  city: z.string().min(2, 'propertyWizard.validation.comune.required'),
  postalCode: z.string().trim().regex(/^(\d{5})?$/, 'propertyWizard.validation.postalCode.format'),
  maxGuests: z.number({ error: 'propertyWizard.validation.maxGuests' }).int().min(1, 'propertyWizard.validation.maxGuests').max(100, 'propertyWizard.validation.maxGuests'),
  bedrooms: z.number({ error: 'propertyWizard.validation.bedrooms' }).int().min(0, 'propertyWizard.validation.bedrooms').max(100, 'propertyWizard.validation.bedrooms'),
  beds: z.number({ error: 'propertyWizard.validation.beds' }).int().min(1, 'propertyWizard.validation.beds').max(100, 'propertyWizard.validation.beds'),
  bathrooms: z.number({ error: 'propertyWizard.validation.bathrooms' }).int().min(1, 'propertyWizard.validation.bathrooms').max(50, 'propertyWizard.validation.bathrooms'),
  areaSqm: z.string().trim().regex(/^(\d{1,4})?$/, 'propertyWizard.validation.areaSqm').refine((value) => value === '' || Number(value) >= 1, 'propertyWizard.validation.areaSqm'),
});

/**
 * The headline and the description of the listing (step 2). The photos are optional, so is the text: blank is a valid answer. The
 * description is a short pitch here (600); the API takes up to 2000 and the form of the property goes further than the wizard.
 */
export const photosStepSchema: StepSchema = z.object({
  listingTitle: z.string().trim().max(60, 'propertyWizard.validation.listingTitle'),
  description: z.string().trim().max(600, 'propertyWizard.validation.description'),
});

/** An amount in euros as typed (a comma or a point for the cents): the number, or `null` when it is not one. */
export function parseAmount(text: string): number | null {
  const value = text.trim();
  return /^\d{1,6}([.,]\d{1,2})?$/.test(value) ? Number(value.replace(',', '.')) : null;
}

const amount = (min: number, max: number, message: string) =>
  z.string().refine((text) => {
    if (text.trim() === '') return true;
    const value = parseAmount(text);
    return value !== null && value >= min && value <= max;
  }, message);

const time = z.string().regex(/^(\d{2}:\d{2})?$/, 'propertyWizard.validation.time');

/**
 * The house rules (step 4). Everything is optional — a rule the host leaves blank is a rule nobody states — but the quiet hours are a
 * pair: the server refuses one without the other (422 `property_quiet_hours_incomplete`), so it is said here, on the field.
 */
export const rulesStepSchema: StepSchema = z
  .object({
    checkInFrom: time,
    checkOutBy: time,
    smokingPolicy: z.enum(['No', 'OutdoorsOnly', 'Yes']).or(z.literal('')),
    petsPolicy: z.enum(['No', 'OnRequest', 'Yes']).or(z.literal('')),
    partiesPolicy: z.enum(['No', 'OnRequest']).or(z.literal('')),
    quietHoursFrom: time,
    quietHoursTo: time,
    extraGuestFee: amount(0, 1000, 'propertyWizard.validation.extraGuestFee'),
    cancellationPolicyId: z.string(),
    houseRules: z.string().trim().max(1000, 'propertyWizard.validation.houseRules'),
  })
  .superRefine((value, context) => {
    if ((value.quietHoursFrom === '') !== (value.quietHoursTo === '')) {
      context.addIssue({
        code: 'custom',
        path: [value.quietHoursFrom === '' ? 'quietHoursFrom' : 'quietHoursTo'],
        message: 'propertyWizard.validation.quietHours',
      });
    }
  });

/**
 * The prices (step 5), with the limits of the API: the rate and the cleaning in euros (a rate of 0 is no rate, so one is asked for from
 * 1), the weekend surcharge from 0 to 100 percent, the minimum stay from 1 to 30 nights. Blank is allowed: a property without a rate is
 * saved and stays «Da completare» — the activation says so.
 */
export const pricesStepSchema: StepSchema = z.object({
  nightlyRate: amount(1, 100000, 'propertyWizard.validation.nightlyRate'),
  weekendSurcharge: amount(0, 100, 'propertyWizard.validation.weekendSurcharge'),
  cleaningFee: amount(0, 10000, 'propertyWizard.validation.cleaningFee'),
  minNights: z
    .number({ error: 'propertyWizard.validation.minNights' })
    .int()
    .min(1, 'propertyWizard.validation.minNights')
    .max(30, 'propertyWizard.validation.minNights'),
});

/** What a new property starts from (the defaults of the design): the host changes them, nothing is asked twice. */
export const NEW_PROPERTY_DEFAULTS: PropertyWizardValues = {
  accommodationType: 'Apartment',
  name: '',
  address: '',
  unit: '',
  comuneIstatCode: '',
  city: '',
  postalCode: '',
  maxGuests: 4,
  bedrooms: 2,
  beds: 3,
  bathrooms: 1,
  areaSqm: '',
  listingTitle: '',
  description: '',
  amenities: [],
  checkInFrom: '15:00',
  checkOutBy: '10:00',
  smokingPolicy: 'No',
  petsPolicy: 'No',
  partiesPolicy: 'No',
  quietHoursFrom: '',
  quietHoursTo: '',
  extraGuestFee: '',
  cancellationPolicyId: '',
  houseRules: '',
  nightlyRate: '',
  weekendSurcharge: '',
  cleaningFee: '',
  minNights: 1,
};

/**
 * The amenities the house rules decide (SR-07a): the step «Regole» turns them on and off from the answers about pets and smoking,
 * so they are not asked here. A property that has them keeps them when this step saves its list.
 */
export const RULE_AMENITIES: readonly string[] = ['PetFriendly', 'SmokingAllowed'];

/**
 * The 21 amenities the host chooses here, in four groups: the 22 of the form of today less `PetFriendly`, which follows the rules.
 * The groups are the product's own; the values are the exact names of the API's `PropertyAmenity`.
 */
export const AMENITY_GROUPS: ReadonlyArray<{ id: 'essentials' | 'outdoor' | 'comfort' | 'other'; amenities: readonly string[] }> = [
  { id: 'essentials', amenities: ['WiFi', 'AirConditioning', 'Heating', 'Kitchen', 'Washer', 'Dryer', 'TV'] },
  { id: 'outdoor', amenities: ['FreeParking', 'Pool', 'HotTub', 'Balcony', 'Terrace', 'Garden', 'BBQGrill'] },
  { id: 'comfort', amenities: ['Gym', 'Elevator', 'Fireplace'] },
  { id: 'other', amenities: ['SmokeDetector', 'FirstAidKit', 'FireExtinguisher', 'CarbonMonoxideDetector'] },
];

const CHOOSABLE_AMENITIES = new Set(AMENITY_GROUPS.flatMap((group) => group.amenities));

/** The values the wizard opens with: a new property's defaults, or the property as the server has it. */
export function wizardDefaults(property?: Property): PropertyWizardValues {
  if (!property) return NEW_PROPERTY_DEFAULTS;
  return {
    accommodationType: property.accommodationType ?? '',
    name: property.name,
    address: property.address,
    unit: property.unit ?? '',
    comuneIstatCode: property.comuneIstatCode ?? '',
    city: property.city,
    postalCode: property.postalCode ?? '',
    // 0 = not set for a property that was never let for short stays: the counters start from the smallest valid value.
    maxGuests: Math.max(1, property.maxGuests),
    bedrooms: property.bedrooms,
    // A property that never stated its beds starts the counter from its bedrooms (one bed each, at least one): shown, never hidden.
    beds: property.beds ?? Math.max(1, property.bedrooms),
    bathrooms: Math.max(1, property.bathrooms),
    areaSqm: property.areaSqm ? String(property.areaSqm) : '',
    listingTitle: property.listingTitle ?? '',
    description: property.description ?? '',
    amenities: property.amenities.filter((amenity) => CHOOSABLE_AMENITIES.has(amenity)),
    checkInFrom: toHourMinute(property.checkInFrom) || NEW_PROPERTY_DEFAULTS.checkInFrom,
    checkOutBy: toHourMinute(property.checkOutBy) || NEW_PROPERTY_DEFAULTS.checkOutBy,
    // A property that never stated a rule starts from what its amenities already say (an old one may list PetFriendly): shown, never hidden.
    smokingPolicy: property.smokingPolicy ?? (property.amenities.includes('SmokingAllowed') ? 'Yes' : NEW_PROPERTY_DEFAULTS.smokingPolicy),
    petsPolicy: property.petsPolicy ?? (property.amenities.includes('PetFriendly') ? 'Yes' : NEW_PROPERTY_DEFAULTS.petsPolicy),
    partiesPolicy: property.partiesPolicy ?? NEW_PROPERTY_DEFAULTS.partiesPolicy,
    quietHoursFrom: toHourMinute(property.quietHoursFrom),
    quietHoursTo: toHourMinute(property.quietHoursTo),
    extraGuestFee: property.extraGuestFeePerNight != null ? String(property.extraGuestFeePerNight) : '',
    cancellationPolicyId: property.cancellationPolicyId ?? '',
    houseRules: property.houseRules ?? '',
    nightlyRate: property.nightlyRate > 0 ? String(property.nightlyRate) : '',
    weekendSurcharge: (property.weekendSurchargePercent ?? 0) > 0 ? String(property.weekendSurchargePercent) : '',
    cleaningFee: property.cleaningFee > 0 ? String(property.cleaningFee) : '',
    minNights: property.minNights ?? 1,
  };
}

/** `15:00:00` as the API serves a time, or `15:00`, as `15:00`; blank when the property has none. */
function toHourMinute(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : '';
}

const toAreaSqm = (value: string): number | null => (value.trim() === '' ? null : Number(value));

/** The fields of the first step that are the same when the property is created and when it is saved again. */
function baseFields(values: PropertyWizardValues) {
  return {
    name: values.name.trim(),
    address: values.address.trim(),
    // Blank = no unit: the API clears it on an update and stores none on a create.
    unit: values.unit.trim() === '' ? null : values.unit.trim(),
    city: values.city,
    comuneIstatCode: values.comuneIstatCode,
    postalCode: values.postalCode.trim(),
    bedrooms: values.bedrooms,
    bathrooms: values.bathrooms,
    maxGuests: values.maxGuests,
    accommodationType: values.accommodationType === '' ? null : values.accommodationType,
    beds: values.beds,
    areaSqm: toAreaSqm(values.areaSqm),
  };
}

/**
 * The body that creates the property at the end of the first step. The rate is 0 (the prices come at their own step): the API takes
 * it and the property is «Da completare» until it has one. The rental mode is sent by the hook that creates (`useCreateProperty('Short')`).
 */
export function createPayload(values: PropertyWizardValues): CreatePropertyDto {
  return { ...baseFields(values), description: '', nightlyRate: 0, timezone: DEFAULT_PROPERTY_TIMEZONE };
}

/** The first step saved again (PATCH: description, rate and everything else of the property are left as they are). */
export function baseUpdatePayload(values: PropertyWizardValues): UpdatePropertyDto {
  return baseFields(values);
}

/** The headline and the description, saved by the photos step. A blank headline is cleared: the listing then uses the name. */
export function photosUpdatePayload(values: PropertyWizardValues): UpdatePropertyDto {
  const listingTitle = values.listingTitle.trim();
  return { listingTitle: listingTitle === '' ? null : listingTitle, description: values.description.trim() };
}

/**
 * The house rules saved by step 4. A blank time or rule is left out (PATCH: the stored value stays), a blank fee is `null` (extra
 * guests are not accepted, and a fee set before is taken off), a blank policy is left out — the wizard cannot un-choose one.
 */
export function rulesUpdatePayload(values: PropertyWizardValues): UpdatePropertyDto {
  const payload: UpdatePropertyDto = {
    extraGuestFeePerNight: parseAmount(values.extraGuestFee),
    houseRules: values.houseRules.trim(),
    // The pair is kept whole: both go, or both are cleared.
    quietHoursFrom: values.quietHoursFrom || null,
    quietHoursTo: values.quietHoursTo || null,
  };
  if (values.checkInFrom) payload.checkInFrom = values.checkInFrom;
  if (values.checkOutBy) payload.checkOutBy = values.checkOutBy;
  if (values.smokingPolicy) payload.smokingPolicy = values.smokingPolicy;
  if (values.petsPolicy) payload.petsPolicy = values.petsPolicy;
  if (values.partiesPolicy) payload.partiesPolicy = values.partiesPolicy;
  if (values.cancellationPolicyId) payload.cancellationPolicyId = values.cancellationPolicyId;
  return payload;
}

/**
 * The prices saved by step 5. A blank rate is left out (the stored one stays); a blank surcharge or cleaning is 0 (the API turns the
 * surcharge off with 0 and leaving it out keeps it); one night as a minimum is no minimum, which the API calls `null`.
 */
export function pricesUpdatePayload(values: PropertyWizardValues): UpdatePropertyDto {
  const nightlyRate = parseAmount(values.nightlyRate);
  return {
    ...(nightlyRate !== null ? { nightlyRate } : {}),
    weekendSurchargePercent: parseAmount(values.weekendSurcharge) ?? 0,
    cleaningFee: parseAmount(values.cleaningFee) ?? 0,
    minNights: values.minNights > 1 ? values.minNights : null,
  };
}

/**
 * The amenities saved by the step: the ones chosen here plus, untouched, the ones the house rules decide that the property already
 * has (the list of the API is replaced as a whole).
 */
export function amenitiesUpdatePayload(values: PropertyWizardValues, stored: Pick<Property, 'amenities'>): UpdatePropertyDto {
  const kept = stored.amenities.filter((amenity) => RULE_AMENITIES.includes(amenity));
  return { amenities: [...values.amenities, ...kept] };
}

/** True when the property has what the first step asks for — a name, an address, a city and guests — as the server counts it. */
function baseFieldsAreSet(property: Pick<Property, 'name' | 'address' | 'city' | 'maxGuests'>): boolean {
  return property.name.trim() !== '' && property.address.trim() !== '' && property.city.trim() !== '' && property.maxGuests > 0;
}

/**
 * The step a property is reopened on (SR-07b, used again by SR-07c): the first of the wizard that has a blocker open **as the
 * server tells it** (`GET /properties/:id/compliance/activation`), never worked out here from the record:
 * - `base-data`: step 1 when the name, the address, the city or the guests are missing, step 5 (the prices) when only the rate is;
 * - `safety`: step 3 (amenities and safety); `cin` and `documents`: step 6 (calendars, CIN, documents);
 * - no open blocker: step 6, where the terms are accepted and the property is activated.
 * The photos and the amenities are not blockers: they are reached from the links of the drawer (`?step=`).
 */
export function resumeStepFor(
  property: Pick<Property, 'name' | 'address' | 'city' | 'maxGuests'>,
  activationSteps: readonly ComplianceWizardStep[],
): WizardStepId {
  const open = new Set(activationSteps.filter(isOpenBlocker).map((step) => step.id));
  const candidates: WizardStepId[] = [];
  if (open.has('base-data')) candidates.push(baseFieldsAreSet(property) ? 'prices' : 'base');
  if (open.has('safety')) candidates.push('amenities');
  if (open.has('cin') || open.has('documents')) candidates.push('finish');
  if (candidates.length === 0) return 'finish';
  return candidates.reduce((first, other) => (WIZARD_STEP_IDS.indexOf(other) < WIZARD_STEP_IDS.indexOf(first) ? other : first));
}
