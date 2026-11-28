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

export type ActiveRowStatus = MarketplaceCardStatus | 'Requested';

export interface ActiveRow {
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
  health: MarketplaceHealthItem | null;
  activationId: string | null;
}

export function activationKeyOf(kind: string, code: string, propertyId: string | null | undefined): string {
  return `${kind.toLowerCase()}|${code.toLowerCase()}|${propertyId ?? ''}`;
}

const KIND_ORDER: Record<string, number> = { channel: 0, tool: 1, licensedfunction: 2, partner: 3 };

function compareRows(a: ActiveRow, b: ActiveRow): number {
  const byProperty = (a.property?.name ?? '').localeCompare(b.property?.name ?? '');
  if (byProperty !== 0) return byProperty;
  const byKind = (KIND_ORDER[a.kind.toLowerCase()] ?? 9) - (KIND_ORDER[b.kind.toLowerCase()] ?? 9);
  return byKind !== 0 ? byKind : a.name.localeCompare(b.name);
}

export function badgeStatusOf(status: MarketplaceActivationStatus): ActiveRowStatus {
  return status === 'Deactivated' ? 'NotActive' : status;
}

function statusOf(integration: MarketplaceActiveIntegration, health: MarketplaceHealthItem | null): ActiveRowStatus {
  return health ? badgeStatusOf(health.status) : integration.status;
}

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

const CONNECTION_GONE_CODE = 'connection_missing';

export function connectionIsGone(row: Pick<ActiveRow, 'health'>): boolean {
  return row.health?.error?.code === CONNECTION_GONE_CODE;
}

export function rowHasProblem(row: Pick<ActiveRow, 'status' | 'health'>): boolean {
  return row.status === 'ToFix' || row.health?.error != null;
}

export function itemHasProblem(item: Pick<MarketplaceHealthItem, 'status' | 'error'>): boolean {
  return item.status === 'ToFix' || item.error !== null;
}

export interface PropertyHealth {
  key: string;
  propertyId: string | null;
  propertyName: string | null;
  problems: MarketplaceHealthItem[];
  waiting: MarketplaceHealthItem[];
  fine: MarketplaceHealthItem[];
}

function compareItems(a: MarketplaceHealthItem, b: MarketplaceHealthItem): number {
  const byStatus = Number(b.status === 'ToFix') - Number(a.status === 'ToFix');
  return byStatus !== 0 ? byStatus : a.name.localeCompare(b.name);
}

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

export function quotaOf(items: readonly MarketplaceHealthItem[]): MarketplaceQuota | null {
  let latest: MarketplaceQuota | null = null;
  for (const item of items) {
    if (item.quota && (latest === null || item.quota.readAt > latest.readAt)) latest = item.quota;
  }
  return latest;
}

export function quotaPercent(quota: Pick<MarketplaceQuota, 'used' | 'limit'>): number | null {
  if (!Number.isFinite(quota.used) || !Number.isFinite(quota.limit) || quota.limit <= 0) return null;
  return Math.round((quota.used / quota.limit) * 100);
}

export function formatInstant(instant: string | null | undefined, language: string): string {
  return instant ? formatRomeDateTime(instant, language, { dateStyle: 'long', timeStyle: 'short' }) : '';
}

export function formatInstantDay(instant: string | null | undefined, language: string): string {
  return instant ? formatRomeDateTime(instant, language, { dateStyle: 'long' }) : '';
}

export function formatDeclaredDay(declaredAt: string | null | undefined, language: string, kind: string): string {
  if (!declaredAt) return '';
  if (kind.toLowerCase() !== 'partner') return formatInstantDay(declaredAt, language);

  const date = new Date(declaredAt);
  return Number.isNaN(date.getTime()) ? '' : formatStayDate(utcStayDate(date), language);
}

export function fixPathOf(row: Pick<ActiveRow, 'kind' | 'code' | 'property'>, returnTo: string | null): string | null {
  return marketplaceAction({ kind: row.kind, code: row.code, status: 'ToFix', canActivate: true }, row.property?.id, returnTo)?.to ?? null;
}

export function goesThroughConnector(kind: string): boolean {
  return kind.toLowerCase() !== 'partner';
}

export function mayManageKind(kind: string, hasPermission: (context: 'short-rent', permission: string) => boolean, connectorOn: boolean): boolean {
  if (!hasPermission('short-rent', 'ota.write')) return false;
  return goesThroughConnector(kind) ? connectorOn : true;
}
