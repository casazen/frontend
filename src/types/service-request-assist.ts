import type { ServiceRequestUrgency } from './service-request';

/**
 * «Descrivi di cosa hai bisogno» in the guided request (WIZ-AI-REQUEST): the host tells in a few words what the job is and the AI
 * proposes the kind of service, how urgent it is, a sentence for the supplier and who to ask. Nothing is sent or saved: the wizard fills
 * in its answers with it and the host reads, changes and sends the request.
 */

/**
 * Why there is no suggestion: no provider, the monthly budget is used up, it did not answer, its answer was not a service of the
 * platform, or it could not tell what the work is.
 */
export type ServiceRequestAssistReason =
  | 'ai_not_configured'
  | 'ai_budget_exhausted'
  | 'ai_unavailable'
  | 'ai_invalid_answer'
  | 'ai_not_understood';

/** Who the request goes to: CasaZen suppliers whenever one covers the property for the service, the external partners otherwise. */
export type ServiceRequestAssistChannel = 'casazen' | 'external';

/** The body of `POST /api/service-requests/assist`: the words of the host (8 to 600 characters) and the property the request is for. */
export interface ServiceRequestAssistInput {
  propertyId: string;
  text: string;
}

/**
 * The answer of `POST /api/service-requests/assist`. It is a `200` also when the AI cannot be used: `aiUsed` is then false with the
 * `reason`, and nothing else is set.
 */
export interface ServiceRequestAssist {
  aiUsed: boolean;
  reason: ServiceRequestAssistReason | null;
  /** A code of `GET /api/service-categories`. */
  category: string | null;
  urgency: ServiceRequestUrgency | null;
  /** The work in a few words for the supplier (at most 300 characters): offered as the notes of the request. */
  summary: string | null;
  /** One sentence for the host: why this service and this urgency (at most 160 characters). */
  explanation: string | null;
  channel: ServiceRequestAssistChannel | null;
  /** How many CasaZen suppliers cover the property for the service (0 with `external`). */
  casazenSuppliers: number;
}

/** The answer of `GET /api/service-requests/assist`: whether an AI is in effect, so the box is offered only where it can work. */
export interface ServiceRequestAssistAvailability {
  available: boolean;
}
