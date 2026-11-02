import { isAxiosError } from 'axios';
import { z, type ZodType } from 'zod';
import type { FieldValues } from 'react-hook-form';
import { stayDateOf } from '@/features/bookings/lib/booking-price';
import { getProblemCode } from '@/lib/api-errors';
import { isStayDate, romeWallClock, romeWallTimeToUtc, todayInRome } from '@/lib/stay-dates';
import type { Booking } from '@/types';
import type { HostSupplierSlot } from '@/types/host-supplier-catalog';
import type { CreateServiceRequestDto, ServiceRequestUrgency } from '@/types/service-request';
import type { ServiceRequestAssist } from '@/types/service-request-assist';

/**
 * The model of «Richiedi un intervento» (SR-08b): what the wizard asks, the rules of its steps, the window that is advised for a
 * turnover, the slots of a day, the request it sends and the way a refusal is told. No React in here.
 *
 * The steps, in the order the host walks them: the property, who to ask (a CasaZen supplier, or an external partner), the kind of
 * service, the proposals (the suppliers in the order of the ranking, or the partners), the details (service, day and time, urgency,
 * notes, and the stay if the host wants to link one) and the summary. A request is for the house: a stay is only a link.
 */

/** Name of the flow: the draft is kept under it, for the signed-in person. */
export const REQUEST_WIZARD_ID = 'intervention-request';

/** The steps of the wizard (`?step=`). With an external partner the wizard stops at `partners`: there is nothing to send to CasaZen. */
export type RequestStepId = 'property' | 'channel' | 'service' | 'proposals' | 'partners' | 'details' | 'review';

/** Who the host asks: a CasaZen supplier (the rule, whenever one covers the comune) or an external partner. */
export type RequestChannel = 'casazen' | 'external';

/** The parameter of the address that holds the channel; without it the request goes to a CasaZen supplier. */
export const CHANNEL_PARAM = 'channel';

/** The channel the address asks for: only `external` is a choice, anything else is CasaZen. */
export function channelOf(search: URLSearchParams): RequestChannel {
  return search.get(CHANNEL_PARAM) === 'external' ? 'external' : 'casazen';
}

/** The longest note the API takes (`ServiceRequest.Notes`). */
export const REQUEST_NOTES_MAX = 1000;

/** The lengths of work the wizard offers when the host chooses it, the same list as the dialog it replaces (plus «altro»). */
export const DURATIONS = [30, 60, 90, 120, 180, 240, 360] as const;
export const DURATION_OTHER = 'other';
/** The API takes 5 to 1,440 minutes (`CreateServiceRequestRequest.DurationMinutes`). */
export const MIN_DURATION = 5;
export const MAX_DURATION = 1440;

/** What a job with no catalog service starts from when nothing advises another time: 10:00 for two hours, as the server would have. */
export const DEFAULT_START_TIME = '10:00';
export const DEFAULT_DURATION = 120;

/**
 * The hours a turnover is advised between, when the property has none of its own (the times of check-out and check-in are a data of the
 * property since SR-07a): the guests leave by 10:00 and the next ones come from 15:00. Said in the page, never hidden.
 */
export const DEFAULT_CHECK_OUT_BY = '10:00';
export const DEFAULT_CHECK_IN_FROM = '15:00';

/** `serviceId` of a job that is not in the supplier's catalog: the host gives the time and the length. */
export const CUSTOM_SERVICE = 'custom';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** What the host answers in the wizard; the wizard holds them as the values of its form and keeps a draft of the first answers. */
export interface RequestValues {
  // ① Immobile
  propertyId: string;
  // ② Chi: «Descrivi di cosa hai bisogno» (WIZ-AI-REQUEST). The AI help is optional and none of this is ever sent as it is: the choices it
  // fills in (the service, the urgency, the notes, the channel) are the answers of the steps, which the host reads and changes.
  /** What the host wrote for the AI (kept while the wizard is open, not in the draft: it is theirs and it is short-lived). */
  assistText: string;
  /** The service the AI chose from the words, while it is still the one chosen: the line «L'AI ha scelto…» says so. `''` = the host chose. */
  aiCategory: string;
  /** Why the AI chose it, as it said it (for that line only). */
  aiExplanation: string;
  /** The sentence the AI wrote for the supplier and put in the notes: the notes are replaced by a new one only while they are still this. */
  aiSummary: string;
  // ③ Servizio
  category: string;
  // ④ Proposte
  supplierOrgId: string;
  /** For the summary only (never sent). */
  supplierName: string;
  // ⑤ Dettagli
  /** `''` (not chosen yet), {@link CUSTOM_SERVICE} or the id of a service of the supplier's catalog. */
  serviceId: string;
  /** What the summary says of the service chosen (never sent): its name, length and price. */
  serviceName: string;
  serviceMinutes: number | null;
  serviceEstimateCents: number | null;
  serviceRequiresQuote: boolean;
  servicePriceFromCents: number | null;
  servicePriceUnit: string;
  /** The day of the work, `yyyy-MM-dd` (Europe/Rome). */
  day: string;
  /** `HH:mm` (Europe/Rome): the slot chosen, or the time the host wrote. */
  startTime: string;
  /** For a job the host times itself: one of {@link DURATIONS} or {@link DURATION_OTHER}. */
  durationChoice: string;
  /** The minutes of «altro». */
  durationOther: string;
  urgency: ServiceRequestUrgency;
  notes: string;
  /** The stay the request is linked to, if the host wants one; `''` is the house alone. */
  bookingId: string;
  // ⑥ Riepilogo
  /**
   * SP-BKP: also send the request to up to three backup suppliers, declared as such (the choice of the last step, offered while the server
   * has the rule on). On unless it says `false`; only a «no» is sent, so a request made without the choice follows the org's.
   */
  useBackups?: boolean;
}

/** The fields that depend on the supplier and its agenda: never written to the draft (they change, and the slots are the supplier's). */
export const REQUEST_DRAFT_EXCLUDE: readonly string[] = [
  'assistText',
  'aiCategory',
  'aiExplanation',
  'aiSummary',
  'supplierOrgId',
  'supplierName',
  'serviceId',
  'serviceName',
  'serviceMinutes',
  'serviceEstimateCents',
  'serviceRequiresQuote',
  'servicePriceFromCents',
  'servicePriceUnit',
  'startTime',
  'durationChoice',
  'durationOther',
  'useBackups',
];

export const URGENCIES: readonly ServiceRequestUrgency[] = ['Normal', 'High', 'Emergency'];

type StepSchema = ZodType<unknown, FieldValues>;

/** A service of the catalog is chosen (not «altro lavoro»). */
export const isCatalogService = (serviceId: string): boolean => serviceId !== '' && serviceId !== CUSTOM_SERVICE;

/** The host gives the time and the length: a job outside the catalog, or a service the supplier gave no duration (so it has no slots). */
export function timedByHost(values: Pick<RequestValues, 'serviceId' | 'serviceMinutes'>): boolean {
  return values.serviceId === CUSTOM_SERVICE || (isCatalogService(values.serviceId) && values.serviceMinutes === null);
}

/** The length the host wrote, in minutes; `null` while it is not a number the API takes. */
export function typedDuration(values: Pick<RequestValues, 'durationChoice' | 'durationOther'>): number | null {
  const text = values.durationChoice === DURATION_OTHER ? values.durationOther.trim() : values.durationChoice;
  if (!/^\d{1,4}$/.test(text)) return null;
  const minutes = Number(text);
  return minutes >= MIN_DURATION && minutes <= MAX_DURATION ? minutes : null;
}

/** The instant the work starts (UTC) for a day and an `HH:mm`; `null` when they are not a time. */
export function startInstant(day: string, time: string): string | null {
  if (!isStayDate(day) || !CLOCK.test(time)) return null;
  return romeWallTimeToUtc(day, time) || null;
}

/** The time asked for has already gone by (Europe/Rome). A time that cannot be read is not "past": another rule says so. */
export function startsInThePast(day: string, time: string, now: Date = new Date()): boolean {
  const instant = startInstant(day, time);
  return instant !== null && Date.parse(instant) < now.getTime();
}

/**
 * The rules of the steps, checked before the next one opens (the messages are i18n keys, as in every form). `clock` is read when a rule
 * is checked, not when the rules are made: a person who leaves the page open is judged by the time it is when they press «Continua».
 * The channel and the partners have none: the channel is always one of two, and a partner is only a link.
 */
export function requestStepSchemas(clock: () => Date = () => new Date()): {
  property: StepSchema;
  service: StepSchema;
  proposals: StepSchema;
  details: StepSchema;
} {
  return {
    property: z.object({ propertyId: z.string().min(1, 'requestWizard.errors.propertyRequired') }),
    service: z.object({ category: z.string().min(1, 'requestWizard.errors.categoryRequired') }),
    proposals: z.object({ supplierOrgId: z.string().min(1, 'requestWizard.errors.supplierRequired') }),
    details: z
      .object({
        serviceId: z.string().min(1, 'requestWizard.errors.serviceRequired'),
        serviceMinutes: z.number().nullable(),
        bookingId: z.string().optional(),
        day: z
          .string()
          .refine((day) => isStayDate(day), 'requestWizard.errors.dayRequired')
          .refine((day) => !isStayDate(day) || day >= todayInRome(clock()), 'requestWizard.errors.dayPast'),
        startTime: z.string(),
        durationChoice: z.string(),
        durationOther: z.string(),
        urgency: z.enum(URGENCIES, 'requestWizard.errors.urgencyRequired'),
        notes: z.string().max(REQUEST_NOTES_MAX, 'requestWizard.errors.notesTooLong'),
      })
      .superRefine((values, context) => {
        if (values.serviceId === '') return;
        if (!CLOCK.test(values.startTime)) {
          context.addIssue({ code: 'custom', path: ['startTime'], message: isCatalogService(values.serviceId) && values.serviceMinutes !== null ? 'requestWizard.errors.slotRequired' : 'requestWizard.errors.timeRequired' });
        } else if (startsInThePast(values.day, values.startTime, clock())) {
          context.addIssue({ code: 'custom', path: ['startTime'], message: 'requestWizard.errors.timePast' });
        }
        if (timedByHost(values) && typedDuration(values) === null) {
          context.addIssue({ code: 'custom', path: [values.durationChoice === DURATION_OTHER ? 'durationOther' : 'durationChoice'], message: 'requestWizard.errors.durationInvalid' });
        }
      }),
  };
}

export interface RequestDefaults {
  values: RequestValues;
  /** The address asked for something (`?propertyId`, `?type`, …): a draft from before must not take its place. */
  prefilled: boolean;
}

/**
 * Where the wizard starts, from the address the entry points use (`?propertyId=&bookingId=&type=&date=&supplierOrgId=&serviceId=`): what is
 * not an id, a category of the catalog or a day that has not passed is left out. `categories` is the catalog (without it no `type` is taken).
 */
export function requestDefaults(search: URLSearchParams, categories: readonly string[] | undefined, today: string = todayInRome()): RequestDefaults {
  const id = (name: string) => {
    const value = search.get(name)?.trim() ?? '';
    return UUID.test(value) ? value : '';
  };
  const type = search.get('type')?.trim() ?? '';
  const date = search.get('date')?.trim() ?? '';

  const values: RequestValues = {
    propertyId: id('propertyId'),
    assistText: '',
    aiCategory: '',
    aiExplanation: '',
    aiSummary: '',
    category: categories?.includes(type) ? type : '',
    supplierOrgId: id('supplierOrgId'),
    supplierName: '',
    serviceId: id('serviceId'),
    serviceName: '',
    serviceMinutes: null,
    serviceEstimateCents: null,
    serviceRequiresQuote: false,
    servicePriceFromCents: null,
    servicePriceUnit: '',
    day: isStayDate(date) && date >= today ? date : today,
    startTime: '',
    durationChoice: String(DEFAULT_DURATION),
    durationOther: '',
    urgency: 'Normal',
    notes: '',
    bookingId: id('bookingId'),
    useBackups: true,
  };
  const prefilled = ['propertyId', 'bookingId', 'type', 'date', 'supplierOrgId', 'serviceId'].some((name) => search.has(name));
  return { values, prefilled };
}

/**
 * The step a wizard opens on when the address did not name one: the first that is not answered already. The property comes first, then
 * the channel (asked once the property is known: it decides who is looked for around it), then the service; with a service the host sees
 * the proposals, and with a supplier already chosen (the page of a supplier) the details.
 */
export function openingStepFor(values: Pick<RequestValues, 'propertyId' | 'category' | 'supplierOrgId'>, channel: RequestChannel): RequestStepId {
  if (values.propertyId === '') return 'property';
  if (values.category === '') return 'channel';
  if (channel === 'external') return 'partners';
  return values.supplierOrgId === '' ? 'proposals' : 'details';
}

/** The shortest and the longest description the AI reads (what the API takes: 8 to 600 characters). */
export const ASSIST_MIN_TEXT = 8;
export const ASSIST_MAX_TEXT = 600;

/** What the wizard does with the proposal of the AI once the host takes it. */
export interface AssistOutcome {
  /** The answers the proposal fills in. */
  values: Partial<RequestValues>;
  channel: RequestChannel;
  /** Where the wizard goes on from: the proposals of the CasaZen suppliers, or the partners. */
  step: 'proposals' | 'partners';
}

/**
 * The proposal of the AI as the answers of the wizard: the service, the urgency and the sentence for the supplier as the notes (only when
 * the host has no notes of their own: none yet, or still the ones the AI wrote before), with the channel and the step it goes on from.
 * `null` when the AI proposed nothing the wizard can use (no service, a service the catalog does not have, no channel).
 */
export function assistOutcome(
  assist: ServiceRequestAssist,
  current: Pick<RequestValues, 'notes' | 'aiSummary'>,
  categories: readonly string[],
): AssistOutcome | null {
  if (!assist.aiUsed || !assist.category || !assist.channel || !categories.includes(assist.category)) return null;

  const summary = (assist.summary ?? '').trim().slice(0, REQUEST_NOTES_MAX);
  const notes = current.notes.trim();
  const values: Partial<RequestValues> = {
    category: assist.category,
    urgency: assist.urgency ?? 'Normal',
    aiCategory: assist.category,
    aiExplanation: (assist.explanation ?? '').trim(),
    aiSummary: summary,
  };
  if (summary && (notes === '' || notes === current.aiSummary.trim())) values.notes = summary;

  return { values, channel: assist.channel, step: assist.channel === 'casazen' ? 'proposals' : 'partners' };
}

/** The first day the work can be on for a stay: its check-out day, never one that has passed. */
export function dayForStay(checkOutDate: string, today: string = todayInRome()): string {
  const checkOut = stayDateOf(checkOutDate);
  return checkOut >= today ? checkOut : today;
}

// ─── The turnover: advised hours, and the slots of a day ───

const pad = (value: number) => String(value).padStart(2, '0');

/** The wall clock of an instant in Europe/Rome: its day and `HH:mm`. */
export function wallTimeOf(instant: string): { day: string; time: string } | null {
  const clock = romeWallClock(instant);
  return clock ? { day: clock.date, time: `${pad(clock.hour)}:${pad(clock.minute)}` } : null;
}

/** The hours a job is advised between on a day when a stay leaves; `to` is `null` when nobody arrives that day. */
export interface TurnoverWindow {
  from: string;
  to: string | null;
}

/**
 * The window advised for a turnover on `day`, from the stays of the property: from the hour the guests leave (`checkOutBy`) to the hour
 * the next ones can come (`checkInFrom`) when someone arrives the same day, otherwise open-ended. `null` when no stay leaves that day:
 * there is nothing to advise. The hours are those of the property when it has them, otherwise the declared defaults.
 */
export function turnoverWindow(
  day: string,
  stays: ReadonlyArray<Pick<Booking, 'checkInDate' | 'checkOutDate' | 'status'>>,
  hours: { checkOutBy?: string | null; checkInFrom?: string | null } = {},
): TurnoverWindow | null {
  const live = stays.filter((stay) => stay.status !== 'Cancelled');
  if (!live.some((stay) => stayDateOf(stay.checkOutDate) === day)) return null;
  const arrives = live.some((stay) => stayDateOf(stay.checkInDate) === day);
  const checkOutBy = hours.checkOutBy && CLOCK.test(hours.checkOutBy) ? hours.checkOutBy : DEFAULT_CHECK_OUT_BY;
  const checkInFrom = hours.checkInFrom && CLOCK.test(hours.checkInFrom) ? hours.checkInFrom : DEFAULT_CHECK_IN_FROM;
  return { from: checkOutBy, to: arrives ? checkInFrom : null };
}

/** The start and the length a job outside the catalog is proposed with: the start of the window (else 10:00) and, as long as the window lets it, two hours. */
export function proposedSchedule(window: TurnoverWindow | null): { startTime: string; durationChoice: string } {
  const startTime = window?.from ?? DEFAULT_START_TIME;
  if (!window?.to) return { startTime, durationChoice: String(DEFAULT_DURATION) };
  const [fromHour, fromMinute] = window.from.split(':').map(Number);
  const [toHour, toMinute] = window.to.split(':').map(Number);
  const room = toHour * 60 + toMinute - (fromHour * 60 + fromMinute);
  const fitting = [...DURATIONS].reverse().find((minutes) => minutes <= Math.min(room, DEFAULT_DURATION));
  return { startTime, durationChoice: String(fitting ?? DURATIONS[0]) };
}

/** A free slot as a button: the hours it takes on its day. */
export interface SlotChoice {
  time: string;
  endTime: string;
  startUtc: string;
  endUtc: string;
}

/** The slots that start on `day` (Europe/Rome), in start order. */
export function slotsOfDay(slots: readonly HostSupplierSlot[], day: string): SlotChoice[] {
  const choices: SlotChoice[] = [];
  for (const slot of slots) {
    const start = wallTimeOf(slot.startUtc);
    const end = wallTimeOf(slot.endUtc);
    if (!start || !end || start.day !== day) continue;
    choices.push({ time: start.time, endTime: end.day === start.day ? end.time : '24:00', startUtc: slot.startUtc, endUtc: slot.endUtc });
  }
  return choices.sort((a, b) => a.time.localeCompare(b.time));
}

/** The days (Europe/Rome) that have at least one slot, soonest first. */
export function daysWithSlots(slots: readonly HostSupplierSlot[]): string[] {
  const days = new Set<string>();
  for (const slot of slots) {
    const start = wallTimeOf(slot.startUtc);
    if (start) days.add(start.day);
  }
  return [...days].sort();
}

/** The slots that fall inside the advised window (a slot that ends after it is out); no window keeps them all. */
export function slotsInWindow(choices: readonly SlotChoice[], window: TurnoverWindow | null): SlotChoice[] {
  if (!window) return [...choices];
  return choices.filter((choice) => choice.time >= window.from && (window.to === null || choice.endTime <= window.to));
}

// ─── The request, and its refusals ───

/** The `POST` the wizard sends. A catalog service with slots goes with its slot and no length (the server takes it from the service). */
export function toCreateRequest(values: RequestValues): CreateServiceRequestDto {
  const scheduledStartUtc = startInstant(values.day, values.startTime) ?? undefined;
  const request: CreateServiceRequestDto = {
    propertyId: values.propertyId,
    supplierOrgId: values.supplierOrgId,
    category: values.category,
    urgency: values.urgency,
    notes: values.notes.trim() || undefined,
    bookingId: values.bookingId || undefined,
    scheduledStartUtc,
  };
  if (isCatalogService(values.serviceId)) request.serviceListingId = values.serviceId;
  if (timedByHost(values)) request.durationMinutes = typedDuration(values) ?? undefined;
  // SP-BKP: only a «no» is sent; without it the org's choice decides (and the server ignores it while the rule is off).
  if (values.useBackups === false) request.useBackupSuppliers = false;
  return request;
}

/** The refusals of the creation that send the host back to a step with a sentence of their own (the others show the server's words). */
export type RequestProblemKind =
  | 'slotTaken'
  | 'commitmentConflict'
  | 'supplierInactive'
  | 'supplierOutsideComune'
  | 'serviceUnavailable'
  | 'timeInvalid'
  | 'stayMismatch';

export interface RequestProblem {
  kind: RequestProblemKind;
  /** The step the answers to change are on. */
  step: 'proposals' | 'details';
}

const PROBLEMS: Readonly<Record<string, RequestProblem>> = {
  supplier_slot_unavailable: { kind: 'slotTaken', step: 'details' },
  supplier_commitment_conflict: { kind: 'commitmentConflict', step: 'details' },
  service_request_supplier_inactive: { kind: 'supplierInactive', step: 'proposals' },
  service_request_supplier_outside_comune: { kind: 'supplierOutsideComune', step: 'proposals' },
  supplier_not_found: { kind: 'supplierInactive', step: 'proposals' },
  service_request_service_unavailable: { kind: 'serviceUnavailable', step: 'details' },
  supplier_service_not_found: { kind: 'serviceUnavailable', step: 'details' },
  service_request_service_category_mismatch: { kind: 'serviceUnavailable', step: 'details' },
  service_request_time_invalid: { kind: 'timeInvalid', step: 'details' },
  service_request_booking_mismatch: { kind: 'stayMismatch', step: 'details' },
  service_request_booking_not_allowed: { kind: 'stayMismatch', step: 'details' },
};

/** The refusal of a failed creation that has a sentence and a step of its own, or `null` (the server's words are shown). */
export function requestProblemOf(error: unknown): RequestProblem | null {
  if (!isAxiosError(error)) return null;
  const code = getProblemCode(error.response?.data);
  return code && Object.prototype.hasOwnProperty.call(PROBLEMS, code) ? PROBLEMS[code] : null;
}

/**
 * What the supplier sees of the request (decision D9), as the keys of the sentences the summary shows: before it takes the request it
 * knows the category, the urgency, the comune and postal code of the property, the day and time, the price and the name of the host's
 * organization; once it took it, also the name and address of the property, the notes and the contact of the host. Never a guest.
 */
export const SUPPLIER_SEES = {
  before: ['requestWizard.review.sees.before.what', 'requestWizard.review.sees.before.where', 'requestWizard.review.sees.before.when', 'requestWizard.review.sees.before.who'],
  after: ['requestWizard.review.sees.after.where', 'requestWizard.review.sees.after.notes', 'requestWizard.review.sees.after.contact'],
  never: 'requestWizard.review.sees.never',
} as const;
