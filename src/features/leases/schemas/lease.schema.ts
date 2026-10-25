import type { LeaseStatus } from '@/types';
import type { RliRegistrationState } from '@/lib/rli-registration-state';

export const LEASE_STATUS_VARIANTS: Record<LeaseStatus, 'default' | 'secondary' | 'outline' | 'destructive' | 'success'> = {
  Draft: 'secondary',
  AwaitingSignature: 'outline',
  PartiallySigned: 'outline',
  Signed: 'default',
  RegistrationPending: 'outline',
  SentToProvider: 'outline',
  Registered: 'success',
  Rejected: 'destructive',
};

/** Badge of the RLI registration state (LT-01): only "registered" is green. */
export const RLI_REGISTRATION_STATE_VARIANTS: Record<RliRegistrationState, 'default' | 'secondary' | 'outline' | 'destructive' | 'success'> = {
  notSigned: 'secondary',
  toRegister: 'outline',
  inProgress: 'outline',
  registered: 'success',
  failed: 'destructive',
};
