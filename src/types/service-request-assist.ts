import type { ServiceRequestUrgency } from './service-request';

export type ServiceRequestAssistReason =
  | 'ai_not_configured'
  | 'ai_budget_exhausted'
  | 'ai_unavailable'
  | 'ai_invalid_answer'
  | 'ai_not_understood';

/** Who the request goes to: CasaZen suppliers whenever one covers the property for the service, the external partners otherwise. */
type ServiceRequestAssistChannel = 'casazen' | 'external';

export interface ServiceRequestAssistInput {
  propertyId: string;
  text: string;
}

export interface ServiceRequestAssist {
  aiUsed: boolean;
  reason: ServiceRequestAssistReason | null;
  category: string | null;
  urgency: ServiceRequestUrgency | null;
  summary: string | null;
  explanation: string | null;
  channel: ServiceRequestAssistChannel | null;
  casazenSuppliers: number;
}

export interface ServiceRequestAssistAvailability {
  available: boolean;
}
