import { hostInvitePath, isWellFormedHostInviteToken } from '@/lib/host-invite';
import { normalizeOrgInviteToken, ORG_INVITE_ACCEPT_PATH } from '@/lib/org-invitation';
import { normalizeOwnerInvitationToken, OWNER_INVITATION_APP_STATE_KEY, OWNER_INVITATION_PATH } from '@/lib/owner-invitation';
import { normalizeOwnerContactToken, OWNER_CONTACT_APP_STATE_KEY, OWNER_CONTACT_INVITATION_PATH } from '@/lib/owner-contact-invitation';

export const ACCOUNT_INVITATION_PATH = '/attiva-invito';

const AUTH0_ORGANIZATION = /^org_[A-Za-z0-9_-]{1,128}$/;
const AUTH0_INVITATION = /^[A-Za-z0-9_-]{8,512}$/;
const SUPPLIER_INVITATION = /^[0-9a-f]{64}$/i;

type AccountInvitationLogin = {
  authorizationParams: { organization: string; invitation: string };
  returnTo: string;
  appState?: Record<string, string>;
};

type AccountInvitationDestination = Omit<AccountInvitationLogin, 'authorizationParams'>;

function destination(flow: string | null, token: string): AccountInvitationDestination | null {
  switch (flow) {
    case 'owner': {
      const normalized = normalizeOwnerInvitationToken(token);
      return normalized ? { returnTo: OWNER_INVITATION_PATH, appState: { [OWNER_INVITATION_APP_STATE_KEY]: normalized } } : null;
    }
    case 'owner-contact': {
      const normalized = normalizeOwnerContactToken(token);
      return normalized ? { returnTo: OWNER_CONTACT_INVITATION_PATH, appState: { [OWNER_CONTACT_APP_STATE_KEY]: normalized } } : null;
    }
    case 'team': {
      const normalized = normalizeOrgInviteToken(token);
      return normalized ? { returnTo: `${ORG_INVITE_ACCEPT_PATH}?token=${normalized}` } : null;
    }
    case 'host':
      return isWellFormedHostInviteToken(token) ? { returnTo: hostInvitePath(token) } : null;
    case 'supplier':
      return SUPPLIER_INVITATION.test(token) ? { returnTo: `/register?inviteToken=${encodeURIComponent(token)}` } : null;
    default:
      return null;
  }
}

/** Only the Auth0 ticket goes to Auth0. The CasaZen token stays in the SDK transaction in this browser. */
export function accountInvitationLogin(fragment: string): AccountInvitationLogin | null {
  const params = new URLSearchParams(fragment.replace(/^#/, ''));
  const organization = params.get('organization') ?? '';
  const invitation = params.get('invitation') ?? '';
  if (!AUTH0_ORGANIZATION.test(organization) || !AUTH0_INVITATION.test(invitation)) return null;

  const target = destination(params.get('flow'), params.get('token') ?? '');
  return target && { ...target, authorizationParams: { organization, invitation } };
}
