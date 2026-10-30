import { z, type ZodType } from 'zod';
import type { FieldValues } from 'react-hook-form';
import { isOpenBlocker } from '@/features/compliance/activation-wizard-model';
import { ACCOMMODATION_TYPES } from '@/types';
import type { AccommodationType, CreatePropertyDto, Property, UpdatePropertyDto } from '@/types';
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
  // 3 · Dotazioni (the ones the host chooses here; PetFriendly and SmokingAllowed follow the house rules)
  amenities: string[];
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
  amenities: [],
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
    amenities: property.amenities.filter((amenity) => CHOOSABLE_AMENITIES.has(amenity)),
  };
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
