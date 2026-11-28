/**
 * «Gestisci con AI» of the page of the adempimenti: what the assistant plans for the items of the cockpit, what it did, and what it
 * says only the host can do. The backend enums are serialized by name; the reasons and the codes are stable snake_case words the web app
 * translates (`compliance.autopilot.*`), never a text of the server.
 */

type AutopilotTopic = 'GuestData' | 'Departure' | 'Alloggiati';

type AutopilotItemStatus = 'Ready' | 'Waiting' | 'Host';

type AutopilotOutcomeStatus = 'Done' | 'Failed' | 'Skipped';

type AutopilotChannel = 'email' | 'chat';

export interface AutopilotItem {
  key: string;
  topic: AutopilotTopic;
  status: AutopilotItemStatus;
  reason: string;
  bookingId: string;
  propertyId: string;
  guestName: string;
  propertyName: string;
  channels: AutopilotChannel[];
  dueAt: string | null;
}

export interface AutopilotPlan {
  items: AutopilotItem[];
  /** An AI provider is in effect: the chat messages are written by it (otherwise they are plain texts of CasaZen). */
  aiAvailable: boolean;
  beyondLimit: number;
}

export interface AutopilotChatDraft {
  language: string;
  text: string;
  whatsAppUrl: string | null;
  smsUrl: string | null;
  /** The wording is the AI's (otherwise a plain text of CasaZen). */
  aiWritten: boolean;
}

export interface AutopilotOutcome {
  key: string;
  topic: AutopilotTopic;
  bookingId: string;
  guestName: string;
  propertyName: string;
  status: AutopilotOutcomeStatus;
  code: string;
  emailStatus: string | null;
  emailError: string | null;
  chat: AutopilotChatDraft | null;
  errorCode: string | null;
}

export interface AutopilotRunResult {
  outcomes: AutopilotOutcome[];
  aiUsed: boolean;
  aiReason: string | null;
  beyondLimit: number;
}

export interface AutopilotRunCommand {
  keys?: string[];
}
