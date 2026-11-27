/**
 * The controlled passage from CasaZen to the connected area that holds an Alloggiati or ISTAT outcome (CHK-15, E03/F05): the contract of
 * `POST /api/compliance/octorate-handoffs`. The enums travel by name. There is no address in the request, on purpose: where the host goes is
 * decided by the server's configuration alone, and the client opens only the one address the answer carries, never one it builds.
 */

/** What the host goes to check: the Alloggiati Web communication of a stay, or the ISTAT communication of a period. */
export const COMPLIANCE_HANDOFF_TOPICS = ['Alloggiati', 'Istat'] as const;
export type ComplianceHandoffTopic = (typeof COMPLIANCE_HANDOFF_TOPICS)[number];

type ComplianceHandoffDestinationKind = 'Home' | 'DeepLink';

export interface ComplianceHandoffRequest {
  topic: ComplianceHandoffTopic;
  propertyId: string;
  bookingId?: string | null;
  period?: string | null;
  returnPath: string;
}

interface ComplianceHandoffContext {
  propertyId: string;
  propertyName: string;
  octorateListingName: string | null;
  bookingId: string | null;
  bookingCode: string | null;
  period: string | null;
}

interface ComplianceHandoffGuide {
  code: string;
  menuPath: string;
  check: string;
}

export interface ComplianceHandoff {
  handoffId: string;
  startedAt: string;
  expiresAt: string;
  topic: ComplianceHandoffTopic;
  destinationUrl: string;
  destinationKind: ComplianceHandoffDestinationKind;
  returnPath: string;
  context: ComplianceHandoffContext;
  guide: ComplianceHandoffGuide;
}
