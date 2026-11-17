import { ApiClient } from './client';

export interface OrgComplianceSender {
  sender: 'Manual' | 'ChannelManager' | null;
  lastChangedAt: string | null;
  delegationAccepted: boolean;
  delegationTextVersion: string;
  propertyOverrides: number;
  autoSendGuestsToOctorate: boolean;
}
export interface OrgComplianceSenderRequest {
  sender: 'Manual' | 'ChannelManager';
  expectedLastChangedAt: string | null;
  confirmed: boolean;
  delegationConsent: boolean;
  delegationTextVersion?: string;
  autoSendGuestsToOctorate?: boolean;
}
const path = '/orgs/me/compliance-sender';
export const orgComplianceSenderApi = {
  get: () => ApiClient.get<OrgComplianceSender>(path),
  set: (request: OrgComplianceSenderRequest) => ApiClient.put<OrgComplianceSender>(path, request),
};
