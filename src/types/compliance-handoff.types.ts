/**
 * The controlled passage from CasaZen to the connected area that holds an Alloggiati or ISTAT outcome (CHK-15, E03/F05): the contract of
 * `POST /api/compliance/octorate-handoffs`. The enums travel by name. There is no address in the request, on purpose: where the host goes is
 * decided by the server's configuration alone, and the client opens only the one address the answer carries, never one it builds.
 */

/** What the host goes to check: the Alloggiati Web communication of a stay, or the ISTAT communication of a period. */
export const COMPLIANCE_HANDOFF_TOPICS = ['Alloggiati', 'Istat'] as const;
export type ComplianceHandoffTopic = (typeof COMPLIANCE_HANDOFF_TOPICS)[number];

/** `Home`: the authenticated home of the connected area (the guide describes the menu steps); `DeepLink`: a verified link to the section. */
export type ComplianceHandoffDestinationKind = 'Home' | 'DeepLink';

export interface ComplianceHandoffRequest {
  topic: ComplianceHandoffTopic;
  propertyId: string;
  /** The stay, when the check starts from a booking: it must be a booking of the property. */
  bookingId?: string | null;
  /** `yyyy-MM` or `yyyy-MM-dd`, when the check is about a period. */
  period?: string | null;
  /** The relative CasaZen route the host comes from (path and query, starting with `/`): the one the client saves to come back to. */
  returnPath: string;
}

/** The target of the check, as the dialog names it: the host's own property, listing and stay reference, no guest. */
export interface ComplianceHandoffContext {
  propertyId: string;
  propertyName: string;
  /** The name of the property's listing on the connected area, when known: the structure to open there. */
  octorateListingName: string | null;
  bookingId: string | null;
  /** The reference of the stay the host knows (`XXXXX-XXXXX`), not the id. */
  bookingCode: string | null;
  period: string | null;
}

/** The guide of the check, in the language of the request: where to go in the connected area and what to look at there. */
export interface ComplianceHandoffGuide {
  /** One of `alloggiati_daily`, `alloggiati_short_stay`, `alloggiati_long_stay`, `istat_period`. */
  code: string;
  menuPath: string;
  check: string;
}

/** A handoff ready to be used. Nothing in it is a result: CasaZen does not know what the connected area will show. */
export interface ComplianceHandoff {
  /** Opaque id the client saves with the route it will come back to. */
  handoffId: string;
  startedAt: string;
  /** Until when the saved context may be restored (UTC). */
  expiresAt: string;
  topic: ComplianceHandoffTopic;
  /** The allowlisted address to open in the same tab. */
  destinationUrl: string;
  destinationKind: ComplianceHandoffDestinationKind;
  returnPath: string;
  context: ComplianceHandoffContext;
  guide: ComplianceHandoffGuide;
}
