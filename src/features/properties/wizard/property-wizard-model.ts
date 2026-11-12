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

/** The steps of «Aggiungi immobile», in order. The address carries the id (`?step=photos`), so a step can be linked to. */
export const WIZARD_STEP_IDS = ['base', 'photos', 'amenities', 'descriptions', 'rules', 'prices', 'channels', 'finish'] as const;
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
  /** Counters of the spaces; once the unit has a room they are read from the rooms (`rooms`) and the host does not type them. */
  bedrooms: number;
  beds: number;
  bathrooms: number;
  /** Optional, whole square metres; text because it is typed. */
  areaSqm: string;
  /** The rooms with their beds (NF-34); empty = the host gave the counters only. At least one bed in all when there is a room. */
  rooms: RoomDraft[];
  // 2 · Foto (the photos themselves are on the server, not in the form)
  /** The caption (Italian and English) and the room of the photos that have one (NF-32). */
  photoMeta: PhotoMetaDraft[];
  // 3 · Dotazioni (the ones the host chooses here; PetFriendly and SmokingAllowed follow the house rules)
  amenities: string[];
  // 4 · Descrizioni. Italian is the columns of the property, every other language the site profile (NF-31).
  /** The headline of the listing in Italian (required to publish). */
  listingTitle: string;
  /** The description of the listing in Italian (required to publish). */
  description: string;
  /** The headline and the description in the other languages by language code; English is required to publish, the others are optional. */
  texts: Record<string, ListingTextDraft>;
  // 5 · Regole. Times are `HH:mm`; blank = the host did not say.
  checkInFrom: string;
  checkOutBy: string;
  smokingPolicy: SmokingPolicy | '';
  petsPolicy: PetsPolicy | '';
  partiesPolicy: PartiesPolicy | '';
  childrenPolicy: ChildrenPolicy | '';
  /** Quiet hours come as a pair: both or none. */
  quietHoursFrom: string;
  quietHoursTo: string;
  /** Euros a night for each extra guest, as typed; blank = extra guests are not accepted. */
  extraGuestFee: string;
  /** One of the catalog; blank = none chosen (the refund then follows the default rule of the booking site). */
  cancellationPolicyId: string;
  houseRules: string;
  // 6 · Prezzi. The amounts are typed, so they are text here and numbers in what is sent.
  nightlyRate: string;
  /** Percent on the nights that start on a Friday or a Saturday; blank = none. */
  weekendSurcharge: string;
  cleaningFee: string;
  /** 1 = no minimum. */
  minNights: number;
  /** The length-of-stay discounts, at most 5 (NF-35); a row left empty is not sent. */
  stayDiscounts: StayDiscountDraft[];
  // 7 · Canali (E02/F03/US01/T04). The codes of the channels the host chose not to publish to; none = all the ones that receive content.
  skipChannels: string[];
  // 8 · «Mostra la casa sul sito» (PublishedOnSite). It never publishes by itself: the activation decides what can be shown.
  publishedOnSite: boolean;
}

type StepSchema = ZodType<unknown, FieldValues>;

/** A civic number, or «snc» (senza numero civico), somewhere in the address. */
const CIVIC_NUMBER = /\d|\bsnc\b|\bs\.\s?n\.\s?c\.?/i;

const roomSchema = z.object({
  key: z.string(),
  type: z.enum(PROPERTY_ROOM_TYPES),
  beds: z
    .array(z.object({ type: z.enum(BED_TYPES), count: z.number().int().min(1, 'propertyWizard.validation.rooms.bedCount').max(MAX_BEDS_OF_A_KIND, 'propertyWizard.validation.rooms.bedCount') }))
    .max(BED_TYPES.length, 'propertyWizard.validation.rooms.bedCount'),
});

/**
 * The rooms (NF-34): at most 20, and once there is a room at least one bed in all and no more than 100, as the API asks. An empty list is
 * fine: the host gave the counters only.
 */
const roomsSchema = z
  .array(roomSchema)
  .max(MAX_ROOMS, 'propertyWizard.validation.rooms.max')
  .superRefine((rooms, context) => {
    if (rooms.length === 0) return;
    const beds = totalBeds(rooms);
    if (beds < MIN_TOTAL_BEDS) context.addIssue({ code: 'custom', message: 'propertyWizard.validation.rooms.noBed' });
    else if (beds > MAX_TOTAL_BEDS) context.addIssue({ code: 'custom', message: 'propertyWizard.validation.rooms.tooManyBeds' });
  });

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
  rooms: roomsSchema,
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

const listingTitleOf = (message: string) => z.string().trim().min(1, message).max(LISTING_TITLE_MAX, 'propertyWizard.validation.listingTitle');
const listingTextOf = (message: string) => z.string().trim().min(1, message).max(LISTING_DESCRIPTION_MAX, 'propertyWizard.validation.description');

/**
 * The headline and the description of the listing (step 4, NF-31): Italian and English are both required — the channels will not take a
 * listing without them — and say what is missing, one message for each. The other languages are optional and have the same limits.
 */
export const descriptionsStepSchema: StepSchema = z.object({
  listingTitle: listingTitleOf('propertyWizard.validation.descriptions.itTitle'),
  description: listingTextOf('propertyWizard.validation.descriptions.itDescription'),
  texts: z
    .object({
      en: z.object({
        title: listingTitleOf('propertyWizard.validation.descriptions.enTitle'),
        description: listingTextOf('propertyWizard.validation.descriptions.enDescription'),
      }),
    })
    .catchall(
      z.object({
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
      title: z.string().trim().max(LISTING_TITLE_MAX, 'propertyWizard.validation.listingTitle'),
      description: z.string().trim().max(LISTING_DESCRIPTION_MAX, 'propertyWizard.validation.description'),
    }),
  ),
});

/** The steps whose «Salva e chiudi» asks less than their «Avanti» does. */
export const SAVE_AND_CLOSE_SCHEMAS: Partial<Record<string, StepSchema>> = { descriptions: descriptionsLengthsSchema };

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

/**
 * The prices (step 5), with the limits of the API: the rate and the cleaning in euros (a rate of 0 is no rate, so one is asked for from
 * 1), the weekend surcharge from 0 to 100 percent, the minimum stay from 1 to 30 nights. Blank is allowed: a property without a rate is
 * saved and stays «Da completare» — the activation says so. The length-of-stay discounts (NF-35) are at most 5 tiers, each from 2 to 365
 * nights with a percentage above 0 and at most 100, and no two with the same nights; a row left empty is not a tier.
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

/**
 * The amenities the house rules decide (SR-07a): the step «Regole» turns them on and off from the answers about pets and smoking,
 * so they are not asked here. A property that has them keeps them when this step saves its list.
 */
export const RULE_AMENITIES: readonly string[] = ['PetFriendly', 'SmokingAllowed'];

/**
 * The listing data the server already has for a property the wizard reopens on (`?propertyId=`): the rooms, the discounts, the texts of
 * the other languages and the captions of the photos. The wizard starts from them; a property the wizard creates starts with none.
 */
export interface WizardListingSeed {
  rooms: readonly PropertyRoom[];
  stayDiscounts: readonly StayDiscountTier[];
  siteProfile: SiteProfile | null;
  photoMeta: readonly PropertyPhotoMeta[];
}

/** What a property starts from when it has no listing data yet. */
export const EMPTY_LISTING_SEED: WizardListingSeed = { rooms: [], stayDiscounts: [], siteProfile: null, photoMeta: [] };

/** The rule about children of a property that never stated one: what its site profile already says (`childrenWelcome`), or the default of the design. */
function childrenPolicyOf(property: Property, siteProfile: SiteProfile | null): ChildrenPolicy | '' {
  if (property.childrenPolicy) return property.childrenPolicy;
  if (siteProfile?.childrenWelcome === true) return 'Yes';
  if (siteProfile?.childrenWelcome === false) return 'No';
  return NEW_PROPERTY_DEFAULTS.childrenPolicy;
}

/** The fields of the form that «Prendi la nuova versione» can rewrite on the server: the headline, the description, the house rules and the texts of the other languages. */
export type AdoptableFields = Pick<PropertyWizardValues, 'listingTitle' | 'description' | 'houseRules' | 'texts'>;

/**
 * Those fields as the server has them. One place for both the opening of the wizard and the moment after the host took the descriptions of
 * the channel manager (the form then starts from them again, or its next save would send the old texts back, E02/F03/US01/T04, NF-27).
 */
export function adoptableFieldsOf(property: Pick<Property, 'listingTitle' | 'description' | 'houseRules'>, siteProfile: SiteProfile | null): AdoptableFields {
  return {
    listingTitle: property.listingTitle ?? '',
    description: property.description ?? '',
    houseRules: property.houseRules ?? '',
    texts: textDraftsFromProfile(siteProfile),
  };
}

/** The values the wizard opens with: a new property's defaults, or the property as the server has it. */
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
    postalCode: property.postalCode ?? '',
    // 0 = not set for a property that was never let for short stays: the counters start from the smallest valid value.
    maxGuests: Math.max(1, property.maxGuests),
    // With rooms the counters are the rooms' (the server sets them from the rooms at every save); without, the property's own.
    bedrooms: rooms.length > 0 ? bedroomCount(rooms) : property.bedrooms,
    // A property that never stated its beds starts the counter from its bedrooms (one bed each, at least one): shown, never hidden.
    beds: rooms.length > 0 ? totalBeds(rooms) : (property.beds ?? Math.max(1, property.bedrooms)),
    bathrooms: Math.max(1, property.bathrooms),
    areaSqm: property.areaSqm ? String(property.areaSqm) : '',
    rooms,
    photoMeta: photoMetaDraftsFromServer(seed.photoMeta),
    // Every amenity but the two the house rules decide: the catalog gives the host what to choose from, and one the property has that the
    // catalog does not know stays in the list (the step never takes away what it cannot show).
    amenities: property.amenities.filter((amenity) => !RULE_AMENITIES.includes(amenity)),
    checkInFrom: toHourMinute(property.checkInFrom) || NEW_PROPERTY_DEFAULTS.checkInFrom,
    checkOutBy: toHourMinute(property.checkOutBy) || NEW_PROPERTY_DEFAULTS.checkOutBy,
    // A property that never stated a rule starts from what its amenities already say (an old one may list PetFriendly): shown, never hidden.
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

/**
 * The Italian headline and description, saved by the descriptions step into the columns of the property (the other languages go to the site
 * profile). A blank headline is cleared: the listing then uses the name (the step does not let it be blank, a saved one is never left so).
 */
export function descriptionsUpdatePayload(values: PropertyWizardValues): UpdatePropertyDto {
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
  if (values.childrenPolicy) payload.childrenPolicy = values.childrenPolicy;
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

/** «Mostra la casa sul sito», written on its own (and before the activation, so that a «no» is in place when the property goes live). */
export function visibilityUpdatePayload(showOnSite: boolean): UpdatePropertyDto {
  return { publishedOnSite: showOnSite };
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
 * Where the open `base-data` blocker is fixed: the first step when the name, the address, the city or the guests are missing, the
 * prices when only the rate is. Used by the reopening of the wizard and by the «Correggi» of the last step.
 */
export function baseDataStepFor(property: Pick<Property, 'name' | 'address' | 'city' | 'maxGuests'>): 'base' | 'prices' {
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
