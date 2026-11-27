import { isAxiosError } from 'axios';
import { getProblemCode } from '@/lib/api-errors';
import { formatStayDate, isStayDate, todayInRome, utcStayDate } from '@/lib/stay-dates';
import type { MarketplacePartnerActivation, MarketplacePartnerBrief, MarketplacePartnerPropertyData } from '@/types';
import { marketplaceHref, marketplacePartnerActivationPath } from '../lib/marketplace-paths';
import { withReturnTo } from '../lib/return-to';

export const PARTNER_STEP = { prepare: 'prepare', handoff: 'handoff', welcomeBack: 'welcome-back' } as const;

export interface PartnerWizardValues {
  declaredOn: string;
}

export const PARTNER_DRAFT_VERSION = 1;

export function partnerWizardId(code: string): string {
  return `marketplace-partner-${code}`;
}

export function partnerDefaults(today: string = todayInRome()): PartnerWizardValues {
  return { declaredOn: today };
}

export interface PartnerContext {
  code: string;
  propertyId: string | undefined;
  brief: MarketplacePartnerBrief | undefined;
  briefStatus: 'pending' | 'error' | 'ready';
  briefError: unknown;
  onRetry: () => void;
}

export const BRIEF_FIELDS = ['name', 'address', 'city', 'postalCode', 'bedrooms', 'bathrooms', 'maxGuests', 'cinCode'] as const;
export type BriefField = (typeof BRIEF_FIELDS)[number];

export interface BriefRow {
  field: BriefField;
  /** What the person copies; `null` when the brief has no value (the CIN only comes when it is valid). */
  value: string | null;
}

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

export type DeclaredDayProblem = 'missing' | 'invalid' | 'future';

export function declaredDayProblem(value: string, today: string = todayInRome()): DeclaredDayProblem | null {
  const day = value.trim();
  if (day === '') return 'missing';
  if (!isStayDate(day)) return 'invalid';
  return day > today ? 'future' : null;
}

export interface DeclarationLabel {
  kind: 'declared' | 'verified';
  day: string | null;
}

export function declaredDayOf(declaredAt: string | null | undefined): string | null {
  if (!declaredAt) return null;
  const at = new Date(declaredAt);
  return Number.isNaN(at.getTime()) ? null : utcStayDate(at);
}

export function declarationLabel(activation: Pick<MarketplacePartnerActivation, 'isDeclared' | 'declaredAt' | 'verifiedAt'>): DeclarationLabel {
  const verified = activation.verifiedAt !== null && !activation.isDeclared;
  return { kind: verified ? 'verified' : 'declared', day: declaredDayOf(activation.declaredAt) };
}

export function dayText(day: string | null, language: string): string {
  return day ? formatStayDate(day, language) : '';
}

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
