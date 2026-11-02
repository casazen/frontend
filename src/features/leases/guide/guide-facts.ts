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
import { isPartnerDraft } from '../lib/lease-sheet';
import { leaseTermEnd } from '../lifecycle/lifecycle-format';

/**
 * Where a lease is on its way, as far as the guide cares: being prepared, in review or out for the signature, signed and waiting to
 * be registered, registered and running, running out, over. They are the eight stages the server sends (`LeaseStage`) folded into the
 * six moments in which different advice is worth giving.
 */
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

/**
 * The phase of a lease. The stage is the server's and is never worked out here; only when the server did not say it (the list did not
 * answer) the status of the lease and the notice or early end it carries put it in the nearest phase.
 */
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

/**
 * What the catalogue asks about a lease to decide which advice is for it (conditions on the data). Everything is plain: no function,
 * no date to parse. A fact the server has not answered yet is `undefined` and an advice that needs it waits for it.
 */
export interface GuideFacts {
  type: LeaseContractType;
  phase: GuidePhase;
  /** The tax regime of the contract; `null` for an older canone concordato that never said it. */
  taxRegime: LeaseTaxRegime | null;
  monthlyRent: number;
  /** The security deposit in months of rent; `null` without a deposit or without a rent. */
  depositMonths: number | null;
  hasDeposit: boolean;
  /** The deposit is above the limit of the rules; `false` while the rules are not known. */
  depositOverMax: boolean;
  extraEu: boolean;
  /** A draft made for the guided service: its contract, range and attestation come from there. */
  partnerDraft: boolean;
  /** The contract was prepared with the guided service (also an imported one that came from there). */
  viaService: boolean;
  registered: boolean;
  hasReceipt: boolean;
  /** The Questura communication was declared (the lease has the event for it). */
  questuraDeclared: boolean;
  /** The step of «Cosa devi fare ora» the sheet shows, so that the guide does not say it twice; `null` when the sheet shows none. */
  stepCode: string | null;
  /** The start date is a real day and is already past. */
  startPassed: boolean;
  /** Days to the registration deadline of a contract not registered yet (negative once it has passed); `null` without a deadline. */
  daysToRegistration: number | null;
  /** Days the registration happened ago; `null` when it has not or the day is unknown. */
  daysSinceRegistration: number | null;
  /** Days to the end of the period in force; `null` when unknown. */
  daysToEnd: number | null;
  /** Days the first period lasts, both ends included; `null` while the dates are not typed. */
  termDays: number | null;
  /** A transitory contract short enough to be free of the documents that prove its need; `false` while the rules are not known. */
  shortTransitory: boolean;
  noticeRecorded: boolean;
  terminated: boolean;
  /** The lease went through at least one renewal: the tacit one, or one the landlord recorded (LR-OPS-1). */
  termRenewed: boolean;
  /** The need of a transitory lease is the landlord's to confirm in writing (the letter can be prepared); `undefined` until the operations arrived. */
  landlordConfirmsNeed: boolean | undefined;
  /** A canone concordato was calculated at creation and its rent is outside the range of the agreement. */
  rentOutOfRange: boolean;
  /** The comune is ad alta tensione abitativa as CasaZen knows it; known once the tax advisory arrived. */
  ata: HighTensionAreaStatus | undefined;
  /** The lease has an attestation among its documents; known once the documents arrived (asked only for a canone concordato). */
  hasAttestation: boolean | undefined;
  /** The IMU communication can be prepared for this lease; known once the server answered (asked only for a registered concordato). */
  imuApplicable: boolean | undefined;
  /** The figures of the area as the server states them: no figure of law is written in the interface. */
  rules: LongRentRules | undefined;
}

export interface GuideInputs {
  lease: LeaseDetail;
  stage: LeaseStage | undefined;
  stepCode: string | null;
  /** Today in Europe/Rome (`YYYY-MM-DD`). */
  today: string;
  rules: LongRentRules | undefined;
  ata: HighTensionAreaStatus | undefined;
  hasAttestation: boolean | undefined;
  imuApplicable: boolean | undefined;
  /** The need of a transitory lease is the landlord's to confirm; known once the operations of the lease arrived. */
  landlordConfirmsNeed?: boolean;
}

/** Days from `from` to `to` (both days as the API writes them): negative when `to` is before `from`, `null` when one is not a day. */
export function daysFromTo(from: string | null | undefined, to: string | null | undefined): number | null {
  const a = parseStayDate(from);
  const b = parseStayDate(to);
  if (!a || !b) return null;
  return b >= a ? nightsBetween(a, b) : -nightsBetween(b, a);
}

/** A rounding that does not make 3.0000001 months look like a different deposit from 3. */
const MONTHS_EPSILON = 0.001;

/** The facts the catalogue reasons on, from the lease and from what the server said about it. */
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
    partnerDraft: isPartnerDraft(lease),
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

/**
 * The numbers the texts of the advice take, from the rules of the server and from the lease (`{{registrationDays}}`, `{{noticeMonths}}`…).
 * A value that is not known is not in the answer, and an advice whose text needs it is not offered (it asks for the rules).
 */
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
