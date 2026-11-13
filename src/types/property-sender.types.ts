import type { ComplianceSenderType } from './checkin-wizard.types';

/**
 * Who sends the police (Alloggiati Web) and ISTAT communications of a property, and what is known about it (backend `PropertySenderController`, E03/F01/US02/T01,
 * ADR-029, NF-42). The enums are the names of the backend: the API speaks the member name.
 */

/** How the sender in effect came to be: a person chose it, one of the two defaults (PO-02), or the property is outside Italy. */
export const PROPERTY_SENDER_SOURCES = ['Stored', 'DefaultConnected', 'DefaultNotConnected', 'NotApplicable'] as const;
export type PropertySenderSource = (typeof PROPERTY_SENDER_SOURCES)[number];

/** The state of the sender as the host reads it: `Active` only when the channel manager itself proved it, `Declared` is the host's word. */
export const PROPERTY_SENDER_STATES = ['Active', 'Declared', 'Unverified', 'Inactive', 'NotConfigured'] as const;
export type PropertySenderState = (typeof PROPERTY_SENDER_STATES)[number];

/** How the state is known. */
export const PROPERTY_SENDER_VERIFICATIONS = ['Verified', 'UserDeclared', 'Unverifiable', 'NotApplicable'] as const;
export type PropertySenderVerification = (typeof PROPERTY_SENDER_VERIFICATIONS)[number];

/** The answer of the connection test: `Verified` is the only one that may be shown as «Attivo». */
export const SENDER_CONNECTION_TEST_OUTCOMES = ['Verified', 'Inactive', 'Unverifiable', 'NotApplicable', 'NotAvailable'] as const;
export type SenderConnectionTestOutcome = (typeof SENDER_CONNECTION_TEST_OUTCOMES)[number];

/**
 * `GET|PUT /properties/{id}/sender` and `POST .../declare-activated`. No personal data: the credentials of the Questura are only said to exist. The police fields
 * (`policeAccountValid`, `policeAutorun`, `policeLastCron`) are `null` when the channel manager does not expose them.
 */
export interface PropertySender {
  propertyId: string;
  /** Who sends the Alloggiati Web communications. */
  sender: ComplianceSenderType;
  /** Who sends the ISTAT communications: always the same as `sender`. */
  istatSender: ComplianceSenderType;
  source: PropertySenderSource;
  /** False for a property outside Italy: there is no sender to choose. */
  applies: boolean;
  state: PropertySenderState;
  verification: PropertySenderVerification;
  /** A stable code that says why the state is not simply `Active`. */
  reason: string | null;
  /** What the host can do about `reason`, in the language of the request. */
  guidance: string | null;
  policeAccountValid: boolean | null;
  policeAutorun: boolean | null;
  policeLastCron: string | null;
  questuraCredentialsConfigured: boolean;
  /** False without a confirmed listing on a connected channel manager, or while the connector is off: the option is then not offered. */
  channelManagerAvailable: boolean;
  /** The senders the host can choose now (empty outside Italy). */
  availableSenders: ComplianceSenderType[];
  /** True when the organization accepted the delegation text in force. */
  delegationAccepted: boolean;
  /** The version of the delegation text to show; it is sent back with the consent, so that the consent is to the text the person read. */
  delegationTextVersion: string;
  declaredAt: string | null;
  lastChangedAt: string | null;
}

/** `POST /properties/{id}/sender/connection-test`: nothing in it is stored or transmitted. */
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
  /** The host confirmed that the sender in effect will be off. Without it a change of sender answers 409 `sender_switch_confirmation_required`. */
  confirmed: boolean;
  /** The host accepts the delegation of the transmission (needed once, for an automatic sender). */
  delegationConsent: boolean;
  /** The version of the delegation text the host read; required with `delegationConsent`. */
  delegationTextVersion?: string;
}
