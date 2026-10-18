/** State of a host invite, computed by the API (same values as the supplier invites). */
export const HOST_INVITE_STATES = ['Pending', 'Used', 'Expired', 'Revoked'] as const;
export type HostInviteState = (typeof HOST_INVITE_STATES)[number];

/** Languages an invite email can be written in. */
export const HOST_INVITE_LOCALES = ['it', 'en'] as const;
export type HostInviteLocale = (typeof HOST_INVITE_LOCALES)[number];

/** Who sent an invite (only the admin list carries it). */
export interface HostInviteInviter {
  name: string;
  orgName: string;
}

/** An invite in the admin list or in the list of the inviting host; the link token is never sent. */
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
  inviteId: string;
  expiresAt: string;
}

export interface HostInvitesParams {
  search?: string;
  state?: HostInviteState;
  page?: number;
  pageSize?: number;
}

/** Daily quota of invites of the signed-in host (`GET /hosts/me/invitations/quota`). */
export interface HostInviteQuota {
  limit: number;
  used: number;
  remaining: number;
  /** ISO UTC instant when the quota starts again. */
  resetsAt: string;
}

/** Answer of the anonymous lookup of an invite link; the email is only ever masked. */
export interface HostInviteLookup {
  valid: boolean;
  /** Why the link is not usable: Used, Expired, Revoked; anything else counts as invalid. */
  state?: string | null;
  inviterName?: string | null;
  maskedEmail?: string | null;
}
