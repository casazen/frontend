import { OWNER_PORTAL_HOME_PATH } from '@/lib/owner-invitation';

/**
 * The addresses of the owner portal (E07/F07/US01/T03). Only ids ever travel in them: no name, no e-mail, no amount, no subject and no word of a
 * message (ADR-011, NF-111). `/messaggi/{id}` is the link the e-mail of the inbox carries, `/contatto` the one of the invitation of a contact.
 */
export const OWNER_PORTAL_ROOT = OWNER_PORTAL_HOME_PATH;

export const ownerPortalPaths = {
  home: OWNER_PORTAL_ROOT,
  property: (propertyId: string) => `${OWNER_PORTAL_ROOT}/immobili/${encodeURIComponent(propertyId)}`,
  /** The calendar and the owner stays: of one property when the id is given, of the first one the owner has otherwise. */
  calendar: (propertyId?: string) => `${OWNER_PORTAL_ROOT}/calendario${propertyId ? `/${encodeURIComponent(propertyId)}` : ''}`,
  accounting: `${OWNER_PORTAL_ROOT}/contabilita`,
  documents: `${OWNER_PORTAL_ROOT}/documenti`,
  messages: `${OWNER_PORTAL_ROOT}/messaggi`,
  conversation: (conversationId: string) => `${OWNER_PORTAL_ROOT}/messaggi/${encodeURIComponent(conversationId)}`,
  contacts: `${OWNER_PORTAL_ROOT}/contatti`,
} as const;
