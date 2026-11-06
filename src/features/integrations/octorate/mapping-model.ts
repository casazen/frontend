import { z, type ZodType } from 'zod';
import type { FieldValues } from 'react-hook-form';
import type { OctorateListing } from '@/types';

/**
 * What a host decides about the listings found on the channel manager (E02/F01/US02/T05, NF-28), and what that makes CasaZen do.
 *
 * Nothing is sent while the host decides: the decisions are answers of the wizard, kept with the draft like the first one. The summary
 * says what they will do, and the last button does it, listing by listing (OCT-04: nothing is written to a property until a person
 * confirms its mapping, and the person does so after reading the summary). "I'll do it later" is not a decision: it is the absence of one,
 * and the listing stays proposed or ambiguous, with the writes to its property blocked.
 */

/** The steps of the wizard that come after the consent: what the channel manager holds, which property each listing is, the summary. */
export const CHANNELS_STEP_ID = 'channels';
export const MAPPING_STEP_ID = 'mapping';
export const SUMMARY_STEP_ID = 'summary';

/**
 * - `confirm`: the listing is this CasaZen property (the proposed one, or one the host picked);
 * - `import`: the listing becomes a new CasaZen property (nothing is created on the channel manager, ADR-027-R8);
 * - `reject`: the listing is not one of the host's properties;
 * - `room`: the listing is confirmed already, and only its room is chosen.
 */
export const MAPPING_ACTIONS = ['confirm', 'import', 'reject', 'room'] as const;
export type MappingAction = (typeof MAPPING_ACTIONS)[number];

/** One decision, about the listing `listingId` (its `octorateAccommodationId`). Plain data: it goes to the draft of the wizard as it is. */
export interface MappingDecision {
  listingId: string;
  action: MappingAction;
  /** `confirm`: the CasaZen property. Empty while the host chose "another property" and has not picked one. */
  propertyId: string;
  /** `confirm`: the property was picked from the host's properties and is not the proposed one. */
  other: boolean;
  /** The listing has several rooms, so the host has to say which one this property is (a property is one unit). */
  needsRoom: boolean;
  /** The room (the product id the channel manager gives it). Empty until chosen. */
  roomId: string;
}

/** The choices of a listing still to decide, as the host reads them. `later` is the absence of a decision. */
export type MappingChoice = 'confirm' | 'other' | 'import' | 'later' | 'reject';

const DECISION_SCHEMA = z.object({
  listingId: z.string().min(1),
  action: z.enum(MAPPING_ACTIONS),
  propertyId: z.string(),
  other: z.boolean(),
  needsRoom: z.boolean(),
  roomId: z.string(),
});

const DECISIONS_SCHEMA = z.array(DECISION_SCHEMA);

/**
 * The decisions in a value that came from outside (a draft is just data in the tab): the well-formed list, or none when anything in it is
 * not a decision. A draft written before the decisions existed has none.
 */
export function readDecisions(value: unknown): MappingDecision[] {
  const parsed = DECISIONS_SCHEMA.safeParse(value);
  return parsed.success ? parsed.data : [];
}

/** Whether a draft's `decisions` can be used: absent (an older draft) or a list of decisions. */
export function decisionsAreReadable(value: unknown): boolean {
  return value === undefined || DECISIONS_SCHEMA.safeParse(value).success;
}

type StepSchema = ZodType<unknown, FieldValues>;

/**
 * The rules of the mapping step. A confirmation needs its property, a property is confirmed to one listing only, and a listing with
 * several rooms needs the room, because a CasaZen property is one unit. The messages are i18n keys, as in every form; the issue sits on the
 * field that holds the problem (`decisions.<n>.propertyId`, `decisions.<n>.roomId`), so the form shows it where the host looks.
 */
export const MAPPING_STEP_SCHEMA: StepSchema = z.object({
  decisions: DECISIONS_SCHEMA.superRefine((decisions, context) => {
    const chosen = new Set<string>();
    decisions.forEach((decision, index) => {
      const report = (field: 'propertyId' | 'roomId', message: string) =>
        context.addIssue({ code: 'custom', path: [index, field], message });

      if (decision.action === 'confirm') {
        if (!decision.propertyId) report('propertyId', 'octorate.connect.mapping.errors.propertyRequired');
        else if (chosen.has(decision.propertyId)) report('propertyId', 'octorate.connect.mapping.errors.propertyTwice');
        else chosen.add(decision.propertyId);
      }
      if (decision.action !== 'reject' && decision.needsRoom && !decision.roomId) {
        report('roomId', 'octorate.connect.mapping.errors.roomRequired');
      }
    });
  }),
});

/** The listing has several rooms: the host says which one is the property. */
export function hasSeveralRooms(listing: OctorateListing): boolean {
  return listing.rooms.length > 1;
}

/** A listing the host still has to decide about: everything but a mapping that is confirmed. */
export function isOpenListing(listing: OctorateListing): boolean {
  return listing.status !== 'Confirmed';
}

export function findDecision(decisions: readonly MappingDecision[], listingId: string): MappingDecision | undefined {
  return decisions.find((decision) => decision.listingId === listingId);
}

/**
 * The decisions with the one about `listingId` replaced by `next`, or taken away when `next` is `null`. A copy: the form keeps its own
 * array. The position of a decision does not change, so the errors the form holds by position stay on the right listing.
 */
export function replaceDecision(decisions: readonly MappingDecision[], listingId: string, next: MappingDecision | null): MappingDecision[] {
  const index = decisions.findIndex((decision) => decision.listingId === listingId);
  if (next === null) return decisions.filter((_, position) => position !== index);
  if (index < 0) return [...decisions, next];
  return decisions.map((decision, position) => (position === index ? next : decision));
}

/** The choice a decision stands for. No decision, and the decision of another kind of listing, read as "later". */
export function choiceOf(decision: MappingDecision | undefined): MappingChoice {
  if (!decision) return 'later';
  if (decision.action === 'confirm') return decision.other ? 'other' : 'confirm';
  if (decision.action === 'import' || decision.action === 'reject') return decision.action;
  return 'later';
}

/** The room a decision may keep when the host changes their mind: only a room the listing has. */
function keptRoom(listing: OctorateListing, previous: MappingDecision | undefined): string {
  return previous && listing.rooms.some((room) => room.id === previous.roomId) ? previous.roomId : '';
}

/**
 * The decision for a choice of the host, or `null` for "later". The room already chosen is kept when the listing has it; the property
 * picked from the list is kept when the host goes from the list to the list again (never carried into the proposal).
 */
export function decisionFor(listing: OctorateListing, choice: MappingChoice, previous?: MappingDecision): MappingDecision | null {
  if (choice === 'later') return null;

  const listingId = listing.octorateAccommodationId;
  switch (choice) {
    case 'confirm':
      return {
        listingId,
        action: 'confirm',
        propertyId: listing.proposedProperty?.id ?? '',
        other: false,
        needsRoom: hasSeveralRooms(listing),
        roomId: keptRoom(listing, previous),
      };
    case 'other':
      return {
        listingId,
        action: 'confirm',
        propertyId: previous?.other ? previous.propertyId : '',
        other: true,
        needsRoom: hasSeveralRooms(listing),
        roomId: keptRoom(listing, previous),
      };
    case 'import':
      return {
        listingId,
        action: 'import',
        propertyId: '',
        other: false,
        needsRoom: hasSeveralRooms(listing),
        roomId: keptRoom(listing, previous),
      };
    case 'reject':
      return { listingId, action: 'reject', propertyId: '', other: false, needsRoom: false, roomId: '' };
  }
}

/** The decision that only chooses the room of a listing that is confirmed already; none (`null`) while no room is chosen. */
export function roomDecision(listing: OctorateListing, roomId: string): MappingDecision | null {
  if (!roomId) return null;
  return {
    listingId: listing.octorateAccommodationId,
    action: 'room',
    propertyId: '',
    other: false,
    needsRoom: true,
    roomId,
  };
}

/** The properties the decisions confirm, by property: `propertyId` to the listing it was chosen for. */
export function propertiesChosen(decisions: readonly MappingDecision[]): Map<string, string> {
  const chosen = new Map<string, string>();
  for (const decision of decisions) {
    if (decision.action === 'confirm' && decision.propertyId && !chosen.has(decision.propertyId)) {
      chosen.set(decision.propertyId, decision.listingId);
    }
  }
  return chosen;
}

/** The properties already confirmed to a listing: they cannot be confirmed to another one. */
export function propertiesTaken(listings: readonly OctorateListing[]): Set<string> {
  const taken = new Set<string>();
  for (const listing of listings) {
    if (listing.status === 'Confirmed' && listing.proposedProperty) taken.add(listing.proposedProperty.id);
  }
  return taken;
}

/**
 * The listings whose proposal is one clear property that nobody else has (confirmed to another listing, or chosen for one) and that the
 * host has not decided about: the ones "Conferma le proposte chiare" confirms. A property proposed to two listings goes to the first only.
 */
export function clearProposals(listings: readonly OctorateListing[], decisions: readonly MappingDecision[]): OctorateListing[] {
  const taken = propertiesTaken(listings);
  const chosen = propertiesChosen(decisions);
  const found: OctorateListing[] = [];

  for (const listing of listings) {
    const property = listing.status === 'Proposed' ? listing.proposedProperty : null;
    if (!property || findDecision(decisions, listing.octorateAccommodationId)) continue;
    if (taken.has(property.id) || chosen.has(property.id)) continue;
    chosen.set(property.id, listing.octorateAccommodationId);
    found.push(listing);
  }
  return found;
}

/**
 * Whether a decision still means something for the listing as it is now. A listing that is gone, or that is confirmed already (earlier,
 * or by someone else meanwhile), has nothing left to decide, except the room still to set on a confirmed listing.
 */
function decisionApplies(decision: MappingDecision, listing: OctorateListing | undefined): boolean {
  if (!listing) return false;
  if (listing.status !== 'Confirmed') return decision.action !== 'room';
  return decision.action !== 'reject' && decision.roomId !== '' && decision.roomId !== listing.octorateProductId;
}

/**
 * The decisions that still apply to the listings as they are now. A decision about a listing the host can no longer see (it was confirmed
 * by someone else, or is gone) is dropped, so that it cannot block the step with a rule (a property chosen twice) about a row that is not
 * there to fix. Plain data in, a copy out (the same array when nothing is dropped).
 */
export function pruneDecisions(decisions: readonly MappingDecision[], listings: readonly OctorateListing[]): readonly MappingDecision[] {
  const byListing = new Map(listings.map((listing) => [listing.octorateAccommodationId, listing]));
  const kept = decisions.filter((decision) => decisionApplies(decision, byListing.get(decision.listingId)));
  return kept.length === decisions.length ? decisions : kept;
}

/** One thing CasaZen does when the host confirms, about one listing. */
export type PlanAction =
  | { kind: 'confirm'; listingId: string; propertyId: string; roomId: string }
  | { kind: 'import'; listingId: string; roomId: string }
  | { kind: 'reject'; listingId: string }
  | { kind: 'room'; listingId: string; roomId: string };

export interface MappingPlan {
  /** In the order of the listings. */
  actions: PlanAction[];
  /** The listings left for later: open, and with no decision that applies. A listing the host excluded earlier is not one of them. */
  later: OctorateListing[];
}

/**
 * What the decisions make CasaZen do, given the listings as the server has them now. A decision about a listing that is gone, or about
 * one that is confirmed already (earlier, or by another person meanwhile), does nothing, except the room of a confirmed listing, which is
 * still set when it differs from the one the listing has.
 */
export function buildMappingPlan(listings: readonly OctorateListing[], decisions: readonly MappingDecision[]): MappingPlan {
  const actions: PlanAction[] = [];
  const later: OctorateListing[] = [];

  for (const listing of listings) {
    const listingId = listing.octorateAccommodationId;
    const decision = findDecision(decisions, listingId);

    if (listing.status === 'Confirmed') {
      const roomId = decision && decision.action !== 'reject' ? decision.roomId : '';
      if (roomId && roomId !== listing.octorateProductId && listing.rooms.some((room) => room.id === roomId)) {
        actions.push({ kind: 'room', listingId, roomId });
      }
      continue;
    }

    if (decision?.action === 'confirm' && decision.propertyId) {
      actions.push({ kind: 'confirm', listingId, propertyId: decision.propertyId, roomId: decision.roomId });
    } else if (decision?.action === 'import') {
      actions.push({ kind: 'import', listingId, roomId: decision.roomId });
    } else if (decision?.action === 'reject') {
      actions.push({ kind: 'reject', listingId });
    } else if (listing.status !== 'Rejected') {
      later.push(listing);
    }
  }

  return { actions, later };
}

/** What became of a listing when the plan ran. */
export type OutcomeKind = 'linked' | 'imported' | 'excluded' | 'room' | 'failed';

export interface ListingOutcome {
  listingId: string;
  kind: OutcomeKind;
  /** The listing was imported as a new property (also when a later step, the room, failed). */
  imported?: boolean;
  /** `failed`: what went wrong, as it was thrown; it is translated where it is shown. */
  error?: unknown;
}

/** How far a run is: the listings done of the listings to do. */
export interface MappingProgress {
  done: number;
  total: number;
}

/** What the plan needs from the server: one call for each kind of action. */
export interface MappingRunner {
  confirm: (listingId: string, propertyId: string, roomId: string) => Promise<unknown>;
  importListing: (listingId: string) => Promise<unknown>;
  reject: (listingId: string) => Promise<unknown>;
  setRoom: (listingId: string, roomId: string) => Promise<unknown>;
}

async function runAction(action: PlanAction, runner: MappingRunner): Promise<ListingOutcome> {
  const { listingId } = action;

  switch (action.kind) {
    case 'confirm':
      await runner.confirm(listingId, action.propertyId, action.roomId);
      return { listingId, kind: 'linked' };
    case 'import':
      await runner.importListing(listingId);
      try {
        if (action.roomId) await runner.setRoom(listingId, action.roomId);
      } catch (error) {
        // The property exists and the listing is confirmed to it: only the room is missing, and a second run sets it.
        return { listingId, kind: 'failed', imported: true, error };
      }
      return { listingId, kind: 'imported', imported: true };
    case 'reject':
      await runner.reject(listingId);
      return { listingId, kind: 'excluded' };
    case 'room':
      await runner.setRoom(listingId, action.roomId);
      return { listingId, kind: 'room' };
  }
}

/**
 * Does what the plan says, one listing after the other (each call reads the channel manager, so they are not sent together). A listing
 * that fails does not stop the others: it is reported with the error, and the host fixes it and runs the rest again. `onProgress` is told
 * after each listing.
 */
export async function runMappingPlan(
  actions: readonly PlanAction[],
  runner: MappingRunner,
  onProgress?: (done: number, total: number) => void,
): Promise<ListingOutcome[]> {
  const outcomes: ListingOutcome[] = [];

  for (const action of actions) {
    try {
      outcomes.push(await runAction(action, runner));
    } catch (error) {
      outcomes.push({ listingId: action.listingId, kind: 'failed', error });
    }
    onProgress?.(outcomes.length, actions.length);
  }
  return outcomes;
}

/** The outcomes of a run laid over those of the runs before it: the last word about a listing wins, and an import is never forgotten. */
export function mergeOutcomes(before: readonly ListingOutcome[], next: readonly ListingOutcome[]): ListingOutcome[] {
  const merged = new Map(before.map((outcome) => [outcome.listingId, outcome]));
  for (const outcome of next) {
    const imported = Boolean(merged.get(outcome.listingId)?.imported || outcome.imported);
    merged.set(outcome.listingId, { ...outcome, imported });
  }
  return [...merged.values()];
}

/** Thrown when some listings could not be done: the wizard stays on the summary, which says which and why. */
export class MappingIncompleteError extends Error {
  failed: number;

  constructor(failed: number) {
    super(`${failed} listing(s) could not be mapped`);
    this.name = 'MappingIncompleteError';
    this.failed = failed;
  }
}

/** How the result of the wizard names a listing: what happened, or where it stands. */
export type ResultKind = 'linked' | 'imported' | 'excluded' | 'later' | 'failed';

export interface ResultRow {
  listing: OctorateListing;
  kind: ResultKind;
  outcome?: ListingOutcome;
}

/**
 * One row for each listing found, from the listings as the server has them and what this visit did. The server says where a listing
 * stands (confirmed, excluded, still to decide); the outcomes add what only this visit knows (imported, or failed). Opened again later
 * there are no outcomes: an imported listing then reads as linked.
 */
export function resultRows(listings: readonly OctorateListing[], outcomes: readonly ListingOutcome[] | null): ResultRow[] {
  const byListing = new Map((outcomes ?? []).map((outcome) => [outcome.listingId, outcome]));

  return listings.map((listing): ResultRow => {
    const outcome = byListing.get(listing.octorateAccommodationId);
    if (outcome?.kind === 'failed') return { listing, kind: 'failed', outcome };
    if (listing.status === 'Confirmed') return { listing, kind: outcome?.imported ? 'imported' : 'linked', outcome };
    if (listing.status === 'Rejected') return { listing, kind: 'excluded', outcome };
    return { listing, kind: 'later', outcome };
  });
}
