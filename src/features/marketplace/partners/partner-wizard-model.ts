import { isAxiosError } from 'axios';
import { getProblemCode } from '@/lib/api-errors';
import { formatStayDate, isStayDate, todayInRome, utcStayDate } from '@/lib/stay-dates';
import type { MarketplacePartnerActivation, MarketplacePartnerBrief, MarketplacePartnerPropertyData } from '@/types';
import { marketplaceHref, marketplacePartnerActivationPath } from '../lib/marketplace-paths';
import { withReturnTo } from '../lib/return-to';

/**
 * The model of the hand-off wizard of a Partner Hub partner (E09/F02/US04/T04, NF-56, MKT-03, S18, Q-006): the activation happens on the partner's own site, so the
 * wizard prepares what the partner will ask, opens the partner's site in the same tab, welcomes the person back and records the activation as declared by them, with a
 * date. No React in it: the page and the steps read it.
 */

/** The steps of the wizard in their order; the result is the done screen of the shell (`WIZARD_DONE_STEP`, `?step=fatto`). */
export const PARTNER_STEP = { prepare: 'prepare', handoff: 'handoff', welcomeBack: 'welcome-back' } as const;

/** What the wizard keeps for the draft: the day the person says they did the activation (a day, not a secret). */
export interface PartnerWizardValues {
  declaredOn: string;
}

/** Raise it when the shape of the values changes: a draft written for the old shape is ignored. */
export const PARTNER_DRAFT_VERSION = 1;

/** The name the draft of the wizard is kept under: one for each partner, so a draft of one partner never opens another one. */
export function partnerWizardId(code: string): string {
  return `marketplace-partner-${code}`;
}

/** The values a wizard starts from: the activation was done today, until the person says another day. `today` is the day in Rome. */
export function partnerDefaults(today: string = todayInRome()): PartnerWizardValues {
  return { declaredOn: today };
}

/** What the page reads for the steps: the brief of the partner (what the host takes to its site) and the property it was asked for. */
export interface PartnerContext {
  code: string;
  /** The property the marketplace was about, from the address: its data is in the brief and the declaration is for it. `undefined` is the whole organization. */
  propertyId: string | undefined;
  brief: MarketplacePartnerBrief | undefined;
  briefStatus: 'pending' | 'error' | 'ready';
  briefError: unknown;
  /** Reads the brief again. */
  onRetry: () => void;
}

/** The fields of the property that the brief may carry, in the order they are asked for on a partner's site. */
export const BRIEF_FIELDS = ['name', 'address', 'city', 'postalCode', 'bedrooms', 'bathrooms', 'maxGuests', 'cinCode'] as const;
export type BriefField = (typeof BRIEF_FIELDS)[number];

export interface BriefRow {
  field: BriefField;
  /** What the person copies; `null` when the brief has no value (the CIN only comes when it is valid). */
  value: string | null;
}

/** The rows of the brief's property data, one for each field of the fixed list, nothing more: no guest, no booking, no price, no document. */
export function briefRows(data: MarketplacePartnerPropertyData | null | undefined): BriefRow[] {
  if (!data) return [];
  const text = (value: string | null | undefined) => (value && value.trim() !== '' ? value : null);
  return [
    { field: 'name', value: text(data.name) },
    { field: 'address', value: text(data.address) },
    { field: 'city', value: text(data.city) },
    { field: 'postalCode', value: text(data.postalCode) },
    { field: 'bedrooms', value: String(data.bedrooms) },
    { field: 'bathrooms', value: String(data.bathrooms) },
    { field: 'maxGuests', value: String(data.maxGuests) },
    { field: 'cinCode', value: text(data.cinCode) },
  ];
}

/**
 * The address of the step the person comes back to, with the property and the page they came from: the hand-off replaces its own history entry with this one before it
 * leaves for the partner's site, so that the browser's Back button, and the draft, land here with the `returnTo` of the wizard (it lives only in the address).
 */
export function welcomeBackPath(code: string, propertyId: string | undefined, returnTo: string | null): string {
  return withReturnTo(marketplaceHref(marketplacePartnerActivationPath(code), propertyId, { step: PARTNER_STEP.welcomeBack }), returnTo);
}

/** What is wrong with the day the person gave: nothing, it is missing or not a day, or it is after today (an activation cannot have been done tomorrow). */
export type DeclaredDayProblem = 'missing' | 'invalid' | 'future';

export function declaredDayProblem(value: string, today: string = todayInRome()): DeclaredDayProblem | null {
  const day = value.trim();
  if (day === '') return 'missing';
  if (!isStayDate(day)) return 'invalid';
  return day > today ? 'future' : null;
}

/** How the activation is labelled after the declaration: «declared by you on <day>», and only «verified» when the backend says so (a connection showed it active). */
export interface DeclarationLabel {
  kind: 'declared' | 'verified';
  /** The day, `YYYY-MM-DD`; `null` when the backend gave none. */
  day: string | null;
}

/** The day the host gave: `declaredAt` is midnight UTC of that day, so its date is the UTC one. */
export function declaredDayOf(declaredAt: string | null | undefined): string | null {
  if (!declaredAt) return null;
  const at = new Date(declaredAt);
  return Number.isNaN(at.getTime()) ? null : utcStayDate(at);
}

export function declarationLabel(activation: Pick<MarketplacePartnerActivation, 'isDeclared' | 'declaredAt' | 'verifiedAt'>): DeclarationLabel {
  // «Verified» is never the client's word: only a verification the backend recorded, on an activation that is no longer only declared.
  const verified = activation.verifiedAt !== null && !activation.isDeclared;
  return { kind: verified ? 'verified' : 'declared', day: declaredDayOf(activation.declaredAt) };
}

/** The day as the person reads it, in the language of the page; empty when there is none. */
export function dayText(day: string | null, language: string): string {
  return day ? formatStayDate(day, language) : '';
}

/** What stopped a read of the brief or the declaration, by the code of the answer: told in simple words by the step. */
export type PartnerProblem = 'notFound' | 'propertyNotFound' | 'needsWholeOrg' | 'dateInvalid' | 'other';

export function partnerProblemOf(error: unknown): PartnerProblem | null {
  if (!error) return null;
  const code = isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
  switch (code) {
    case 'marketplace_entry_not_found':
      return 'notFound';
    case 'marketplace_property_not_found':
      return 'propertyNotFound';
    case 'marketplace_partner_needs_whole_org':
      return 'needsWholeOrg';
    case 'marketplace_declared_date_invalid':
      return 'dateInvalid';
    default:
      return 'other';
  }
}
