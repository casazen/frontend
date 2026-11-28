import { mandateCovers, maskValue, profileGaps, type OwnerReadiness } from '@/features/owner-accounting/owner-accounting-model';
import type { OwnerFiscalProfile, OwnerIssuerProfile, OwnerMandate } from '@/types';
import { isItalianProfile } from './owner-issuer-model';

export type OwnerTab = 'overview' | 'identity' | 'payments' | 'mandate' | 'documents' | 'rule' | 'reports';

export const PATH_TABS = ['identity', 'payments', 'mandate', 'documents', 'rule'] as const;

export type PathTab = (typeof PATH_TABS)[number];

export type StepState = 'done' | 'todo' | 'unknown';

const IDENTITY_GAPS = ['legalName', 'taxResidenceCountry', 'fiscalCode'];
const RULE_GAPS = ['taxJurisdiction', 'revenueRecognitionRule'];
const RULE_BLOCKS = ['policy_missing', 'policy_not_approved', 'policy_not_effective', 'policy_jurisdiction_mismatch'];
const SENSITIVE_FIELDS = ['legalName', 'legalAddress', 'fiscalCode', 'vatNumber', 'foreignTaxId', 'bankAccountReference'];

const isEmpty = (value: string | null | undefined): boolean => value === null || value === undefined || value.trim() === '';

export function parseTab(value: string | null, available: readonly OwnerTab[]): OwnerTab {
  return available.find((tab) => tab === value) ?? 'overview';
}

export function tabSearch(params: URLSearchParams, tab: OwnerTab): string {
  const next = new URLSearchParams(params);
  if (tab === 'overview') next.delete('tab');
  else next.set('tab', tab);
  const query = next.toString();
  return query ? `?${query}` : '';
}

export function shownValue(profile: OwnerFiscalProfile, field: string, value: string | null, revealed: boolean): string | null {
  return SENSITIVE_FIELDS.includes(field) && !profile.masked && !revealed ? maskValue(value) : value;
}

export function identityState(readiness: OwnerReadiness): StepState {
  const profile = readiness.profile;
  if (!profile) return 'todo';
  const gaps = profileGaps(profile);
  return IDENTITY_GAPS.some((gap) => gaps.includes(gap)) ? 'todo' : 'done';
}

export function paymentsState(readiness: OwnerReadiness): StepState {
  const profile = readiness.profile;
  if (!profile) return 'todo';
  return isEmpty(profile.settlementCurrency) || isEmpty(profile.bankAccountReference) ? 'todo' : 'done';
}

export function mandateState(versions: readonly OwnerMandate[] | undefined, today: string): StepState {
  if (!versions) return 'unknown';
  return versions.some((mandate) => mandateCovers(mandate, today)) ? 'done' : 'todo';
}

export function documentsState(issuer: OwnerIssuerProfile | null | undefined): StepState {
  if (!issuer || !isItalianProfile(issuer)) return 'unknown';
  return issuer.exists && issuer.canIssue ? 'done' : 'todo';
}

export function ruleState(readiness: OwnerReadiness): StepState {
  if (readiness.ready) return 'done';
  if (!readiness.profile || !readiness.policy || !readiness.policy.approved) return 'todo';
  const ruleGap = readiness.gaps.some((gap) => RULE_GAPS.includes(gap));
  return ruleGap || RULE_BLOCKS.includes(readiness.reason) ? 'todo' : 'done';
}

export function completedSteps(states: readonly StepState[]): { done: number; total: number } {
  const known = states.filter((state) => state !== 'unknown');
  return { done: known.filter((state) => state === 'done').length, total: known.length };
}
