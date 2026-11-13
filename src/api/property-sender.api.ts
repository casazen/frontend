import { ApiClient } from './client';
import type { PropertySender, SenderConnectionTest, SwitchSenderRequest } from '@/types';

/** The path of the sender of a property: the id is encoded, whatever it holds never turns into another path. */
const senderPath = (propertyId: string) => `/properties/${encodeURIComponent(propertyId)}/sender`;

/**
 * Who sends the police (Alloggiati Web) and ISTAT communications of a property (E03/F01/US02/T01, ADR-029, NF-42). The answers are `private, no-store`
 * and hold no credential: the Questura credentials are only said to exist.
 */
export const propertySenderApi = {
  /** `GET /properties/{id}/sender`: the sender, its state, how it is known, who can be chosen and the version of the delegation text to accept. 404 `property_not_found`. */
  get: (propertyId: string) => ApiClient.get<PropertySender>(senderPath(propertyId)),

  /**
   * `PUT /properties/{id}/sender`: changes the sender. 409 `sender_switch_confirmation_required` (the problem carries `currentSender` and `newSender`) without
   * `confirmed`; 403 `alloggiati_delegation_required` for an automatic sender without the consent; 409 `alloggiati_delegation_text_outdated` when the version
   * of the text that was read is not the one in force; 422 `sender_casazen_not_available`, `sender_channel_manager_not_available`, `sender_not_applicable`.
   */
  switch: (propertyId: string, request: SwitchSenderRequest) => ApiClient.put<PropertySender>(senderPath(propertyId), request),

  /** `POST /properties/{id}/sender/connection-test`: reads the police account on the channel manager; nothing is stored or transmitted. */
  testConnection: (propertyId: string) => ApiClient.post<SenderConnectionTest>(`${senderPath(propertyId)}/connection-test`),

  /** `POST /properties/{id}/sender/declare-activated`: the host says it saw «Attivato»; stored as a declaration, never as verified. Only for the channel manager. */
  declareActivated: (propertyId: string) => ApiClient.post<PropertySender>(`${senderPath(propertyId)}/declare-activated`),
};
