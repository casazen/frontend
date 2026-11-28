import { nightsBetween, parseStayDate } from '@/lib/stay-dates';
import type {
  HighTensionAreaStatus,
  LeaseContractType,
  LeaseDetail,
  LeaseStage,
  LeaseTaxRegime,
  LongRentRules,
} from '@/types';
import { isLeasePlaceholderDate } from '../lib/lease-list-format';
import { isServiceDraft } from '../lib/lease-sheet';
import { leaseTermEnd } from '../lifecycle/lifecycle-format';

export const GUIDE_PHASES = ['draft', 'signing', 'toRegister', 'active', 'expiring', 'concluded'] as const;
export type GuidePhase = (typeof GUIDE_PHASES)[number];

const STAGE_PHASE: Readonly<Record<LeaseStage, GuidePhase>> = {
  Draft: 'draft',
  DataPending: 'draft',
  InReview: 'signing',
  SentForSignature: 'signing',
  Signed: 'toRegister',
  Active: 'active',
  Expiring: 'expiring',
  Concluded: 'concluded',
};

export function phaseOf(
  lease: Pick<LeaseDetail, 'status' | 'sentForSignatureAt' | 'noticeOn' | 'terminatedOn'>,
  stage: LeaseStage | undefined,
): GuidePhase {
  if (stage && Object.hasOwn(STAGE_PHASE, stage)) return STAGE_PHASE[stage];
  switch (lease.status) {
    case 'Draft':
      return lease.sentForSignatureAt ? 'signing' : 'draft';
    case 'AwaitingSignature':
    case 'PartiallySigned':
      return 'signing';
    case 'Signed':
    case 'RegistrationPending':
    case 'SentToProvider':
      return 'toRegister';
    case 'Registered':
      return lease.noticeOn || lease.terminatedOn ? 'expiring' : 'active';
    case 'Rejected':
      return 'concluded';
  }
}

export interface GuideFacts {
  type: LeaseContractType;
  phase: GuidePhase;
  taxRegime: LeaseTaxRegime | null;
  monthlyRent: number;
  depositMonths: number | null;
  hasDeposit: boolean;
  depositOverMax: boolean;
  extraEu: boolean;
  partnerDraft: boolean;
  viaService: boolean;
  registered: boolean;
  hasReceipt: boolean;
  /** The Questura communication was declared (the lease has the event for it). */
  questuraDeclared: boolean;
  /** The step of «Cosa devi fare ora» the sheet shows, so that the guide does not say it twice; `null` when the sheet shows none. */
  stepCode: string | null;
  startPassed: boolean;
  daysToRegistration: number | null;
  daysSinceRegistration: number | null;
  daysToEnd: number | null;
  termDays: number | null;
  shortTransitory: boolean;
  noticeRecorded: boolean;
  terminated: boolean;
  termRenewed: boolean;
  landlordConfirmsNeed: boolean | undefined;
  rentOutOfRange: boolean;
  ata: HighTensionAreaStatus | undefined;
  hasAttestation: boolean | undefined;
  imuApplicable: boolean | undefined;
  rules: LongRentRules | undefined;
}

export interface GuideInputs {
  lease: LeaseDetail;
  stage: LeaseStage | undefined;
  stepCode: string | null;
  today: string;
  rules: LongRentRules | undefined;
  ata: HighTensionAreaStatus | undefined;
  hasAttestation: boolean | undefined;
  imuApplicable: boolean | undefined;
  landlordConfirmsNeed?: boolean;
}

export function daysFromTo(from: string | null | undefined, to: string | null | undefined): number | null {
  const a = parseStayDate(from);
  const b = parseStayDate(to);
  if (!a || !b) return null;
  return b >= a ? nightsBetween(a, b) : -nightsBetween(b, a);
}

const MONTHS_EPSILON = 0.001;

export function buildGuideFacts(inputs: GuideInputs): GuideFacts {
  const { lease, stage, stepCode, today, rules } = inputs;
  const realDates = !isLeasePlaceholderDate(lease.startDate) && !isLeasePlaceholderDate(lease.endDate);
  const days = realDates ? daysFromTo(lease.startDate, lease.endDate) : null;
  const events = lease.events ?? [];
  const has = (eventType: string) => events.some((event) => event.eventType === eventType);
  const registered = lease.status === 'Registered';
  const depositMonths = lease.securityDeposit != null && lease.monthlyRent > 0 ? lease.securityDeposit / lease.monthlyRent : null;
  const registrationDay = lease.registration?.registrationDate ?? null;
  const termDays = days !== null && days > 0 ? days + 1 : null;

  return {
    type: lease.contractType,
    phase: phaseOf(lease, stage),
    taxRegime: lease.taxRegime,
    monthlyRent: lease.monthlyRent,
    depositMonths,
    hasDeposit: (lease.securityDeposit ?? 0) > 0,
    depositOverMax: !!rules && depositMonths !== null && depositMonths > rules.depositMaxRents + MONTHS_EPSILON,
    extraEu: lease.hasExtraEUTenant || (lease.parties ?? []).some((party) => party.role === 'Tenant' && party.isExtraEU),
    partnerDraft: isServiceDraft(lease),
    viaService: lease.isConcordatoFacileSource === true,
    registered,
    hasReceipt: lease.registration?.hasReceipt === true,
    questuraDeclared: has('QuesturaCommunicationMarkedDone'),
    stepCode,
    startPassed: realDates && (daysFromTo(today, lease.startDate) ?? 0) < 0,
    daysToRegistration: registered ? null : daysFromTo(today, lease.registrationDeadline),
    daysSinceRegistration: registrationDay ? daysFromTo(registrationDay, today) : null,
    daysToEnd: realDates ? daysFromTo(today, leaseTermEnd(lease)) : null,
    termDays,
    shortTransitory: lease.contractType === 'Transitorio' && !!rules && termDays !== null && termDays <= rules.transitoryDocumentationAfterDays,
    noticeRecorded: !!lease.noticeOn,
    terminated: !!lease.terminatedOn,
    termRenewed: has('TermRenewed') || has('RenewalRecorded'),
    landlordConfirmsNeed: inputs.landlordConfirmsNeed,
    rentOutOfRange: lease.concordatoAssessment?.rentWithinRange === false,
    ata: inputs.ata,
    hasAttestation: inputs.hasAttestation,
    imuApplicable: inputs.imuApplicable,
    rules,
  };
}

export function guideValues(facts: GuideFacts, language: string): Record<string, string | number> {
  const values: Record<string, string | number> = {};
  const rules = facts.rules;
  if (rules) {
    values.registrationDays = rules.registrationDays;
    values.noticeMonths = rules.noticeMonths;
    values.depositMaxRents = rules.depositMaxRents;
    values.transitoryMax = rules.transitoryTermMonths.max;
    values.transitoryDocDays = rules.transitoryDocumentationAfterDays;
    const term = rules.termMonths[facts.type];
    if (term !== undefined) values.termMonths = term;
    const renewal = rules.renewalMonths[facts.type];
    if (renewal !== undefined) values.renewalMonths = renewal;
  }
  if (facts.depositMonths !== null) {
    values.depositMonths = new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(facts.depositMonths);
  }
  return values;
}
