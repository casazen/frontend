/**
 * «Gestisci con AI» of the page of the adempimenti: what the assistant plans for the items of the cockpit, what it did, and what it
 * says only the host can do. The backend enums are serialized by name; the reasons and the codes are stable snake_case words the web app
 * translates (`compliance.autopilot.*`), never a text of the server.
 */

/** What an item of the cockpit is about. */
export type AutopilotTopic = 'GuestData' | 'Departure' | 'Alloggiati';

/** Who does an item: the assistant in the next run, the assistant later, or only the host. */
export type AutopilotItemStatus = 'Ready' | 'Waiting' | 'Host';

/** How an item ended. `Skipped`: it was no longer to be done when the run came to it. */
export type AutopilotOutcomeStatus = 'Done' | 'Failed' | 'Skipped';

/** How a guest can be reached: the check-in link by e-mail from CasaZen, and/or a message the host sends from his own phone. */
export type AutopilotChannel = 'email' | 'chat';

/** One item of the cockpit that has a stay, as the assistant sees it. */
export interface AutopilotItem {
  /** `{topic}:{bookingId}`: what a run sends back to do exactly what was shown. */
  key: string;
  topic: AutopilotTopic;
  status: AutopilotItemStatus;
  /** Why it is `status`: `ask_guests`, `asked_recently`, `no_contact`, `close_departure`, `awaiting_guest_data`, `ready_to_upload`, ... */
  reason: string;
  bookingId: string;
  propertyId: string;
  /** The booker, as the cockpit names the item. */
  guestName: string;
  propertyName: string;
  /** For a `GuestData` item that is `Ready`: how the guest can be reached. */
  channels: AutopilotChannel[];
  /** When it is due (UTC), as the cockpit says; null when no date fixes it. */
  dueAt: string | null;
}

/** `GET /api/compliance/autopilot`: what the assistant would do now. Nothing is changed and nobody is contacted. */
export interface AutopilotPlan {
  items: AutopilotItem[];
  /** An AI provider is in effect: the chat messages are written by it (otherwise they are plain texts of CasaZen). */
  aiAvailable: boolean;
  /** The `Ready` items one run does not reach: run again. */
  beyondLimit: number;
}

/** A message for a guest that the host sends from his own phone, with the links that open WhatsApp and the messages app with it written. */
export interface AutopilotChatDraft {
  /** `it`, `en`, `de`, `fr` or `es`. */
  language: string;
  text: string;
  /** Null when the guest has no number that can be written in international form. */
  whatsAppUrl: string | null;
  smsUrl: string | null;
  /** The wording is the AI's (otherwise a plain text of CasaZen). */
  aiWritten: boolean;
}

/** How an item ended: `email_queued`, `chat_ready`, `email_failed`, `departure_closed`, `failed`, `no_longer_needed`. */
export interface AutopilotOutcome {
  key: string;
  topic: AutopilotTopic;
  bookingId: string;
  guestName: string;
  propertyName: string;
  status: AutopilotOutcomeStatus;
  code: string;
  /** `Queued` or `Failed` for the e-mail with the link; null when none was asked for. */
  emailStatus: string | null;
  /** Why the e-mail did not leave: `no_recipient`, `provider_not_configured`, `queue_failed`, `rejected`, ... */
  emailError: string | null;
  chat: AutopilotChatDraft | null;
  /** The code of the rule that refused, for a `Failed` item: `checkin_already_completed`, `booking_already_checked_out`, `unexpected`, ... */
  errorCode: string | null;
}

/** `POST /api/compliance/autopilot/run`. */
export interface AutopilotRunResult {
  outcomes: AutopilotOutcome[];
  /** The wording of at least one chat message is the AI's. */
  aiUsed: boolean;
  /** Why the AI did not write the messages when it was asked: `ai_not_configured`, `ai_budget_exhausted`, `ai_unavailable`, `ai_invalid_answer`. */
  aiReason: string | null;
  /** What this run did not reach (the limits of one run): run again. */
  beyondLimit: number;
}

/** The body of the run: the keys of the items the host was shown. Without it every item that is `Ready` now is done. */
export interface AutopilotRunCommand {
  keys?: string[];
}
