/**
 * Connection health of the police (Alloggiati Web) and ISTAT send of a property (`GET /api/properties/{propertyId}/compliance/connection-health`,
 * E03/F02/US01/T02, CHK-12 point 7, NF-52). What the channel manager does not let CasaZen read is `Unknown`, never `Active`.
 */

/** Who sends the communications of a property: its channel manager, CasaZen (not available in this release) or the host by hand. */
export type ConnectionHealthSender = 'ChannelManager' | 'CasaZen' | 'Manual';

/**
 * `Active` only when the channel manager itself says so; `Inactive` when it says the send is off; `Unknown` when CasaZen cannot tell
 * (the host is asked to check); `Manual` when nobody sends automatically.
 */
export type ConnectionHealthState = 'Active' | 'Inactive' | 'Unknown' | 'Manual';

/** One communication of a property (Alloggiati Web or ISTAT): who sends it and what is known about that send. */
export interface ConnectionHealthLine {
  sender: ConnectionHealthSender;
  state: ConnectionHealthState;
  /** What the channel manager says about the validity of the police account; `null` = it does not expose it. */
  connectionValid: boolean | null;
  /** Whether its daily automatic send is on; `null` = not exposed. */
  autorun: boolean | null;
  /** When its daily job last ran (UTC instant); `null` = not exposed. */
  lastAutomaticRunAt: string | null;
  /** A stable code that says why the state is not simply `Active` (a code this version does not know gets the generic words); `null` when there is nothing to say. */
  reason: string | null;
  /** When the host said it saw the send activated (UTC instant): the host's word, not a verification; `null` when it did not. */
  declaredAt: string | null;
}

export interface ComplianceConnectionHealth {
  propertyId: string;
  /** False for a property outside Italy: both lines are manual. */
  applies: boolean;
  alloggiati: ConnectionHealthLine;
  istat: ConnectionHealthLine;
  /** The Alloggiati Web credentials of the property are kept in CasaZen (their values never come back). */
  credentialsInCasaZen: boolean;
  /** The credentials exist and were verified, so the receipts could be downloaded. `false` in this release: nothing may say receipts can be downloaded. */
  credentialsUsable: boolean;
  /** When the health was read (UTC instant). */
  checkedAt: string;
}
