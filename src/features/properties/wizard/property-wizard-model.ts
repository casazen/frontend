import { z, type ZodType } from 'zod';
import type { FieldValues } from 'react-hook-form';
import { isOpenBlocker } from '@/features/compliance/activation-wizard-model';
import {
  LISTING_DESCRIPTION_MAX,
  LISTING_TITLE_MAX,
  emptyTextDrafts,
  textDraftsFromProfile,
  type ListingTextDraft,
} from '@/lib/listing-texts';
import { PHOTO_CAPTION_MAX, photoMetaDraftsFromServer, type PhotoMetaDraft } from '@/lib/listing-photos';
import { ACCOMMODATION_TYPES, BED_TYPES, PROPERTY_ROOM_TYPES } from '@/types';
import type {
  AccommodationType,
  ChildrenPolicy,
  CreatePropertyDto,
  PartiesPolicy,
  PetsPolicy,
  Property,
  PropertyPhotoMeta,
  PropertyRoom,
  SiteProfile,
  SmokingPolicy,
  StayDiscountTier,
  UpdatePropertyDto,
} from '@/types';
import type { ComplianceWizardStep } from '@/types/compliance.types';
import { DEFAULT_PROPERTY_TIMEZONE } from '../schemas/property.schema';
import {
  MAX_BEDS_OF_A_KIND,
  MAX_ROOMS,
  MAX_TOTAL_BEDS,
  MIN_TOTAL_BEDS,
  bedroomCount,
  roomDraftsFromServer,
  totalBeds,
  type RoomDraft,
} from './rooms-model';
import { MAX_STAY_DISCOUNTS, stayDiscountDraftsFromServer, stayDiscountProblem, type StayDiscountDraft } from './stay-discounts-model';

import { WIZARD_STEP_IDS, type WizardStepId } from './property-setup-progress';
export { WIZARD_STEP_IDS, type WizardStepId } from './property-setup-progress';

export const PROPERTY_ID_PARAM = 'propertyId';

export interface PropertyWizardValues {
  accommodationType: AccommodationType | '';
  name: string;
  address: string;
  unit: string;
  comuneIstatCode: string;
  city: string;
  country: 'IT' | 'CH' | '';
  postalCode: string;
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  /** Optional, whole square metres; text because it is typed. */
  areaSqm: string;
  rooms: RoomDraft[];
  photoMeta: PhotoMetaDraft[];
  amenities: string[];
  listingTitle: string;
  description: string;
  texts: Record<string, ListingTextDraft>;
  checkInFrom: string;
  checkOutBy: string;
  smokingPolicy: SmokingPolicy | '';
  petsPolicy: PetsPolicy | '';
  partiesPolicy: PartiesPolicy | '';
  childrenPolicy: ChildrenPolicy | '';
  quietHoursFrom: string;
  quietHoursTo: string;
  extraGuestFee: string;
  cancellationPolicyId: string;
  houseRules: string;
  nightlyRate: string;
  weekendSurcharge: string;
  cleaningFee: string;
  minNights: number;
  stayDiscounts: StayDiscountDraft[];
  skipChannels: string[];
  publishedOnSite: boolean;
}

type StepSchema = ZodType<unknown, FieldValues>;

const CIVIC_NUMBER = /\d|\bsnc\b|\bs\.\s?n\.\s?c\.?/i;

const roomSchema = z.object({
  key: z.string(),
  type: z.enum(PROPERTY_ROOM_TYPES),
  beds: z
    .array(z.object({ type: z.enum(BED_TYPES), count: z.number().int().min(1, 'propertyWizard.validation.rooms.bedCount').max(MAX_BEDS_OF_A_KIND, 'propertyWizard.validation.rooms.bedCount') }))
    .max(BED_TYPES.length, 'propertyWizard.validation.rooms.bedCount'),
});

const roomsSchema = z
  .array(roomSchema)
  .max(MAX_ROOMS, 'propertyWizard.validation.rooms.max')
  .superRefine((rooms, context) => {
    if (rooms.length === 0) return;
    const beds = totalBeds(rooms);
    if (beds < MIN_TOTAL_BEDS) context.addIssue({ code: 'custom', message: 'propertyWizard.validation.rooms.noBed' });
    else if (beds > MAX_TOTAL_BEDS) context.addIssue({ code: 'custom', message: 'propertyWizard.validation.rooms.tooManyBeds' });
  });

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
  comuneIstatCode: z.string(),
  city: z.string().min(2, 'propertyWizard.validation.comune.required'),
  country: z.enum(['IT', 'CH'], { error: 'property.form.chooseCountry' }),
  postalCode: z.string().trim().regex(/^(\d{4,5})?$/, 'propertyWizard.validation.postalCode.format'),
  maxGuests: z.number({ error: 'propertyWizard.validation.maxGuests' }).int().min(1, 'propertyWizard.validation.maxGuests').max(100, 'propertyWizard.validation.maxGuests'),
  bedrooms: z.number({ error: 'propertyWizard.validation.bedrooms' }).int().min(0, 'propertyWizard.validation.bedrooms').max(100, 'propertyWizard.validation.bedrooms'),
  beds: z.number({ error: 'propertyWizard.validation.beds' }).int().min(1, 'propertyWizard.validation.beds').max(100, 'propertyWizard.validation.beds'),
  bathrooms: z.number({ error: 'propertyWizard.validation.bathrooms' }).int().min(1, 'propertyWizard.validation.bathrooms').max(50, 'propertyWizard.validation.bathrooms'),
  areaSqm: z.string().trim().regex(/^(\d{1,4})?$/, 'propertyWizard.validation.areaSqm').refine((value) => value === '' || Number(value) >= 1, 'propertyWizard.validation.areaSqm'),
  rooms: roomsSchema,
}).superRefine((value, context) => {
  if (value.country === 'IT' && !/^[0-9]{6}$/.test(value.comuneIstatCode))
    context.addIssue({ code: 'custom', path: ['comuneIstatCode'], message: 'propertyWizard.validation.comune.required' });
  if (value.postalCode && value.postalCode.length !== (value.country === 'CH' ? 4 : 5))
    context.addIssue({ code: 'custom', path: ['postalCode'], message: 'propertyWizard.validation.postalCode.format' });
});

/**
 * The photos (step 2). They are optional, so are their captions: blank is a valid answer. A caption in English needs the one in Italian
 * (the API refuses it otherwise, 422 `property_site_profile_italian_required`), and none is longer than the API allows.
 */
export const photosStepSchema: StepSchema = z.object({
  photoMeta: z.array(
    z
      .object({
        url: z.string(),
        altIt: z.string().trim().max(PHOTO_CAPTION_MAX, 'propertyWizard.validation.photos.captionMax'),
        altEn: z.string().trim().max(PHOTO_CAPTION_MAX, 'propertyWizard.validation.photos.captionMax'),
        roomId: z.string(),
      })
      .superRefine((photo, context) => {
        if (photo.altEn.trim() !== '' && photo.altIt.trim() === '') {
          context.addIssue({ code: 'custom', path: ['altIt'], message: 'propertyWizard.validation.photos.italianRequired' });
        }
      }),
  ),
});

const listingExtraShape = { spaces: z.string().max(1000).optional(), access: z.string().max(1000).optional(), neighborhood: z.string().max(1000).optional(), transport: z.string().max(1000).optional(), rules: z.string().max(1000).optional() };

const listingTitleOf = (message: string) => z.string().trim().min(1, message).max(LISTING_TITLE_MAX, 'propertyWizard.validation.listingTitle');
const listingTextOf = (message: string) => z.string().trim().min(1, message).max(LISTING_DESCRIPTION_MAX, 'propertyWizard.validation.description');

export const descriptionsStepSchema: StepSchema = z.object({
  listingTitle: listingTitleOf('propertyWizard.validation.descriptions.itTitle'),
  description: listingTextOf('propertyWizard.validation.descriptions.itDescription'),
  texts: z
    .object({
      en: z.object({
        ...listingExtraShape,
        title: listingTitleOf('propertyWizard.validation.descriptions.enTitle'),
        description: listingTextOf('propertyWizard.validation.descriptions.enDescription'),
      }),
    })
    .catchall(
      z.object({
        ...listingExtraShape,
        title: z.string().trim().max(LISTING_TITLE_MAX, 'propertyWizard.validation.listingTitle'),
        description: z.string().trim().max(LISTING_DESCRIPTION_MAX, 'propertyWizard.validation.description'),
      }),
    ),
});

/**
 * What «Salva e chiudi» checks on the descriptions step: the lengths only. The step asks for the four required texts before «Avanti» (the
 * channels take no listing without them), but leaving to finish later must not be refused: it saves what is there. It is also the whole
 * schema of the step where the channel manager is not connected (the flag `octorateConnector` is off): the texts are then optional, as
 * the title and the description of the photos step always were, and `WizardShell` does not ask for them again at the last button.
 */
export const descriptionsLengthsSchema: StepSchema = z.object({
  listingTitle: z.string().trim().max(LISTING_TITLE_MAX, 'propertyWizard.validation.listingTitle'),
  description: z.string().trim().max(LISTING_DESCRIPTION_MAX, 'propertyWizard.validation.description'),
  texts: z.record(
    z.string(),
    z.object({
      ...listingExtraShape,
      title: z.string().trim().max(LISTING_TITLE_MAX, 'propertyWizard.validation.listingTitle'),
      description: z.string().trim().max(LISTING_DESCRIPTION_MAX, 'propertyWizard.validation.description'),
    }),
  ),
});

export const SAVE_AND_CLOSE_SCHEMAS: Partial<Record<string, StepSchema>> = { descriptions: descriptionsLengthsSchema };

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

export const rulesStepSchema: StepSchema = z
  .object({
    checkInFrom: time,
    checkOutBy: time,
    smokingPolicy: z.enum(['No', 'OutdoorsOnly', 'Yes']).or(z.literal('')),
    petsPolicy: z.enum(['No', 'OnRequest', 'Yes']).or(z.literal('')),
    partiesPolicy: z.enum(['No', 'OnRequest']).or(z.literal('')),
    childrenPolicy: z.enum(['No', 'OnRequest', 'Yes']).or(z.literal('')),
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

export const pricesStepSchema: StepSchema = z.object({
  nightlyRate: amount(1, 100000, 'propertyWizard.validation.nightlyRate'),
  weekendSurcharge: amount(0, 100, 'propertyWizard.validation.weekendSurcharge'),
  cleaningFee: amount(0, 10000, 'propertyWizard.validation.cleaningFee'),
  minNights: z
    .number({ error: 'propertyWizard.validation.minNights' })
    .int()
    .min(1, 'propertyWizard.validation.minNights')
    .max(30, 'propertyWizard.validation.minNights'),
  stayDiscounts: z
    .array(z.object({ minNights: z.string(), percentOff: z.string() }))
    .max(MAX_STAY_DISCOUNTS, 'propertyWizard.validation.stayDiscounts.max')
    .superRefine((drafts, context) => {
      drafts.forEach((_draft, index) => {
        const problem = stayDiscountProblem(drafts, index);
        if (problem) context.addIssue({ code: 'custom', path: [index, problem.field], message: problem.message });
      });
    }),
});

export const NEW_PROPERTY_DEFAULTS: PropertyWizardValues = {
  accommodationType: 'Apartment',
  name: '',
  address: '',
  unit: '',
  comuneIstatCode: '',
  city: '',
  country: 'IT',
  postalCode: '',
  maxGuests: 4,
  bedrooms: 2,
  beds: 3,
  bathrooms: 1,
  areaSqm: '',
  rooms: [],
  photoMeta: [],
  amenities: [],
  listingTitle: '',
  description: '',
  texts: emptyTextDrafts(),
  checkInFrom: '15:00',
  checkOutBy: '10:00',
  smokingPolicy: 'No',
  petsPolicy: 'No',
  partiesPolicy: 'No',
  childrenPolicy: 'Yes',
  quietHoursFrom: '',
  quietHoursTo: '',
  extraGuestFee: '',
  cancellationPolicyId: '',
  houseRules: '',
  nightlyRate: '',
  weekendSurcharge: '',
  cleaningFee: '',
  minNights: 1,
  stayDiscounts: [],
  skipChannels: [],
  publishedOnSite: true,
};

export const RULE_AMENITIES: readonly string[] = ['PetFriendly', 'SmokingAllowed'];

export interface WizardListingSeed {
  rooms: readonly PropertyRoom[];
  stayDiscounts: readonly StayDiscountTier[];
  siteProfile: SiteProfile | null;
  photoMeta: readonly PropertyPhotoMeta[];
}

export const EMPTY_LISTING_SEED: WizardListingSeed = { rooms: [], stayDiscounts: [], siteProfile: null, photoMeta: [] };

function childrenPolicyOf(property: Property, siteProfile: SiteProfile | null): ChildrenPolicy | '' {
  if (property.childrenPolicy) return property.childrenPolicy;
  if (siteProfile?.childrenWelcome === true) return 'Yes';
  if (siteProfile?.childrenWelcome === false) return 'No';
  return NEW_PROPERTY_DEFAULTS.childrenPolicy;
}

export type AdoptableFields = Pick<PropertyWizardValues, 'listingTitle' | 'description' | 'houseRules' | 'texts'>;

export function adoptableFieldsOf(property: Pick<Property, 'listingTitle' | 'description' | 'houseRules'>, siteProfile: SiteProfile | null): AdoptableFields {
  return {
    listingTitle: property.listingTitle ?? '',
    description: property.description ?? '',
    houseRules: property.houseRules ?? '',
    texts: textDraftsFromProfile(siteProfile),
  };
}

export function wizardDefaults(property?: Property, seed: WizardListingSeed = EMPTY_LISTING_SEED): PropertyWizardValues {
  if (!property) return NEW_PROPERTY_DEFAULTS;
  const rooms = roomDraftsFromServer(seed.rooms);
  return {
    ...adoptableFieldsOf(property, seed.siteProfile),
    accommodationType: property.accommodationType ?? '',
    name: property.name,
    address: property.address,
    unit: property.unit ?? '',
    comuneIstatCode: property.comuneIstatCode ?? '',
    city: property.city,
    country: property.country,
    postalCode: property.postalCode ?? '',
    maxGuests: Math.max(1, property.maxGuests),
    bedrooms: rooms.length > 0 ? bedroomCount(rooms) : property.bedrooms,
    beds: rooms.length > 0 ? totalBeds(rooms) : (property.beds ?? Math.max(1, property.bedrooms)),
    bathrooms: Math.max(1, property.bathrooms),
    areaSqm: property.areaSqm ? String(property.areaSqm) : '',
    rooms,
    photoMeta: photoMetaDraftsFromServer(seed.photoMeta),
    amenities: property.amenities.filter((amenity) => !RULE_AMENITIES.includes(amenity)),
    checkInFrom: toHourMinute(property.checkInFrom) || NEW_PROPERTY_DEFAULTS.checkInFrom,
    checkOutBy: toHourMinute(property.checkOutBy) || NEW_PROPERTY_DEFAULTS.checkOutBy,
    smokingPolicy: property.smokingPolicy ?? (property.amenities.includes('SmokingAllowed') ? 'Yes' : NEW_PROPERTY_DEFAULTS.smokingPolicy),
    petsPolicy: property.petsPolicy ?? (property.amenities.includes('PetFriendly') ? 'Yes' : NEW_PROPERTY_DEFAULTS.petsPolicy),
    partiesPolicy: property.partiesPolicy ?? NEW_PROPERTY_DEFAULTS.partiesPolicy,
    childrenPolicy: childrenPolicyOf(property, seed.siteProfile),
    quietHoursFrom: toHourMinute(property.quietHoursFrom),
    quietHoursTo: toHourMinute(property.quietHoursTo),
    extraGuestFee: property.extraGuestFeePerNight != null ? String(property.extraGuestFeePerNight) : '',
    cancellationPolicyId: property.cancellationPolicyId ?? '',
    nightlyRate: property.nightlyRate > 0 ? String(property.nightlyRate) : '',
    weekendSurcharge: (property.weekendSurchargePercent ?? 0) > 0 ? String(property.weekendSurchargePercent) : '',
    cleaningFee: property.cleaningFee > 0 ? String(property.cleaningFee) : '',
    minNights: property.minNights ?? 1,
    stayDiscounts: stayDiscountDraftsFromServer(seed.stayDiscounts),
    skipChannels: [],
    publishedOnSite: property.publishedOnSite ?? true,
  };
}

function toHourMinute(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : '';
}

const toAreaSqm = (value: string): number | null => (value.trim() === '' ? null : Number(value));

function baseFields(values: PropertyWizardValues) {
  return {
    name: values.name.trim(),
    address: values.address.trim(),
    unit: values.unit.trim() === '' ? null : values.unit.trim(),
    city: values.city,
    country: values.country === '' ? undefined : values.country,
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

export function createPayload(values: PropertyWizardValues): CreatePropertyDto {
  return { ...baseFields(values), description: '', nightlyRate: 0, timezone: DEFAULT_PROPERTY_TIMEZONE };
}

export function baseUpdatePayload(values: PropertyWizardValues): UpdatePropertyDto {
  return baseFields(values);
}

export function descriptionsUpdatePayload(values: PropertyWizardValues): UpdatePropertyDto {
  const listingTitle = values.listingTitle.trim();
  return { listingTitle: listingTitle === '' ? null : listingTitle, description: values.description.trim(), ...(values.texts.it?.rules !== undefined ? { houseRules: values.houseRules.trim() } : {}) };
}

export function rulesUpdatePayload(values: PropertyWizardValues): UpdatePropertyDto {
  const payload: UpdatePropertyDto = {
    extraGuestFeePerNight: parseAmount(values.extraGuestFee),
    houseRules: values.houseRules.trim(),
    quietHoursFrom: values.quietHoursFrom || null,
    quietHoursTo: values.quietHoursTo || null,
  };
  if (values.checkInFrom) payload.checkInFrom = values.checkInFrom;
  if (values.checkOutBy) payload.checkOutBy = values.checkOutBy;
  if (values.smokingPolicy) payload.smokingPolicy = values.smokingPolicy;
  if (values.petsPolicy) payload.petsPolicy = values.petsPolicy;
  if (values.partiesPolicy) payload.partiesPolicy = values.partiesPolicy;
  if (values.childrenPolicy) payload.childrenPolicy = values.childrenPolicy;
  if (values.cancellationPolicyId) payload.cancellationPolicyId = values.cancellationPolicyId;
  return payload;
}

export function pricesUpdatePayload(values: PropertyWizardValues): UpdatePropertyDto {
  const nightlyRate = parseAmount(values.nightlyRate);
  return {
    ...(nightlyRate !== null ? { nightlyRate } : {}),
    weekendSurchargePercent: parseAmount(values.weekendSurcharge) ?? 0,
    cleaningFee: parseAmount(values.cleaningFee) ?? 0,
    minNights: values.minNights > 1 ? values.minNights : null,
  };
}

/** «Mostra la casa sul sito», written on its own (and before the activation, so that a «no» is in place when the property goes live). */
export function visibilityUpdatePayload(showOnSite: boolean): UpdatePropertyDto {
  return { publishedOnSite: showOnSite };
}

export function amenitiesUpdatePayload(values: PropertyWizardValues, stored: Pick<Property, 'amenities'>): UpdatePropertyDto {
  const kept = stored.amenities.filter((amenity) => RULE_AMENITIES.includes(amenity));
  return { amenities: [...values.amenities, ...kept] };
}

function baseFieldsAreSet(property: Pick<Property, 'name' | 'address' | 'city' | 'maxGuests'> & Partial<Pick<Property, 'country'>>): boolean {
  return property.name.trim() !== '' && property.address.trim() !== '' && property.city.trim() !== '' && property.maxGuests > 0 &&
    (property.country === undefined || property.country.length > 0);
}

export function baseDataStepFor(property: Pick<Property, 'name' | 'address' | 'city' | 'maxGuests'> & Partial<Pick<Property, 'country'>>): 'base' | 'prices' {
  return baseFieldsAreSet(property) ? 'prices' : 'base';
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
  if (open.has('base-data')) candidates.push(baseDataStepFor(property));
  if (open.has('safety')) candidates.push('amenities');
  if (open.has('cin') || open.has('documents')) candidates.push('finish');
  if (candidates.length === 0) return 'finish';
  return candidates.reduce((first, other) => (WIZARD_STEP_IDS.indexOf(other) < WIZARD_STEP_IDS.indexOf(first) ? other : first));
}
