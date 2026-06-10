export interface ConnectStatus {
  connectedAccountId?: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsDue: string[];
}

export interface OnboardingLinkResponse {
  url: string;
}

export type ConnectUiStatus = 'disconnected' | 'pending' | 'active';

export function resolveConnectUiStatus(status: ConnectStatus | undefined): ConnectUiStatus {
  if (!status?.connectedAccountId)
    return 'disconnected';
  if (!status.chargesEnabled)
    return 'pending';
  return 'active';
}
