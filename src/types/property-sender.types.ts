import type { ComplianceSenderType } from './checkin-wizard.types';

/**
 * Who sends the police (Alloggiati Web) and ISTAT communications of a property, and what is known about it (backend `PropertySenderController`, E03/F01/US02/T01,
 * ADR-029, NF-42). The enums are the names of the backend: the API speaks the member name.
 */

export const PROPERTY_SENDER_SOURCES = ['Stored', 'OrganizationDefault', 'DefaultConnected', 'DefaultNotConnected', 'NotApplicable'] as const;
type PropertySenderSource = (typeof PROPERTY_SENDER_SOURCES)[number];

export const PROPERTY_SENDER_STATES = ['Active', 'Declared', 'Unverified', 'Inactive', 'NotConfigured'] as const;
type PropertySenderState = (typeof PROPERTY_SENDER_STATES)[number];

export const PROPERTY_SENDER_VERIFICATIONS = ['Verified', 'UserDeclared', 'Unverifiable', 'NotApplicable'] as const;
type PropertySenderVerification = (typeof PROPERTY_SENDER_VERIFICATIONS)[number];

export const SENDER_CONNECTION_TEST_OUTCOMES = ['Verified', 'Inactive', 'Unverifiable', 'NotApplicable', 'NotAvailable'] as const;
type SenderConnectionTestOutcome = (typeof SENDER_CONNECTION_TEST_OUTCOMES)[number];

/**
 * `GET|PUT /properties/{id}/sender` and `POST .../declare-activated`. No personal data: the credentials of the Questura are only said to exist. The police fields
 * (`policeAccountValid`, `policeAutorun`, `policeLastCron`) are `null` when the channel manager does not expose them.
 */
export interface PropertySender {
  propertyId: string;
  sender: ComplianceSenderType;
  /** Who sends the ISTAT communications: always the same as `sender`. */
  istatSender: ComplianceSenderType;
  source: PropertySenderSource;
  applies: boolean;
  state: PropertySenderState;
  verification: PropertySenderVerification;
  reason: string | null;
  guidance: string | null;
  policeAccountValid: boolean | null;
  policeAutorun: boolean | null;
  policeLastCron: string | null;
  questuraCredentialsConfigured: boolean;
  channelManagerAvailable: boolean;
  availableSenders: ComplianceSenderType[];
  delegationAccepted: boolean;
  /** The version of the delegation text to show; it is sent back with the consent, so that the consent is to the text the person read. */
  delegationTextVersion: string;
  declaredAt: string | null;
  lastChangedAt: string | null;
  autoSendGuestsToOctorate?: boolean;
}

export interface SenderConnectionTest {
  sender: ComplianceSenderType;
  outcome: SenderConnectionTestOutcome;
  reason: string | null;
  guidance: string | null;
  policeAccountValid: boolean | null;
  policeAutorun: boolean | null;
  policeLastCron: string | null;
  checkedAt: string;
}

/** Body of `PUT /properties/{id}/sender`. ISTAT always follows the sender: there is no field for it. */
export interface SwitchSenderRequest {
  sender: ComplianceSenderType;
  confirmed: boolean;
  delegationConsent: boolean;
  delegationTextVersion?: string;
  /**
   * The organization-wide setting of `PropertySender.autoSendGuestsToOctorate`: `true` lets CasaZen write the guests to the channel manager on its own, `false` goes back to the
   * host's confirmation in the check-in wizard, left out changes nothing. Only the organization administrator may send it with a value that differs from the one in force
   * (403 otherwise), so the client leaves it out for anyone else and when nothing changes.
   */
  autoSendGuestsToOctorate?: boolean;
}
