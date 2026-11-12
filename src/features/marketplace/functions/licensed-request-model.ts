import { isAxiosError } from 'axios';
import { getProblemCode } from '@/lib/api-errors';
import type { MarketplaceEntryDetail, MarketplaceFunction, MarketplaceFunctionList, MarketplaceFunctionStatus, Property } from '@/types';

/**
 * The model of the guided request of a function of the channel manager's license (E09/F02/US04/T03, NF-56, MKT-03, PO-12, D21): CasaZen cannot switch a module of the
 * license on, so the wizard explains the function, prepares the request the person makes to the channel manager and records it as Requested until the license shows
 * the module. No React in it: the page and the steps read it.
 */

/** The steps of the wizard in their order; the result is the done screen of the shell (`WIZARD_DONE_STEP`, `?step=fatto`). */
export const LICENSED_STEP = { function: 'function', property: 'property', ask: 'ask' } as const;

/** What the wizard keeps for the draft: the property the request is for (a function is licensed for one property; the request names exactly one). */
export interface LicensedRequestValues {
  propertyId: string;
}

export const LICENSED_REQUEST_DEFAULTS: LicensedRequestValues = { propertyId: '' };

/** Raise it when the shape of the values changes: a draft written for the old shape is ignored. */
export const LICENSED_DRAFT_VERSION = 1;

/**
 * What the page reads for the steps (the detail card of the function, the properties of the host) and hands to them. The license of the property is read by the steps,
 * each for the property that is chosen when it is shown.
 */
export interface LicensedContext {
  moduleCode: string;
  /** The detail card of the function (what it does, for whom, its cost): it does not depend on a property. */
  entry: MarketplaceEntryDetail | undefined;
  entryStatus: 'pending' | 'error' | 'ready';
  /** The short-rent properties of the host the caller reaches: a function is licensed for one of them. */
  properties: readonly Property[];
  propertiesStatus: 'pending' | 'error' | 'ready';
  /** Reads the card and the properties again. */
  onRetry: () => void;
}

/** The name the draft of the wizard is kept under: one for each module, so a draft of one function never opens another one. */
export function licensedWizardId(moduleCode: string): string {
  return `marketplace-licensed-${moduleCode}`;
}

/** The function the wizard is about, in the list of the license of the property; `undefined` when the module is not one of the list. */
export function functionOf(list: MarketplaceFunctionList | undefined, moduleCode: string): MarketplaceFunction | undefined {
  return list?.functions.find((candidate) => candidate.code === moduleCode);
}

/** What the screen says of the request, by what the server says of the function. */
export type RequestPhase = 'notRequested' | 'requested' | 'active' | 'toFix';

const PHASE_OF_STATUS: Readonly<Record<MarketplaceFunctionStatus, RequestPhase>> = {
  NotActive: 'notRequested',
  Requested: 'requested',
  Active: 'active',
  ToFix: 'toFix',
};

export function requestPhase(entry: Pick<MarketplaceFunction, 'status'> | undefined): RequestPhase {
  return entry ? PHASE_OF_STATUS[entry.status] : 'notRequested';
}

/** What is known of the license of the property: the plan and the limit of rooms of the last read, which are `null` until a live read. */
export interface LicenseSummary {
  tier: string | null;
  roomsLimit: number | null;
  /** A read of the license happened: before it the plan and the limit are not known, and the screen says so instead of inventing them. */
  known: boolean;
  /** The limit read is 0: without a license per room no prices and no availability are published. */
  noRoomLicense: boolean;
  readAt: string | null;
}

export function licenseSummary(list: MarketplaceFunctionList | undefined): LicenseSummary | null {
  if (!list) return null;
  return { tier: list.tier, roomsLimit: list.roomsLimit, known: list.licenseReadAt !== null, noRoomLicense: list.noRoomLicense, readAt: list.licenseReadAt };
}

/** What stopped a read or a request of the license, by the code of the answer: told in simple words by the step, never as a raw error. */
export type LicensedProblem = 'notLinked' | 'notConnected' | 'alreadyActive' | 'unknownFunction' | 'propertyNotFound' | 'other';

export function licensedProblemOf(error: unknown): LicensedProblem | null {
  if (!error) return null;
  const code = isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
  switch (code) {
    case 'marketplace_property_not_linked':
      return 'notLinked';
    case 'marketplace_octorate_not_connected':
      return 'notConnected';
    case 'marketplace_function_already_active':
      return 'alreadyActive';
    case 'marketplace_function_unknown':
      return 'unknownFunction';
    case 'marketplace_property_not_found':
      return 'propertyNotFound';
    default:
      return 'other';
  }
}

/** The code of the answer that refused a call, or `null`. */
export function licensedProblemCode(error: unknown): string | null {
  return isAxiosError(error) ? (getProblemCode(error.response?.data) ?? null) : null;
}

/**
 * The text the person takes to the channel manager: the one the server prepared with the name of the function and of the property put in, in the language of the
 * page. `null` when there is none (a function that is Active needs no request): the wizard never writes one of its own.
 */
export function guidanceOf(entry: Pick<MarketplaceFunction, 'requestGuidance'> | undefined): string | null {
  const text = entry?.requestGuidance?.trim();
  return text ? text : null;
}

/** What a cost says: the text the backend sent, or `null` for «not specified». A price is never made up. */
export function costTextOf(cost: { text: string | null } | undefined): string | null {
  const text = cost?.text?.trim();
  return text ? text : null;
}
