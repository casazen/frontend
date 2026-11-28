/**
 * Where a channel stands for the guest of a booking (`GuestMarketingStates` of the backend; E07/F04/US01/T04, NF-90). The page reads it, it does
 * not guess: nothing is shown as ticked unless the guest ticked it.
 * - `none`: no contact of the guest on the channel;
 * - `pending`: a consent waits for the confirmation of the address (e-mail only);
 * - `confirmed`: the guest consented (and, for e-mail, confirmed);
 * - `soft_opt_in`: the address is on soft opt-in (art. 130 c. 4): the guest was told, not asked, and can object;
 * - `service_only`: the contact is used for the stay only, never for offers;
 * - `withdrawn`: the guest withdrew or objected: nothing is sent, and nothing brings it back.
 */
export type GuestMarketingState = 'none' | 'pending' | 'confirmed' | 'soft_opt_in' | 'service_only' | 'withdrawn';

interface GuestMarketingEmail {
  state: GuestMarketingState;
  maskedAddress: string | null;
  canResend: boolean;
}

interface GuestMarketingWhatsapp {
  state: GuestMarketingState;
  maskedPhone: string | null;
}

export interface GuestMarketing {
  marketingConsentVersion: string | null;
  softOptInNoticeVersion: string | null;
  email: GuestMarketingEmail;
  whatsapp: GuestMarketingWhatsapp;
}

/**
 * What the guest changes (`PUT`): a channel that is left out stays as it is. A channel that is named must say `enabled`: the API refuses a body
 * without it, because the opt-out it would be taken for is final.
 */
export interface GuestMarketingChange {
  email?: { enabled: boolean; address?: string };
  whatsapp?: { enabled: boolean; phone?: string };
  consentVersion?: string;
  language?: 'it' | 'en';
}

export interface GuestMarketingResend {
  sent: boolean;
}
