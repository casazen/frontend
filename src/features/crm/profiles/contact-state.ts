import type { CrmLegalBasis } from '@/types/crm.types';

/**
 * Where the e-mail of a guest stands for marketing (NF-89), in the words a host uses: reachable by the guest's consent, reachable
 * because the guest booked directly (the soft opt-in of art. 130 c. 4 of the privacy code), to confirm, service only, unsubscribed, or
 * no contact at all.
 */
export type ContactState = 'consent' | 'softOptIn' | 'toConfirm' | 'serviceOnly' | 'unsubscribed' | 'noContact';

/** What is known of an e-mail contact: the facts its state is made of. */
export interface ContactStateFacts {
  /** There is an address to write to. */
  hasAddress: boolean;
  basis: CrmLegalBasis;
  /** It may receive marketing now (not suppressed, not a forward address of a channel, and a soft opt-in or a confirmed consent). */
  reachable: boolean;
  /** The guest opted out (known for a contact of the detail; the list does not say it). */
  suppressed?: boolean;
  /** The address is the one an online travel agency forwards the guest's mail through. */
  otaForward?: boolean;
}

/**
 * The state of an e-mail from its facts. The list knows the legal basis of the best address and whether any may receive marketing; the
 * detail also knows each contact's flags. A soft opt-in that cannot be used is one the guest withdrew, and a consent that cannot be
 * used yet is one that waits for the confirmation (or, which the list cannot tell, for a guest who opted out afterwards: the hint of
 * the state says so and the profile shows which).
 */
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
