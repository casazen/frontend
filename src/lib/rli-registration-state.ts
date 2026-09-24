import type { LeaseRegistration, LeaseStatus } from '@/types';

/**
 * What the landlord must know about the RLI registration of a lease (LT-01, A7-01):
 * - `notSigned`: the contract is not signed by every party yet, nothing to register;
 * - `toRegister`: signed and not registered: the landlord registers it (manual path, or the provider when available);
 * - `inProgress`: a provider is working on it (provider path only): NOT registered yet;
 * - `registered`: registration recorded with its receipt;
 * - `failed`: the last provider attempt failed: NOT registered, retry or register manually.
 */
export type RliRegistrationState = 'notSigned' | 'toRegister' | 'inProgress' | 'registered' | 'failed';

const IN_PROGRESS_LEASE_STATUSES: LeaseStatus[] = ['RegistrationPending', 'SentToProvider'];

export function getRliRegistrationState(
  leaseStatus: LeaseStatus,
  registration?: LeaseRegistration | null,
): RliRegistrationState {
  if (leaseStatus === 'Registered' && registration?.status === 'Registered') return 'registered';
  if (
    IN_PROGRESS_LEASE_STATUSES.includes(leaseStatus) ||
    registration?.status === 'Pending' ||
    registration?.status === 'SentToProvider'
  ) {
    return 'inProgress';
  }
  if (leaseStatus === 'Signed') return registration?.status === 'Failed' ? 'failed' : 'toRegister';
  return 'notSigned';
}

/** While a provider works on the registration the lease is polled, so the page shows the outcome when it arrives. */
export function isRliRegistrationInProgress(leaseStatus?: LeaseStatus): boolean {
  return !!leaseStatus && IN_PROGRESS_LEASE_STATUSES.includes(leaseStatus);
}

/** Anchor of the registration panel on the lease page: the checklist links there when the registration failed. */
export const RLI_REGISTRATION_PANEL_ID = 'rli-registration';

/**
 * Official page of the Agenzia delle Entrate on the registration of a new lease contract (RLI), the source cited in
 * backend docs/integrations/rli-esign.md §2.1; the channels listed in the manual steps come from the same section.
 */
export const RLI_OFFICIAL_INFO_URL =
  'https://www.agenziaentrate.gov.it/portale/schede/fabbricatiterreni/registrazione-di-un-nuovo-contratto/schedainfo-regime-ordinario';

/** Limits of the manual registration, the same as the API (`RliRegistrationLimits`). */
export const RLI_MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
export const RLI_MAX_REGISTRATION_CODE_LENGTH = 100;
