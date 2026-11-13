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

export type { CockpitTier } from './compliance-tiers';

/** The state a row shows as a badge, when the dictionary of states has one for it. */
export type CockpitBadge =
  | { kind: 'property'; status: PropertyComplianceStatus }
  | { kind: 'alloggiati'; status: AlloggiatiWebStatus };

export interface CockpitRow {
  /** One per item: the action, its target and, for a month, the month (a property has one item of a kind for each closed month). */
  id: string;
  /** What the `data-testid`s of the row are called (`compliance-summary-<testKey>-link`), as the cockpit has always named its sections. */
  testKey: string;
  /** How much it weighs for the host: a deadline of the law, the start of a property, or the upkeep of a stay. */
  tier: CockpitTier;
  /** A property to activate, a stay to look after, or another thing of a property (its connection, a month of ISTAT or tax). */
  group: 'property' | 'stay' | 'propertyItem';
  icon: LucideIcon;
  /** What to do, with whom or what it is about: "Alloggiati Web da inviare: Mario Rossi". For an item that is in order, what it is: "Ricevuta di Alloggiati Web: Mario Rossi". */
  title: string;
  /** Whom or what the title is about, to tell the button of this row from the same button of another one. */
  subject: string;
  /** Where it happens: the property of a stay, the city of a property. */
  sub?: string;
  /** What it still lacks, in words. */
  detail?: string;
  /**
   * The traffic light the API sends for the item (NF-52). `unknown` ("da verificare") when it sends none, or one this version does not
   * know: the client never works a light out, green least of all. Absent on a row that is not an item of the cockpit (the state of a
   * property that is in order).
   */
  light?: LightState;
  /** Why the item has its light, in plain words: the code of the API translated, or the generic words of the light. Never the raw code. */
  reason?: string;
  /** How pressing it is, in words, for what carries a deadline of the law. */
  note?: RowNote;
  badge?: CockpitBadge;
  /** Where the button goes; null when there is nothing this user can open for it. */
  to: string | null;
  /** The label of the button: what it does, or "Apri" for whoever may only look. */
  cta: string;
  /** Only to read (a property that is in order, an item the API says is done): the title opens its page and there is no button. */
  quiet?: boolean;
  /** What «Verifica nel tuo Cassetto Compliance» is about, for an Alloggiati communication or an ISTAT month whose property is known; absent for the others. */
  drawer?: ComplianceDrawerTarget;
}

/** The rows of one level, with what the server counts of it. */
export interface CockpitTierModel {
  /** What needs attention, in the order the host should do it: red first, then yellow, then what nobody could say, the nearest deadline first. */
  rows: CockpitRow[];
  /** What the server counts, which is more than it lists (it sends the first ones of some sections). */
  total: number;
  /** Counted by the server and not listed. */
  hidden: number;
}

export interface CockpitModel {
  /** What carries a deadline of the law: the Alloggiati Web communications and the guest data they need, ISTAT, the tourist tax, the police send. */
  fine: CockpitTierModel;
  /** The properties to activate. */
  start: CockpitTierModel;
  /** The upkeep of the stays: the departures to close, the properties to declare ready, the identities to verify. */
  chore: CockpitTierModel;
  /** The items the API says are in order (green), to read: they are never counted as things to do. */
  green: CockpitRow[];
  /** The properties that are in order, to read. */
  activeProperties: CockpitRow[];
  /** Everything the server counts as needing attention, whatever the level. */
  total: number;
  /** What the lights say, counted from what the API sends (never worked out): how many are red, yellow, to verify, in order. */
  lights: LightSummary;
  /** The one thing to do first, among those that have a place to go to: the worst light first, then the highest level, then the most pressing. */
  focus: CockpitRow | null;
}

interface Section {
  field: SectionField;
  testKey: string;
  icon: LucideIcon;
  group: CockpitRow['group'];
  badge?: CockpitBadge;
}

/**
 * The sections of the cockpit, in the order they win a tie: a communication that failed, the ones to send by hand, the receipts, the
 * guest data it needs, the identity of the guest, the police send and the periods, the departure to close, the property to declare ready,
 * and last the properties to activate. The level of each is `TIER_OF_FIELD`; inside a level the worst light comes first and then the nearest deadline.
 */
const SECTIONS: readonly Section[] = [
  { field: 'alloggiatiFailures', testKey: 'alloggiati', icon: AlertCircle, group: 'stay', badge: { kind: 'alloggiati', status: 'Errore' } },
  { field: 'alloggiatiManualRequired', testKey: 'alloggiati-manual', icon: Send, group: 'stay', badge: { kind: 'alloggiati', status: 'DaInviareManualmente' } },
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

/** The steps of the activation wizard that can block it: their names are in `compliance.activation.steps`. */
const ACTIVATION_STEPS = ['base-data', 'cin', 'documents', 'safety', 'tourist-tax', 'ical'];

export interface CockpitContext {
  t: TFunction;
  locale: string;
  hasPermission: PermissionPredicate;
  /** Whether a key is in the locale files (a field of the record that this version does not name is left out, never shown as a key). */
  exists: (key: string) => boolean;
}

export interface CockpitExtras {
  /** What the Home's "Da fare" says about the same things: the property and, when the summary does not say it, the deadline of a stay. Missing: the rows do without. */
  todo?: readonly DashboardTodoItem[];
  /** The host's properties: the state and the city of the ones to activate. */
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

const dueTime = (dueAt: string | null): number => {
  const time = dueAt ? new Date(dueAt).getTime() : Number.NaN;
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
};

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
    // The start of a day is the end of the one before it.
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

interface RowFacts {
  /** What the Home's "Da fare" says about the same item: the property of a stay. */
  stay?: DashboardTodoItem;
  property?: Property;
  /** When it is due: the summary says it, else the Home's "Da fare". */
  dueAt: string | null;
}

function rowOf(item: ComplianceSummaryItem, section: Section, tier: CockpitTier, facts: RowFacts, context: CockpitContext, now: Date): CockpitRow {
  const { t, hasPermission, locale } = context;
  const known = isCockpitAction(item.action);
  const to = known ? complianceActionRoute(item, hasPermission) : null;
  const canWrite = known ? hasPermission('short-rent', COMPLIANCE_ACTION_TARGETS[item.action].write) : false;
  const cinMissing = item.action === 'ActivateProperty' && (item.missing ?? []).some((missing) => missing.code.startsWith('activation_cin'));
  const cta = known ? t(cinMissing ? 'dashboard.todo.ActivateProperty.ctaCin' : `dashboard.todo.${item.action}.cta`) : '';

  // The light is the API's, never the app's: without one, or with one this version does not know, the item is "da verificare".
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
    // Only what the law dates has its deadline in words, and only while it is not done: the other levels stay calm.
    note: tier === 'fine' && !done ? deadlineNote(facts.dueAt, context, now) : undefined,
    // The state of the Alloggiati Web communication is what the reason says once the API sends the light: one pill, not two.
    badge:
      section.group === 'property'
        ? { kind: 'property', status: facts.property?.complianceStatus === 'Suspended' ? 'Suspended' : 'Pending' }
        : light === 'unknown'
          ? section.badge
          : undefined,
    to,
    // Whoever may only look is taken to the page, not told to do what the page will not let them do.
    cta: canWrite ? cta : t('dashboard.todo.open'),
    quiet: done ? true : undefined,
    // What the API says is in order has nothing left to go and read: no action on a green row.
    drawer: done ? undefined : drawerTargetOf(item, facts.stay?.propertyId),
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

/** What a block says under the title of a row: why it has its light, then where it is and what it still lacks. */
export function focusBodyOf(row: Pick<CockpitRow, 'reason' | 'sub' | 'detail'>): string | undefined {
  const where = [row.sub, row.detail].filter(Boolean).join(' · ');
  return [row.reason, where].filter(Boolean).join(' ') || undefined;
}

/** «Poi: ancora 3 da inviare, 21 case da attivare»: what is left after the row of the block, level by level. */
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
  /** The deadline as a number; infinity when none is known. */
  due: number;
  /** The place of its section among the sections: ties go to the earlier one. */
  order: number;
  /** The place the server gave it inside its section. */
  index: number;
  /** A property that worked and stopped (`Suspended`) is more pressing than one that never started. */
  suspended: boolean;
}

const lightOf = (row: CockpitRow): LightState => row.light ?? 'unknown';
const lightRank = (ranked: Ranked): number => LIGHT_RANK[lightOf(ranked.row)];

const byUrgency = (a: Ranked, b: Ranked) => lightRank(a) - lightRank(b) || a.due - b.due || a.order - b.order || a.index - b.index;
/** A property that was working and stopped comes first; the others keep the order of the server (by name). The worst light comes before both. */
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
    // What the server counts is what needs attention (not green): at least the items it lists as such.
    level.total += Math.max(sectionCount(summary, section.field), listedNeeding);
    level.hidden += Math.max(0, sectionCount(summary, section.field) - listedNeeding);

    items.forEach((item, index) => {
      const stay = stayOf(item);
      const property = item.propertyId ? properties.get(item.propertyId) : undefined;
      const dueAt = item.dueAt ?? stay?.dueAt ?? null;
      const row = rowOf(item, section, tier, { stay, property, dueAt }, context, now);
      // An item is one row: the same item in two sections (a server that lists it twice) is listed once, by the first.
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
        // This row is the status of the property, not an item of the cockpit: it has no light of its own.
        badge: { kind: 'property', status: 'Active' },
        to: `/app/short-rent/properties/${property.id}`,
        cta: context.t('dashboard.todo.open'),
        quiet: true,
      }),
    );

  // The first thing to do: the worst light first (a red of the upkeep comes before a yellow of the law), then the highest level, then the most pressing.
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
