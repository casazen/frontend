import type { CrmLegalBasis } from '@/types/crm.types';

/**
 * Where the e-mail of a guest stands for marketing (NF-89), in the words a host uses: reachable by the guest's consent, reachable
 * because the guest booked directly (the soft opt-in of art. 130 c. 4 of the privacy code), to confirm, service only, unsubscribed, or
 * no contact at all.
 */
export type ContactState = 'consent' | 'softOptIn' | 'toConfirm' | 'serviceOnly' | 'unsubscribed' | 'noContact';

export interface ContactStateFacts {
  hasAddress: boolean;
  basis: CrmLegalBasis;
  reachable: boolean;
  suppressed?: boolean;
  otaForward?: boolean;
}

export function contactStateOf({ hasAddress, basis, reachable, suppressed = false, otaForward = false }: ContactStateFacts): ContactState {
  if (suppressed) return 'unsubscribed';
  if (!hasAddress) return 'noContact';
  if (reachable) return basis === 'SoftOptIn' ? 'softOptIn' : 'consent';
  if (otaForward) return 'serviceOnly';

  switch (basis) {
    case 'Consent':
      return 'toConfirm';
    case 'SoftOptIn':
      return 'unsubscribed';
    case 'ServiceOnly':
      return 'serviceOnly';
    default:
      return 'noContact';
  }
}
