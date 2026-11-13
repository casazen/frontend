import { getManifestEntry, type PermissionPredicate } from '@/config/route-manifest';
import type { ConnectionHealthLine, ConnectionHealthSender, ConnectionHealthState } from '@/types';

/** The page where the sender of a property is activated or reconnected (E03/F01/US02/T02): the panel offers its button only when this route exists. */
export const SENDER_WIZARD_PATH = '/app/short-rent/compliance/sender';

/** The reason codes of the connection health that have words of their own (`connectionHealth.reason.<code>`); any other code gets the words of the state. */
const KNOWN_REASONS: ReadonlySet<string> = new Set([
  'credentials_refused',
  'connection_not_checked_yet',
  'octorate_not_connected',
  'octorate_police_account_invalid',
  'octorate_police_autorun_off',
  'octorate_police_not_exposed',
  'octorate_unavailable',
  'sender_casazen_not_available',
]);

const STATES: readonly ConnectionHealthState[] = ['Active', 'Inactive', 'Unknown', 'Manual'];
const SENDERS: readonly ConnectionHealthSender[] = ['ChannelManager', 'CasaZen', 'Manual'];

/** What the panel says about one communication, worked out from the line the API sent. */
export interface HealthLineView {
  state: ConnectionHealthState;
  sender: ConnectionHealthSender | null;
  /** The key of the words of the reason (`connectionHealth.reason.<code>`), or `null`: the code is unknown to this version or there is none. */
  reasonCode: string | null;
  /** Whether the host has something to do: the send is off or cannot be told, and somebody other than the host is meant to send. */
  needsAction: boolean;
  /** Whether the check of the outcome in the connected area of the channel manager is the way to settle it. */
  checkInChannelManager: boolean;
  /** The last automatic run (UTC instant), only where it is the channel manager's and the API gave it. */
  lastRunAt: string | null;
}

/**
 * The view of one line. The client never works a state out: a state this version does not know, or a line that is missing, is «Unknown» (CasaZen
 * cannot tell), never `Active` (a green state is only ever the API's word). A property outside Italy (`applies` false) is manual whatever the line says.
 */
export function describeHealthLine(line: ConnectionHealthLine | null | undefined, applies: boolean): HealthLineView {
  const state: ConnectionHealthState = !applies ? 'Manual' : STATES.find((candidate) => candidate === line?.state) ?? 'Unknown';
  const sender = SENDERS.find((candidate) => candidate === line?.sender) ?? null;
  const reason = line?.reason ?? null;

  return {
    state,
    sender,
    reasonCode: reason !== null && KNOWN_REASONS.has(reason) ? reason : null,
    needsAction: (state === 'Inactive' || state === 'Unknown') && sender !== 'Manual',
    checkInChannelManager: sender === 'ChannelManager' && (state === 'Inactive' || state === 'Unknown'),
    lastRunAt: sender === 'ChannelManager' && state !== 'Manual' ? (line?.lastAutomaticRunAt ?? null) : null,
  };
}

/** The key of the sentence that says what the line is: for each state, in words that fit who sends (a sender this version does not know gets the plain ones). */
export function healthDetailKey(view: Pick<HealthLineView, 'state' | 'sender'>): string {
  if (view.state === 'Manual') return 'connectionHealth.detail.Manual';
  const who = view.sender === 'ChannelManager' || view.sender === 'CasaZen' ? view.sender : 'other';
  return `connectionHealth.detail.${view.state}.${who}`;
}

/** The key of what the host does when the send is off or cannot be told, or `null` when nothing is asked of the host (nobody sends, or the sender is not known). */
export function healthInstructionsKey(view: Pick<HealthLineView, 'state' | 'sender' | 'needsAction'>): string | null {
  if (!view.needsAction) return null;
  if (view.sender === 'CasaZen') return 'connectionHealth.instructions.CasaZen';
  return view.sender === 'ChannelManager' ? `connectionHealth.instructions.ChannelManager.${view.state === 'Inactive' ? 'Inactive' : 'Unknown'}` : null;
}

/**
 * An instant as the host reads it, in the time zone of the property (an IANA name, `Europe/Rome` for every Italian property): «12 ottobre 2026 alle
 * 14:05». A time zone the browser does not know is Europe/Rome, the one of every deadline of the stays; an instant that is not one is an empty text.
 */
export function formatRunTime(instant: string, language: string, timeZone: string | undefined): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return '';
  const options: Intl.DateTimeFormatOptions = { dateStyle: 'long', timeStyle: 'short' };
  try {
    return new Intl.DateTimeFormat(language, { ...options, timeZone: timeZone || 'Europe/Rome' }).format(date);
  } catch {
    return new Intl.DateTimeFormat(language, { ...options, timeZone: 'Europe/Rome' }).format(date);
  }
}

/**
 * The address of the wizard that activates the sender of a property, or `null`: the page is not in the ROUTE_MANIFEST yet, or the person may not
 * open it (the manifest says which permissions it asks). The button «attiva o ricollega» appears only with an address; without one the panel shows
 * the instructions, so it never leads to a page that does not exist.
 */
export function senderWizardPath(propertyId: string, hasPermission: PermissionPredicate): string | null {
  const entry = getManifestEntry(SENDER_WIZARD_PATH);
  if (!entry || !entry.requiredPermissions.every((permission) => hasPermission(entry.context, permission))) return null;
  return `${entry.path}?${new URLSearchParams({ property: propertyId }).toString()}`;
}
