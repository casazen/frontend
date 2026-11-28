import axios from '@/lib/axios';
import { ApiClient } from './client';
import type { PropertySender, SenderConnectionTest, SwitchSenderRequest } from '@/types';

const senderPath = (propertyId: string) => `/properties/${encodeURIComponent(propertyId)}/sender`;

/**
 * Who sends the police (Alloggiati Web) and ISTAT communications of a property (E03/F01/US02/T01, ADR-029, NF-42). The answers are `private, no-store`
 * and hold no credential: the Questura credentials are only said to exist.
 */
export const propertySenderApi = {
  /**
   * `GET /properties/{id}/sender`: the sender, its state, how it is known, who can be chosen and the version of the delegation text to accept. 404 `property_not_found` (throws). A property of
   * the organization that the caller does not reach answers 403 with no code (`PropertySenderController`): it resolves to `null`, which the wizard says as «not found» (nothing is said of a
   * property the person cannot see), instead of throwing, because a 403 on a read makes the shared axios client send the whole app to the no-access page. A 403 `account_inactive` or
   * `onboarding_required` is not routed from this one read either; the page's other reads raise it.
   */
  get: async (propertyId: string): Promise<PropertySender | null> => {
    const response = await axios.get<PropertySender>(senderPath(propertyId), { validateStatus: (status) => (status >= 200 && status < 300) || status === 403 });
    return response.status === 403 ? null : response.data;
  },

  switch: (propertyId: string, request: SwitchSenderRequest) => ApiClient.put<PropertySender>(senderPath(propertyId), request),

  testConnection: (propertyId: string) => ApiClient.post<SenderConnectionTest>(`${senderPath(propertyId)}/connection-test`),

  declareActivated: (propertyId: string) => ApiClient.post<PropertySender>(`${senderPath(propertyId)}/declare-activated`),
};
