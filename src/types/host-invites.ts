export const HOST_INVITE_STATES = ['Pending', 'Used', 'Expired', 'Revoked'] as const;
export type HostInviteState = (typeof HOST_INVITE_STATES)[number];

export const HOST_INVITE_LOCALES = ['it', 'en'] as const;
export type HostInviteLocale = (typeof HOST_INVITE_LOCALES)[number];

interface HostInviteInviter {
  name: string;
  orgName: string;
}

export interface HostInvite {
  id: string;
  email: string;
  state: HostInviteState;
  message?: string | null;
  createdAt: string;
  expiresAt: string;
  usedAt?: string | null;
  invitedBy?: HostInviteInviter | null;
}

export interface HostInviteRequest {
  email: string;
  message?: string;
  locale?: HostInviteLocale;
}

export interface HostInviteResult {
  url?: string | null;
  inviteId: string;
  expiresAt: string;
}

export interface HostInvitesParams {
  search?: string;
  state?: HostInviteState;
  page?: number;
  pageSize?: number;
}

export interface HostInviteQuota {
  limit: number;
  used: number;
  remaining: number;
  resetsAt: string;
}

export interface HostInviteLookup {
  isAgency?: boolean;
  valid: boolean;
  state?: string | null;
  inviterName?: string | null;
  maskedEmail?: string | null;
}
