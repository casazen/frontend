import { LEASE_DRAFT_PLACEHOLDER_DATE, type LeaseDetail } from '@/types';

export const LEASE_TABS = ['dati', 'inquilini', 'documenti', 'pagamenti', 'scadenze', 'guida'] as const;
export type LeaseTab = (typeof LEASE_TABS)[number];

export const DEFAULT_LEASE_TAB: LeaseTab = 'dati';

const LEGACY_TABS: Readonly<Record<string, LeaseTab>> = { canoni: 'pagamenti', cronologia: 'dati', panoramica: 'dati' };

function isLeaseTab(value: string): value is LeaseTab {
  return (LEASE_TABS as readonly string[]).includes(value);
}

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
  DepositReturnRecorded: 'you',
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
  RenewalRecorded: 'you',
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

/**
 * A draft of the guided service (CF-DONE): the one made for it (`isPartnerDraft`, saved with only its property) or one the server has
 * marked as the service's (`isConcordatoFacileSource`: the documents the service delivers were read into it, so it no longer looks like
 * a draft with nothing in it). Its data are never typed in the wizard: the sheet shows the state of the practice and the draft moves on
 * (signed, registered) as the practice does, once the documents are uploaded.
 */
export function isServiceDraft(lease: Pick<LeaseDetail, 'status' | 'contractType' | 'startDate' | 'isConcordatoFacileSource'>): boolean {
  return lease.status === 'Draft' && (isPartnerDraft(lease) || lease.isConcordatoFacileSource === true);
}
