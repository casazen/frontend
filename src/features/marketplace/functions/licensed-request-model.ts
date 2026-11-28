import { isAxiosError } from 'axios';
import { getProblemCode } from '@/lib/api-errors';
import type { MarketplaceEntryDetail, MarketplaceFunction, MarketplaceFunctionList, MarketplaceFunctionStatus, Property } from '@/types';

export const LICENSED_STEP = { function: 'function', property: 'property', ask: 'ask' } as const;

export interface LicensedRequestValues {
  propertyId: string;
}

export const LICENSED_REQUEST_DEFAULTS: LicensedRequestValues = { propertyId: '' };

export const LICENSED_DRAFT_VERSION = 1;

export interface LicensedContext {
  moduleCode: string;
  entry: MarketplaceEntryDetail | undefined;
  entryStatus: 'pending' | 'error' | 'ready';
  properties: readonly Property[];
  propertiesStatus: 'pending' | 'error' | 'ready';
  onRetry: () => void;
}

export function licensedWizardId(moduleCode: string): string {
  return `marketplace-licensed-${moduleCode}`;
}

export function functionOf(list: MarketplaceFunctionList | undefined, moduleCode: string): MarketplaceFunction | undefined {
  return list?.functions.find((candidate) => candidate.code === moduleCode);
}

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

export interface LicenseSummary {
  tier: string | null;
  roomsLimit: number | null;
  /** A read of the license happened: before it the plan and the limit are not known, and the screen says so instead of inventing them. */
  known: boolean;
  noRoomLicense: boolean;
  readAt: string | null;
}

export function licenseSummary(list: MarketplaceFunctionList | undefined): LicenseSummary | null {
  if (!list) return null;
  return { tier: list.tier, roomsLimit: list.roomsLimit, known: list.licenseReadAt !== null, noRoomLicense: list.noRoomLicense, readAt: list.licenseReadAt };
}

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

export function licensedProblemCode(error: unknown): string | null {
  return isAxiosError(error) ? (getProblemCode(error.response?.data) ?? null) : null;
}

export function guidanceOf(entry: Pick<MarketplaceFunction, 'requestGuidance'> | undefined): string | null {
  const text = entry?.requestGuidance?.trim();
  return text ? text : null;
}

export function costTextOf(cost: { text: string | null } | undefined): string | null {
  const text = cost?.text?.trim();
  return text ? text : null;
}
