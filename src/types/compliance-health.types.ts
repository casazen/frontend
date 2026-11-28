/**
 * Connection health of the police (Alloggiati Web) and ISTAT send of a property (`GET /api/properties/{propertyId}/compliance/connection-health`,
 * E03/F02/US01/T02, CHK-12 point 7, NF-52). What the channel manager does not let CasaZen read is `Unknown`, never `Active`.
 */

export type ConnectionHealthSender = 'ChannelManager' | 'CasaZen' | 'Manual';

export type ConnectionHealthState = 'Active' | 'Inactive' | 'Unknown' | 'Manual';

/** One communication of a property (Alloggiati Web or ISTAT): who sends it and what is known about that send. */
export interface ConnectionHealthLine {
  sender: ConnectionHealthSender;
  state: ConnectionHealthState;
  connectionValid: boolean | null;
  autorun: boolean | null;
  lastAutomaticRunAt: string | null;
  reason: string | null;
  declaredAt: string | null;
}

export interface ComplianceConnectionHealth {
  propertyId: string;
  applies: boolean;
  alloggiati: ConnectionHealthLine;
  istat: ConnectionHealthLine;
  /** The Alloggiati Web credentials of the property are kept in CasaZen (their values never come back). */
  credentialsInCasaZen: boolean;
  credentialsUsable: boolean;
  checkedAt: string;
}
