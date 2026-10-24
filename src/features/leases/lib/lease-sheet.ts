import { LEASE_DRAFT_PLACEHOLDER_DATE, type LeaseDetail, type LeaseStatus } from '@/types';

/** The tabs of the sheet of a lease, in the order they are shown. The names are those of the address (`?tab=`): they never change. */
export const LEASE_TABS = ['dati', 'documenti', 'pagamenti', 'scadenze'] as const;
export type LeaseTab = (typeof LEASE_TABS)[number];

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

/**
 * The tab a lease opens on: where the thing to do is. Before the signature that is the signature (Documenti); signed and not
 * yet registered, the registration and its deadline (Scadenze); a registered lease opens on its data. It is only where the page
 * opens, never a statement about the lease: the server will say what comes next (stage and next step, LR-01b) and the page can
 * follow it then.
 */
export function defaultLeaseTab(status: LeaseStatus): LeaseTab {
  switch (status) {
    case 'Draft':
    case 'AwaitingSignature':
    case 'PartiallySigned':
      return 'documenti';
    case 'Signed':
    case 'RegistrationPending':
    case 'SentToProvider':
    case 'Rejected':
      return 'scadenze';
    default:
      return 'dati';
  }
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
