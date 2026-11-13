import { formatRomeDateTime, formatStayDate, utcStayDate } from '@/lib/stay-dates';
import type {
  MarketplaceActiveIntegration,
  MarketplaceActivationStatus,
  MarketplaceCardStatus,
  MarketplaceEntryKind,
  MarketplaceHealthItem,
  MarketplaceIntegrationProperty,
  MarketplaceQuota,
} from '@/types';
import { marketplaceAction } from './marketplace-entry';

/**
 * The model of the Active tab (E09/F03/US02, MKT-01, MKT-04, NF-54, NF-57): the activations of `GET /api/marketplace/active` put together with the rows of
 * `GET /api/marketplace/health`, what a row says about itself, the groups of the health panel, and what the quota says. No React in it: the page and the cards read it.
 */

/** What the badge of a row says: the status of a card, or `Requested` (a function that waits for the license, which only the health row tells from `Pending`). */
export type ActiveRowStatus = MarketplaceCardStatus | 'Requested';

/** One activation of the tab: the row of the active list, and the health row of the same activation when the health could be read. */
export interface ActiveRow {
  /** Names the activation in both reads: kind, code and property. */
  key: string;
  kind: MarketplaceEntryKind;
  code: string;
  name: string;
  property: MarketplaceIntegrationProperty | null;
  status: ActiveRowStatus;
  isDeclared: boolean;
  declaredAt: string | null;
  verifiedAt: string | null;
  lastSyncedAt: string | null;
  /** The health row of the same activation; `null` when the health was not read (no permission, the connector is off, the read failed) and for a partner. */
  health: MarketplaceHealthItem | null;
  /** The id of the activation, which the change and the deactivation need: the health row has it (a partner has none), and so does the list when the server sends it. */
  activationId: string | null;
}

/** The key of an activation in the active list and in the health rows: the same row has the same key in both. */
export function activationKeyOf(kind: string, code: string, propertyId: string | null | undefined): string {
  return `${kind.toLowerCase()}|${code.toLowerCase()}|${propertyId ?? ''}`;
}

const KIND_ORDER: Record<string, number> = { channel: 0, tool: 1, licensedfunction: 2, partner: 3 };

function compareRows(a: ActiveRow, b: ActiveRow): number {
  // The rows of the whole organization first, then the properties by name; in a property the channels, the tools, the functions and the partners.
  const byProperty = (a.property?.name ?? '').localeCompare(b.property?.name ?? '');
  if (byProperty !== 0) return byProperty;
  const byKind = (KIND_ORDER[a.kind.toLowerCase()] ?? 9) - (KIND_ORDER[b.kind.toLowerCase()] ?? 9);
  return byKind !== 0 ? byKind : a.name.localeCompare(b.name);
}

/** The status of an activation as a badge says it: `Deactivated` is not one of the tab (it is not listed), and is drawn as «not active» if one ever comes. */
export function badgeStatusOf(status: MarketplaceActivationStatus): ActiveRowStatus {
  return status === 'Deactivated' ? 'NotActive' : status;
}

/** The status a row says: the health row's word where it was read (it tells `Requested` from `Pending`), else the status of the card. */
function statusOf(integration: MarketplaceActiveIntegration, health: MarketplaceHealthItem | null): ActiveRowStatus {
  return health ? badgeStatusOf(health.status) : integration.status;
}

/**
 * The rows of the tab: one for each activation of the active list, with its health row when there is one (`health` is `null` when the health was not read: nothing is then said
 * of the problem or the quota of a row, and no id is known). The health rows that the list does not have are not rows of the tab.
 */
export function buildActiveRows(integrations: readonly MarketplaceActiveIntegration[], health: readonly MarketplaceHealthItem[] | null): ActiveRow[] {
  const byKey = new Map((health ?? []).map((item) => [activationKeyOf(item.kind, item.code, item.propertyId), item] as const));

  return integrations
    .map((integration): ActiveRow => {
      const key = activationKeyOf(integration.kind, integration.code, integration.property?.id);
      const row = byKey.get(key) ?? null;

      return {
        key,
        kind: integration.kind,
        code: integration.code,
        name: integration.name,
        property: integration.property,
        status: statusOf(integration, row),
        isDeclared: integration.isDeclared,
        declaredAt: integration.declaredAt,
        verifiedAt: integration.verifiedAt,
        lastSyncedAt: integration.lastSyncedAt ?? row?.lastSyncedAt ?? null,
        health: row,
        activationId: row?.activationId ?? integration.activationId ?? null,
      };
    })
    .sort(compareRows);
}

/** The code of the problem of a connection that is no longer on the channel manager (`MarketplaceHealthErrorCodes.ConnectionMissing`: the sync found it gone). */
const CONNECTION_GONE_CODE = 'connection_missing';

/** Whether the health says the connection of this row is no longer on the channel manager: there are no settings to change there (the change would be refused), and «Correggi» makes it again. */
export function connectionIsGone(row: Pick<ActiveRow, 'health'>): boolean {
  return row.health?.error?.code === CONNECTION_GONE_CODE;
}

/** A row with a problem: the connection is to fix, or it carries an error. Waiting (`Pending`, `Requested`) is not a problem, and it is not «working» either. */
export function rowHasProblem(row: Pick<ActiveRow, 'status' | 'health'>): boolean {
  return row.status === 'ToFix' || row.health?.error != null;
}

/** The health row of a channel, a tool or a function with a problem: the same rule for the panel. */
export function itemHasProblem(item: Pick<MarketplaceHealthItem, 'status' | 'error'>): boolean {
  return item.status === 'ToFix' || item.error !== null;
}

/** What the health panel says of one property: the rows with a problem, the ones that wait, and the ones that are active with no problem reported. */
export interface PropertyHealth {
  /** The id of the property, or `org` for the rows of the whole organization. */
  key: string;
  propertyId: string | null;
  propertyName: string | null;
  problems: MarketplaceHealthItem[];
  waiting: MarketplaceHealthItem[];
  fine: MarketplaceHealthItem[];
}

function compareItems(a: MarketplaceHealthItem, b: MarketplaceHealthItem): number {
  // To fix before the other problems, then by name.
  const byStatus = Number(b.status === 'ToFix') - Number(a.status === 'ToFix');
  return byStatus !== 0 ? byStatus : a.name.localeCompare(b.name);
}

/**
 * The rows of the health read by property, the ones with problems first: a property with a problem comes before the ones that have none (by name), and the rows of the whole
 * organization are the last group. The rows of a group that has a problem are the ones to look at; the others are counted, not listed.
 */
export function groupHealthByProperty(items: readonly MarketplaceHealthItem[]): PropertyHealth[] {
  const groups = new Map<string, PropertyHealth>();

  for (const item of items) {
    const key = item.propertyId ?? 'org';
    let group = groups.get(key);
    if (!group) {
      group = { key, propertyId: item.propertyId, propertyName: item.propertyName, problems: [], waiting: [], fine: [] };
      groups.set(key, group);
    }

    if (itemHasProblem(item)) group.problems.push(item);
    else if (item.status === 'Active') group.fine.push(item);
    else group.waiting.push(item);
  }

  for (const group of groups.values()) group.problems.sort(compareItems);

  return [...groups.values()].sort((a, b) => {
    if (a.propertyId === null || b.propertyId === null) return Number(a.propertyId === null) - Number(b.propertyId === null);
    const byProblems = Number(b.problems.length > 0) - Number(a.problems.length > 0);
    return byProblems !== 0 ? byProblems : (a.propertyName ?? '').localeCompare(b.propertyName ?? '');
  });
}

/**
 * As of when a group of integrations says what it says: the oldest last sync among them (the whole group was read at least then), and how many were never read. A «no problem
 * reported» that nobody has looked at for days is not the same as one read a minute ago, and one that was never read says nothing at all.
 */
export function checkedOf(items: ReadonlyArray<Pick<MarketplaceHealthItem, 'lastSyncedAt'>>): { oldest: string | null; never: number } {
  let oldest: string | null = null;
  let oldestTime = Number.POSITIVE_INFINITY;
  let never = 0;

  for (const item of items) {
    const time = item.lastSyncedAt ? Date.parse(item.lastSyncedAt) : Number.NaN;
    if (Number.isNaN(time)) {
      never += 1;
    } else if (time < oldestTime) {
      oldest = item.lastSyncedAt;
      oldestTime = time;
    }
  }

  return { oldest, never };
}

/** The quota of the channel manager's API: it is the same on every row, so the first one read (the latest, if rows ever differ). `null` until a sync read it. */
export function quotaOf(items: readonly MarketplaceHealthItem[]): MarketplaceQuota | null {
  let latest: MarketplaceQuota | null = null;
  for (const item of items) {
    if (item.quota && (latest === null || item.quota.readAt > latest.readAt)) latest = item.quota;
  }
  return latest;
}

/** The share of the quota used, in whole percent, as the numbers of the server say it; `null` when the limit is not a number above zero (nothing to compare with). */
export function quotaPercent(quota: Pick<MarketplaceQuota, 'used' | 'limit'>): number | null {
  if (!Number.isFinite(quota.used) || !Number.isFinite(quota.limit) || quota.limit <= 0) return null;
  return Math.round((quota.used / quota.limit) * 100);
}

/**
 * An instant as the host reads it: «12 novembre 2026 alle 14:05», in the time zone of the property. The data has no time zone for a property, so it is Europe/Rome (UX-09),
 * the one of every deadline of the stays. An empty text for what is not an instant.
 */
export function formatInstant(instant: string | null | undefined, language: string): string {
  return instant ? formatRomeDateTime(instant, language, { dateStyle: 'long', timeStyle: 'short' }) : '';
}

/** The day of an instant in Europe/Rome («12 novembre 2026»), for a request made on a day. */
export function formatInstantDay(instant: string | null | undefined, language: string): string {
  return instant ? formatRomeDateTime(instant, language, { dateStyle: 'long' }) : '';
}

/**
 * The day an activation was declared, as the host reads it. A partner is declared for a day the host gave: `declaredAt` is midnight UTC of that day, so its day is the UTC one and is
 * shown without any shift. For every other kind (a function of the license is declared at the moment the host asks for it) `declaredAt` is a real instant, and its day is the one in
 * Europe/Rome, like every other date of the tab: 23:30 UTC of the 12th is already the 13th in Rome.
 */
export function formatDeclaredDay(declaredAt: string | null | undefined, language: string, kind: string): string {
  if (!declaredAt) return '';
  if (kind.toLowerCase() !== 'partner') return formatInstantDay(declaredAt, language);

  const date = new Date(declaredAt);
  return Number.isNaN(date.getTime()) ? '' : formatStayDate(utcStayDate(date), language);
}

/**
 * Where «Correggi» leads: the wizard of the kind of the row (a channel or a tool, a function of the license, a partner) for its property, with the way back to the page the
 * person is on. `null` when no wizard can be started (it is not for the property of the row, or the kind is not known).
 */
export function fixPathOf(row: Pick<ActiveRow, 'kind' | 'code' | 'property'>, returnTo: string | null): string | null {
  return marketplaceAction({ kind: row.kind, code: row.code, status: 'ToFix', canActivate: true }, row.property?.id, returnTo)?.to ?? null;
}

/** Whether an activation of this kind goes through the channel manager (a channel, a tool, a function of the license): a partner never does, and never depends on the connector. */
export function goesThroughConnector(kind: string): boolean {
  return kind.toLowerCase() !== 'partner';
}

/**
 * Whether the person may change or turn off an activation of this kind: the permission to write (`ota.write`) and, for what goes through the channel manager (a channel, a
 * tool, a function of the license), the connector being on, as the backend asks. A partner never depends on the connector.
 */
export function mayManageKind(kind: string, hasPermission: (context: 'short-rent', permission: string) => boolean, connectorOn: boolean): boolean {
  if (!hasPermission('short-rent', 'ota.write')) return false;
  return goesThroughConnector(kind) ? connectorOn : true;
}
