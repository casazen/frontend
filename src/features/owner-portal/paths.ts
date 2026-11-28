import { OWNER_PORTAL_HOME_PATH } from '@/lib/owner-invitation';

export const OWNER_PORTAL_ROOT = OWNER_PORTAL_HOME_PATH;

/**
 * The router state the sign-in page of an agency's own domain is opened with when the sign-in came back with an error (`HostSignInFailure` in `App`): the page then says that it did not complete and
 * waits for the visitor, instead of sending them off again. It is state of the history entry, never part of the address.
 */
export const SIGN_IN_FAILED_STATE = { signInFailed: true } as const;

export function isSignInFailedState(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as { signInFailed?: unknown }).signInFailed === true;
}

export const ownerPortalPaths = {
  home: OWNER_PORTAL_ROOT,
  signIn: `${OWNER_PORTAL_ROOT}/accedi`,
  noAccess: `${OWNER_PORTAL_ROOT}/accesso-negato`,
  property: (propertyId: string) => `${OWNER_PORTAL_ROOT}/immobili/${encodeURIComponent(propertyId)}`,
  /** The calendar and the owner stays: of one property when the id is given, of the first one the owner has otherwise. */
  calendar: (propertyId?: string) => `${OWNER_PORTAL_ROOT}/calendario${propertyId ? `/${encodeURIComponent(propertyId)}` : ''}`,
  accounting: `${OWNER_PORTAL_ROOT}/contabilita`,
  statement: (statementId: string) => `${OWNER_PORTAL_ROOT}/contabilita/${encodeURIComponent(statementId)}`,
  documents: `${OWNER_PORTAL_ROOT}/documenti`,
  issuedDocuments: `${OWNER_PORTAL_ROOT}/documenti-emessi`,
  messages: `${OWNER_PORTAL_ROOT}/messaggi`,
  conversation: (conversationId: string) => `${OWNER_PORTAL_ROOT}/messaggi/${encodeURIComponent(conversationId)}`,
  contacts: `${OWNER_PORTAL_ROOT}/contatti`,
} as const;
