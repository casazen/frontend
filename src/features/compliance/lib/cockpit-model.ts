import type { TFunction } from 'i18next';
import { AlertCircle, CalendarCheck, FileCheck, Home, IdCard, LogOut, Plug, Send, Sparkles, Users, type LucideIcon } from 'lucide-react';
import type { CalmTone } from '@/components/shared/calm';
import type { PermissionPredicate } from '@/config/route-manifest';
import { drawerTargetOf, type ComplianceDrawerTarget } from '@/features/compliance/compliance-drawer/compliance-drawer-model';
import { urgencyOf, type RowNote } from '@/features/dashboard/lib/home-model';
import { COMPLIANCE_ACTION_TARGETS, complianceActionRoute } from '@/lib/compliance-routes';
import { addDays, formatStayDate, romeWallClock, todayInRome } from '@/lib/stay-dates';
import type { AlloggiatiWebStatus } from '@/types/alloggiati.types';
import {
  COMPLIANCE_COCKPIT_ACTIONS,
  type ComplianceCockpitAction,
  type ComplianceSummaryItem,
  type ComplianceSummaryResult,
  type PropertyComplianceStatus,
} from '@/types/compliance.types';
import type { DashboardTodoItem } from '@/types/dashboard.types';
import type { Property } from '@/types/property.types';
import { TIER_OF_FIELD, type CockpitTier } from './compliance-tiers';
import {
  LIGHT_RANK,
  lightStateOf,
  periodName,
  reasonText,
  sectionCount,
  sectionItems,
  summarizeLights,
  type LightState,
  type LightSummary,
  type SectionField,
} from './compliance-light';
import { dueTime } from './due-time';

export type { CockpitTier } from './compliance-tiers';

export type CockpitBadge =
  | { kind: 'property'; status: PropertyComplianceStatus }
  | { kind: 'alloggiati'; status: AlloggiatiWebStatus };

export interface CockpitRow {
  id: string;
  testKey: string;
  tier: CockpitTier;
  /** A property to activate, a stay to look after, or another thing of a property (its connection, a month of ISTAT or tax). */
  group: 'property' | 'stay' | 'propertyItem';
  icon: LucideIcon;
  /** What to do, with whom or what it is about: "Alloggiati Web da inviare: Mario Rossi". For an item that is in order, what it is: "Ricevuta di Alloggiati Web: Mario Rossi". */
  title: string;
  subject: string;
  sub?: string;
  detail?: string;
  /**
   * The traffic light the API sends for the item (NF-52). `unknown` ("da verificare") when it sends none, or one this version does not
   * know: the client never works a light out, green least of all. Absent on a row that is not an item of the cockpit (the state of a
   * property that is in order).
   */
  light?: LightState;
  reason?: string;
  note?: RowNote;
  badge?: CockpitBadge;
  to: string | null;
  cta: string;
  quiet?: boolean;
  drawer?: ComplianceDrawerTarget;
}

export interface CockpitTierModel {
  rows: CockpitRow[];
  total: number;
  hidden: number;
}

export interface CockpitModel {
  /** What carries a deadline of the law: the Alloggiati Web communications and the guest data they need, ISTAT, the tourist tax, the police send. */
  fine: CockpitTierModel;
  start: CockpitTierModel;
  chore: CockpitTierModel;
  green: CockpitRow[];
  activeProperties: CockpitRow[];
  total: number;
  lights: LightSummary;
  focus: CockpitRow | null;
}

interface Section {
  field: SectionField;
  testKey: string;
  icon: LucideIcon;
  group: CockpitRow['group'];
  badge?: CockpitBadge;
}

const SECTIONS: readonly Section[] = [
  { field: 'alloggiatiFailures', testKey: 'alloggiati', icon: AlertCircle, group: 'stay', badge: { kind: 'alloggiati', status: 'Errore' } },
  { field: 'alloggiatiManualRequired', testKey: 'alloggiati-manual', icon: Send, group: 'stay', badge: { kind: 'alloggiati', status: 'DaInviareManualmente' } },
  { field: 'ticinoNotifications', testKey: 'ticino', icon: Send, group: 'propertyItem' },
  { field: 'swissNotifications', testKey: 'swiss', icon: Send, group: 'propertyItem' },
  { field: 'manualSendsRequired', testKey: 'manual-sends', icon: Send, group: 'stay' },
  { field: 'receiptsToUpload', testKey: 'receipts', icon: FileCheck, group: 'stay' },
  { field: 'guestCheckInsIncomplete', testKey: 'checkins', icon: Users, group: 'stay' },
  { field: 'identityPending', testKey: 'identity', icon: IdCard, group: 'stay' },
  { field: 'connectionsToFix', testKey: 'connections', icon: Plug, group: 'propertyItem' },
  { field: 'periodItems', testKey: 'periods', icon: CalendarCheck, group: 'propertyItem' },
  { field: 'checkoutsDue', testKey: 'checkouts', icon: LogOut, group: 'stay' },
  { field: 'turnoversPending', testKey: 'turnovers', icon: Sparkles, group: 'stay' },
  { field: 'propertiesPending', testKey: 'properties', icon: Home, group: 'property' },
];

const ACTIVATION_STEPS = ['base-data', 'cin', 'documents', 'safety', 'tourist-tax', 'ical', 'guest-registration'];

export interface CockpitContext {
  t: TFunction;
  locale: string;
  hasPermission: PermissionPredicate;
  exists: (key: string) => boolean;
}

export interface CockpitExtras {
  todo?: readonly DashboardTodoItem[];
  properties?: readonly Property[];
}

const isCockpitAction = (action: string): action is ComplianceCockpitAction => (COMPLIANCE_COCKPIT_ACTIONS as readonly string[]).includes(action);

/**
 * What an item still lacks, in a line: the steps of the wizard for a property ("Manca: Codice CIN, Checklist
 * sicurezza"), the fields of the Alloggiati record for the guests of a stay. Other items have one thing left, which the title says.
 */
export function missingDetail(item: Pick<ComplianceSummaryItem, 'missing'>, { t, exists }: Pick<CockpitContext, 't' | 'exists'>): string | undefined {
  const parts: string[] = [];
  const add = (part: string) => {
    if (!parts.includes(part)) parts.push(part);
  };

  for (const missing of item.missing ?? []) {
    if (missing.code === 'guest_field_missing' && missing.field && exists(`alloggiati.recordField.${missing.field}`)) {
      const name = t(`alloggiati.recordField.${missing.field}`);
      add(missing.count && missing.count > 1 ? `${name} (${t('compliance.cockpit.missing.guests', { count: missing.count })})` : name);
    } else if (missing.code === 'guest_composition_invalid') {
      add(t('compliance.cockpit.missing.composition'));
    } else if (missing.code === 'guest_data_incomplete') {
      add(t('compliance.cockpit.missing.guestData'));
    } else if (missing.code === 'activation_not_confirmed') {
      add(t('compliance.cockpit.missing.notConfirmed'));
    } else if (missing.field && ACTIVATION_STEPS.includes(missing.field)) {
      add(t(`compliance.activation.steps.${missing.field}`));
    }
  }
  return parts.length > 0 ? t('compliance.cockpit.missing.lead', { what: parts.join(', ') }) : undefined;
}

/**
 * How pressing a deadline of the law is, in words: «Scaduto da 3 giorni», «Entro oggi alle 14:00», «Entro domani». Red when it is
 * past or within a day, amber within three, otherwise a plain date. A deadline at midnight sharp (the guest's arrival day starts
 * then) is the end of the day before: it says «Entro oggi», not «Entro domani alle 00:00». Nothing when there is no deadline: the
 * host is never told «quando puoi» about something the law dates.
 */
export function deadlineNote(dueAt: string | null, { t, locale }: Pick<CockpitContext, 't' | 'locale'>, now: Date = new Date()): RowNote | undefined {
  const due = dueTime(dueAt);
  if (!dueAt || !Number.isFinite(due)) return undefined;

  const hoursLeft = (due - now.getTime()) / 3_600_000;
  if (hoursLeft < 0) {
    const late = Math.floor(-hoursLeft);
    const text =
      late < 1
        ? t('compliance.cockpit.deadline.overdueJustNow')
        : late < 24
          ? t('compliance.cockpit.deadline.overdueHours', { count: late })
          : t('compliance.cockpit.deadline.overdueDays', { count: Math.floor(late / 24) });
    return { text, tone: 'danger' };
  }

  const wall = romeWallClock(dueAt);
  if (wall && wall.hour === 0 && wall.minute === 0) {
    const lastDay = addDays(wall.date, -1);
    const today = todayInRome(now);
    const text =
      lastDay === today
        ? t('compliance.cockpit.deadline.endOfToday')
        : lastDay === addDays(today, 1)
          ? t('compliance.cockpit.deadline.endOfTomorrow')
          : t('compliance.cockpit.deadline.endOfDay', { date: formatStayDate(lastDay, locale, { day: 'numeric', month: 'long' }) });
    return { text, tone: hoursLeft <= 24 ? 'danger' : hoursLeft <= 72 ? 'warning' : 'neutral' };
  }

  return urgencyOf(dueAt, { t, locale }, now);
}

/**
 * The notification of the guests of a canton whose sources give no deadline (`dueAt` null: Basel-Stadt, Fribourg, Neuchâtel, Thurgau, Zurich) says so: «Scadenza non nota». A time is never made
 * up, and an item that is on the page because the law asks for it does not leave the host wondering when. Nothing else of the cockpit says it: for the others no deadline means nothing to
 * tell (`deadlineNote`).
 */
function unknownDeadlineNote(item: Pick<ComplianceSummaryItem, 'action'>, dueAt: string | null, { t }: Pick<CockpitContext, 't'>): RowNote | undefined {
  return item.action === 'NotifyGuestsAuthority' && !Number.isFinite(dueTime(dueAt)) ? { text: t('compliance.cockpit.deadline.unknown'), tone: 'neutral' } : undefined;
}

interface RowFacts {
  stay?: DashboardTodoItem;
  property?: Property;
  dueAt: string | null;
}

function rowOf(item: ComplianceSummaryItem, section: Section, tier: CockpitTier, facts: RowFacts, context: CockpitContext, now: Date): CockpitRow {
  const { t, hasPermission, locale } = context;
  const known = isCockpitAction(item.action);
  const to = known ? complianceActionRoute(item, hasPermission) : null;
  const canWrite = known ? hasPermission('short-rent', COMPLIANCE_ACTION_TARGETS[item.action].write) : false;
  const cinMissing = item.action === 'ActivateProperty' && (item.missing ?? []).some((missing) => missing.code.startsWith('activation_cin'));
  const cta = known ? t(cinMissing ? 'dashboard.todo.ActivateProperty.ctaCin' : `dashboard.todo.${item.action}.cta`) : '';

  const light = lightStateOf(item.light);
  const done = light === 'green';
  const period = periodName(item.period, locale) || t('compliance.item.noPeriod');
  // An item the API says is in order is not asked of the host ("Invia Alloggiati Web: ..."): the row names what is done.
  const title = !known
    ? item.label
    : done
      ? t('compliance.row.named', { what: t(`compliance.item.${item.action}`, { period }), label: item.label })
      : t(`dashboard.todo.${item.action}.title`, { label: item.label, period });

  return {
    id: `${item.action}-${item.id}${item.period ? `-${item.period}` : ''}`,
    testKey: section.testKey,
    tier,
    group: section.group,
    icon: section.icon,
    title,
    subject: item.label,
    sub: section.group === 'stay' ? facts.stay?.propertyName?.trim() || undefined : facts.property?.city?.trim() || undefined,
    detail: done ? undefined : missingDetail(item, context),
    light,
    reason: reasonText(item.reason, light, context),
    note: tier === 'fine' && !done ? (deadlineNote(facts.dueAt, context, now) ?? unknownDeadlineNote(item, facts.dueAt, context)) : undefined,
    // The state of the Alloggiati Web communication is what the reason says once the API sends the light: one pill, not two.
    badge:
      section.group === 'property'
        ? { kind: 'property', status: facts.property?.complianceStatus === 'Suspended' ? 'Suspended' : 'Pending' }
        : light === 'unknown'
          ? section.badge
          : undefined,
    to,
    cta: canWrite ? cta : t('dashboard.todo.open'),
    quiet: done ? true : undefined,
    drawer: done ? undefined : drawerTargetOf(item),
  };
}

/**
 * The tone of the block that holds a row: red for what the law dates and is late or about to be (or failed), amber for the rest
 * of that level, the accent of the area for what only keeps a property from starting or is upkeep, and the blue of "in hand" for what the API
 * says is in progress. The words of the block say the same: the tone is never the only signal.
 */
export function focusToneOf(row: CockpitRow): CalmTone {
  if (row.light === 'yellow') return 'info';
  if (row.tier !== 'fine') return 'neutral';
  return row.note?.tone === 'danger' || (row.badge?.kind === 'alloggiati' && row.badge.status === 'Errore') ? 'danger' : 'warning';
}

export function focusBodyOf(row: Pick<CockpitRow, 'reason' | 'sub' | 'detail'>): string | undefined {
  const where = [row.sub, row.detail].filter(Boolean).join(' · ');
  return [row.reason, where].filter(Boolean).join(' ') || undefined;
}

export function thenOf(model: Pick<CockpitModel, CockpitTier>, focus: Pick<CockpitRow, 'tier'>, t: TFunction): string | undefined {
  const left = (tier: CockpitTier) => model[tier].total - (focus.tier === tier ? 1 : 0);
  const parts = [
    left('fine') > 0 ? t('compliance.cockpit.then.fine', { count: left('fine') }) : null,
    left('start') > 0 ? t('compliance.cockpit.then.start', { count: left('start') }) : null,
    left('chore') > 0 ? t('compliance.cockpit.then.chore', { count: left('chore') }) : null,
  ].filter(Boolean);
  return parts.length > 0 ? t('compliance.cockpit.then.lead', { what: parts.join(', ') }) : undefined;
}

interface Ranked {
  row: CockpitRow;
  due: number;
  order: number;
  index: number;
  suspended: boolean;
}

const lightOf = (row: CockpitRow): LightState => row.light ?? 'unknown';
const lightRank = (ranked: Ranked): number => LIGHT_RANK[lightOf(ranked.row)];

const byUrgency = (a: Ranked, b: Ranked) => lightRank(a) - lightRank(b) || a.due - b.due || a.order - b.order || a.index - b.index;
const byStopped = (a: Ranked, b: Ranked) => lightRank(a) - lightRank(b) || Number(b.suspended) - Number(a.suspended) || a.index - b.index;

const TIER_RANK: Readonly<Record<CockpitTier, number>> = { fine: 0, start: 1, chore: 2 };

/**
 * What the cockpit shows, from `GET /api/compliance/summary` and, to say where, from the Home's "Da fare" and the list of
 * properties. Those two only add words: a row is there because the summary says so, with or without them. The rows are in three
 * levels (`CockpitTier`): what the law dates, what keeps a property from starting, the upkeep. A deadline the summary sends
 * (`dueAt`) wins over the one of the Home, which lists only the first things to do.
 *
 * With the traffic light on (NF-52) every item carries its light: inside a level the rows are red first, then yellow, then what has no light
 * this version knows; the items the API says are in order (green) are listed apart in `green` and never counted as things to do. Without it
 * (an older API) every row is "da verificare" and the order is the one the cockpit always had.
 */
export function buildCockpit(summary: ComplianceSummaryResult, extras: CockpitExtras, context: CockpitContext, now: Date = new Date()): CockpitModel {
  const todo = new Map((extras.todo ?? []).map((item) => [`${item.action}|${item.bookingId ?? item.propertyId ?? ''}`, item]));
  const properties = new Map((extras.properties ?? []).map((property) => [property.id, property]));
  const stayOf = (item: ComplianceSummaryItem) => todo.get(`${item.action}|${item.bookingId ?? item.propertyId ?? ''}`);

  const tiers: Record<CockpitTier, { ranked: Ranked[]; total: number; hidden: number }> = {
    fine: { ranked: [], total: 0, hidden: 0 },
    start: { ranked: [], total: 0, hidden: 0 },
    chore: { ranked: [], total: 0, hidden: 0 },
  };
  const greens: Ranked[] = [];
  const attentionPropertyIds = new Set<string>();
  const seen = new Set<string>();

  SECTIONS.forEach((section, order) => {
    const tier = TIER_OF_FIELD[section.field];
    const level = tiers[tier];
    const items = sectionItems(summary, section.field);
    const listedNeeding = items.filter((item) => lightStateOf(item.light) !== 'green').length;
    level.total += Math.max(sectionCount(summary, section.field), listedNeeding);
    level.hidden += Math.max(0, sectionCount(summary, section.field) - listedNeeding);

    items.forEach((item, index) => {
      const stay = stayOf(item);
      const property = item.propertyId ? properties.get(item.propertyId) : undefined;
      const dueAt = item.dueAt ?? stay?.dueAt ?? null;
      const row = rowOf(item, section, tier, { stay, property, dueAt }, context, now);
      if (seen.has(row.id)) return;
      seen.add(row.id);
      const ranked: Ranked = { row, due: dueTime(dueAt), order, index, suspended: row.badge?.kind === 'property' && row.badge.status === 'Suspended' };
      if (row.light === 'green') {
        greens.push(ranked);
        return;
      }
      level.ranked.push(ranked);
      if (item.propertyId) attentionPropertyIds.add(item.propertyId);
    });
  });

  const build = (tier: CockpitTier, compare: (a: Ranked, b: Ranked) => number): CockpitTierModel => ({
    rows: tiers[tier].ranked.sort(compare).map(({ row }) => row),
    total: tiers[tier].total,
    hidden: tiers[tier].hidden,
  });
  const fine = build('fine', byUrgency);
  const start = build('start', byStopped);
  const chore = build('chore', byUrgency);

  // The others, in order: the state of every property is on the page, not only of the ones that need something. A property with something
  // to do (an activation, a connection, a month of ISTAT) is not "in order", whatever its status says.
  const activeProperties = [...properties.values()]
    .filter((property) => property.complianceStatus === 'Active' && !attentionPropertyIds.has(property.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (property): CockpitRow => ({
        id: `property-${property.id}`,
        testKey: 'properties-active',
        tier: 'start',
        group: 'property',
        icon: Home,
        title: property.name,
        subject: property.name,
        sub: property.city?.trim() || undefined,
        badge: { kind: 'property', status: 'Active' },
        to: `/app/short-rent/properties/${property.id}`,
        cta: context.t('dashboard.todo.open'),
        quiet: true,
      }),
    );

  const rank = (row: CockpitRow) => LIGHT_RANK[lightOf(row)] * 10 + TIER_RANK[row.tier];
  const focus = [...fine.rows, ...start.rows, ...chore.rows]
    .filter((row) => row.to !== null)
    .reduce<CockpitRow | null>((best, row) => (best === null || rank(row) < rank(best) ? row : best), null);

  return {
    fine,
    start,
    chore,
    green: greens.sort((a, b) => a.order - b.order || a.index - b.index).map(({ row }) => row),
    activeProperties,
    total: fine.total + start.total + chore.total,
    lights: summarizeLights(summary),
    focus,
  };
}
