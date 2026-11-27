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

/** The e-mail channel of a booking's guest. */
export interface GuestMarketingEmail {
  state: GuestMarketingState;
  /** The address the choice is about, masked (`m***@e***.com`); null when the booking has no real address and the guest typed none. */
  maskedAddress: string | null;
  /** The confirmation e-mail can be asked for again now: the consent is pending and the limits of the confirmation allow it. */
  canResend: boolean;
}

/** The WhatsApp channel of a booking's guest: never `pending` (there is no confirmation). */
export interface GuestMarketingWhatsapp {
  state: GuestMarketingState;
  /** The number the choice is about, masked (`+39******567`); null when there is none. */
  maskedPhone: string | null;
}

/**
 * The marketing choices of the guest of a booking (`GET|PUT /api/public/guest/bookings/{code}/marketing`, with the guest session): the versions
 * of the texts and, for each channel, a state with the value masked. Never a clear address or number.
 */
export interface GuestMarketing {
  /** The version of the consent text, null while it has none: the page then offers no consent. */
  marketingConsentVersion: string | null;
  /** The version of the soft opt-in notice, null while there is none. */
  softOptInNoticeVersion: string | null;
  email: GuestMarketingEmail;
  whatsapp: GuestMarketingWhatsapp;
}

/**
 * What the guest changes (`PUT`): a channel that is left out stays as it is. A channel that is named must say `enabled`: the API refuses a body
 * without it, because the opt-out it would be taken for is final.
 */
export interface GuestMarketingChange {
  /** Turn e-mail on (with the address when the booking has no real one: an OTA forward, or none) or off. */
  email?: { enabled: boolean; address?: string };
  /** Turn WhatsApp on (with the number when the booking has none) or off. */
  whatsapp?: { enabled: boolean; phone?: string };
  /** The version of the consent text the page showed: needed to turn a channel on. */
  consentVersion?: string;
  /** The language of the page. */
  language?: 'it' | 'en';
}

/** The answer of the resend: whether this call queued the e-mail (`false`: nothing was waiting for a confirmation, or the limits did not allow another message). */
export interface GuestMarketingResend {
  sent: boolean;
}
