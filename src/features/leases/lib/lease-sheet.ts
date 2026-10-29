import { LEASE_DRAFT_PLACEHOLDER_DATE, type LeaseDetail } from '@/types';

/**
 * The tabs of the sheet of a lease, in the order they are shown. The names are those of the address (`?tab=`): they never change.
 * `guida` is the first and the one the sheet opens on (LR-GUIDE-1): what to do about the contract, with the tools to decide it; `dati`
 * holds only the data of the contract.
 */
export const LEASE_TABS = ['guida', 'dati', 'documenti', 'pagamenti', 'scadenze'] as const;
export type LeaseTab = (typeof LEASE_TABS)[number];

/** The tab the sheet opens on when the address says none (or one that does not exist). */
export const DEFAULT_LEASE_TAB: LeaseTab = 'guida';

/** Addresses of the old page and of the design that lead to the tab holding what they showed. */
const LEGACY_TABS: Readonly<Record<string, LeaseTab>> = { canoni: 'pagamenti', cronologia: 'dati', panoramica: 'dati' };

function isLeaseTab(value: string): value is LeaseTab {
  return (LEASE_TABS as readonly string[]).includes(value);
}

/** The tab an address asks for: a tab, an old name of one, or `fallback` for anything else (and for no parameter at all). */
export function leaseTabOf(param: string | null, fallback: LeaseTab): LeaseTab {
  if (param === null) return fallback;
  if (isLeaseTab(param)) return param;
  return Object.hasOwn(LEGACY_TABS, param) ? LEGACY_TABS[param] : fallback;
}

export type LeaseEventActor = 'casazen' | 'you';

/**
 * Who did it, told from the type of the event: the API sends no author. Only what the type settles is here: the landlord
 * declares, uploads, exports and sends; CasaZen reminds and records a failure. An event either of them can cause (a signature
 * given or uploaded, a registration confirmed by hand or by the provider) has no actor, rather than a wrong one.
 */
const EVENT_ACTORS: Readonly<Record<string, LeaseEventActor>> = {
  Created: 'you',
  DeadlineReminderSent: 'casazen',
  ErasureRequested: 'you',
  Imported: 'you',
  ImuNotificationExported: 'you',
  ImuNotificationMarkedSent: 'you',
  NoticeRecorded: 'you',
  NoticeRemoved: 'you',
  PropertyDeliveryDateDeclared: 'you',
  QuesturaCommunicationMarkedDone: 'you',
  RegistrationAuthorized: 'you',
  RegistrationFailed: 'casazen',
  RegistrationSubmitted: 'you',
  ReviewConfirmed: 'you',
  RliExported: 'you',
  SentForSignature: 'you',
  SentRevoked: 'you',
  SigningInitiated: 'you',
  StipulaDeclared: 'you',
  TermRenewed: 'casazen',
  Terminated: 'you',
  LetterSent: 'you',
  WithdrawalRecorded: 'you',
};

export function leaseEventActor(eventType: string): LeaseEventActor | undefined {
  return Object.hasOwn(EVENT_ACTORS, eventType) ? EVENT_ACTORS[eventType] : undefined;
}

/**
 * A canone concordato draft made for the partner (ConcordatoFacile): saved with only its property, so its dates are still the
 * starting value of the API. The contract comes from the partner: the page shows the draft waiting for it, not the signature of
 * a contract of CasaZen.
 */
export function isPartnerDraft(lease: Pick<LeaseDetail, 'status' | 'contractType' | 'startDate'>): boolean {
  return lease.status === 'Draft' && lease.contractType === 'Concordato' && lease.startDate.startsWith(LEASE_DRAFT_PLACEHOLDER_DATE);
}
