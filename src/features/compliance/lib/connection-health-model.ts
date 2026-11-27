import { getManifestEntry, type PermissionPredicate } from '@/config/route-manifest';
import type { ConnectionHealthLine, ConnectionHealthSender, ConnectionHealthState } from '@/types';

/**
 * The section of the page of the property where the police and ISTAT send is told (`?section=connection-health`): the panel «Invio a Polizia e ISTAT».
 * The button `ActivateOctorateSend` of the cockpit and of the To do opens the wizard that activates the send (`SENDER_WIZARD_PATH`) and, for who may not open it, the page on this section.
 */
export const CONNECTION_HEALTH_SECTION = 'connection-health';

export const SENDER_WIZARD_PATH = '/app/short-rent/compliance/sender';

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

export interface HealthLineView {
  state: ConnectionHealthState;
  sender: ConnectionHealthSender | null;
  reasonCode: string | null;
  needsAction: boolean;
  checkInChannelManager: boolean;
  lastRunAt: string | null;
}

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

export function healthDetailKey(view: Pick<HealthLineView, 'state' | 'sender'>): string {
  if (view.state === 'Manual') return 'connectionHealth.detail.Manual';
  const who = view.sender === 'ChannelManager' || view.sender === 'CasaZen' ? view.sender : 'other';
  return `connectionHealth.detail.${view.state}.${who}`;
}

export function healthInstructionsKey(view: Pick<HealthLineView, 'state' | 'sender' | 'needsAction'>): string | null {
  if (!view.needsAction) return null;
  if (view.sender === 'CasaZen') return 'connectionHealth.instructions.CasaZen';
  return view.sender === 'ChannelManager' ? `connectionHealth.instructions.ChannelManager.${view.state === 'Inactive' ? 'Inactive' : 'Unknown'}` : null;
}

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
