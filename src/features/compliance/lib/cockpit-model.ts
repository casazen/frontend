import type { TFunction } from 'i18next';
import { AlertCircle, Home, LogOut, Send, Sparkles, Users, type LucideIcon } from 'lucide-react';
import type { CalmTone } from '@/components/shared/calm';
import type { PermissionPredicate } from '@/config/route-manifest';
import { drawerTargetOf, type ComplianceDrawerTarget } from '@/features/compliance/compliance-drawer/compliance-drawer-model';
import { urgencyOf, type RowNote } from '@/features/dashboard/lib/home-model';
import { complianceActionRoute } from '@/lib/compliance-routes';
import { addDays, formatStayDate, romeWallClock, todayInRome } from '@/lib/stay-dates';
import type { AlloggiatiWebStatus } from '@/types/alloggiati.types';
import {
  COMPLIANCE_COCKPIT_ACTIONS,
  type ComplianceCockpitAction,
  type ComplianceSummaryItem,
  type ComplianceSummaryResult,
  type ComplianceSummarySection,
  type PropertyComplianceStatus,
} from '@/types/compliance.types';
import type { DashboardTodoItem } from '@/types/dashboard.types';
import type { Property } from '@/types/property.types';
import { TIER_OF_FIELD, type CockpitTier } from './compliance-tiers';

export type { CockpitTier } from './compliance-tiers';

/** The state a row shows as a badge, when the dictionary of states has one for it. */
export type CockpitBadge =
  | { kind: 'property'; status: PropertyComplianceStatus }
  | { kind: 'alloggiati'; status: AlloggiatiWebStatus };

export interface CockpitRow {
  id: string;
  /** What the `data-testid`s of the row are called (`compliance-summary-<testKey>-link`), as the cockpit has always named its sections. */
  testKey: string;
  /** How much it weighs for the host: a deadline of the law, the start of a property, or the upkeep of a stay. */
  tier: CockpitTier;
  /** A property to activate, or a stay to look after. */
  group: 'property' | 'stay';
  icon: LucideIcon;
  /** What to do, with whom or what it is about: "Alloggiati Web da inviare: Mario Rossi". */
  title: string;
  /** Whom or what the title is about, to tell the button of this row from the same button of another one. */
  subject: string;
  /** Where it happens: the property of a stay, the city of a property. */
  sub?: string;
  /** What it still lacks, in words. */
  detail?: string;
  /** How pressing it is, in words, for what carries a deadline of the law. */
  note?: RowNote;
  badge?: CockpitBadge;
  /** Where the button goes; null when there is nothing this user can open for it. */
  to: string | null;
  /** The label of the button: what it does, or "Apri" for whoever may only look. */
  cta: string;
  /** Only to read (a property that is in order): the title opens its page and there is no button. */
  quiet?: boolean;
  /** What «Verifica nel tuo Cassetto Compliance» is about, for an Alloggiati communication whose property is known; absent for the others. */
  drawer?: ComplianceDrawerTarget;
}

/** The rows of one level, with what the server counts of it. */
export interface CockpitTierModel {
  /** In the order the host should do them: the nearest deadline first. */
  rows: CockpitRow[];
  /** What the server counts, which is more than it lists (it sends the first ones of some sections). */
  total: number;
  /** Counted by the server and not listed. */
  hidden: number;
}

export interface CockpitModel {
  /** What carries a deadline of the law: the Alloggiati Web communications and the guest data they need. */
  fine: CockpitTierModel;
  /** The properties to activate. */
  start: CockpitTierModel;
  /** The upkeep of the stays that are over. */
  chore: CockpitTierModel;
  /** The properties that are in order, to read. */
  activeProperties: CockpitRow[];
  /** Everything the server counts, whatever the level. */
  total: number;
  /** The one thing to do first, among those that have a place to go to: the most pressing of the highest level that has one. */
  focus: CockpitRow | null;
}

interface Section {
  field: keyof ComplianceSummaryResult;
  testKey: string;
  icon: LucideIcon;
  group: CockpitRow['group'];
  badge?: CockpitBadge;
}

/**
 * The sections of the cockpit, in the order they win a tie: a communication that failed, one to send, the guest data it needs, the
 * departure to close, the property to declare ready, and last the properties to activate. The level of each is
 * `TIER_OF_FIELD`; inside a level the nearest deadline comes first.
 */
const SECTIONS: readonly Section[] = [
  { field: 'alloggiatiFailures', testKey: 'alloggiati', icon: AlertCircle, group: 'stay', badge: { kind: 'alloggiati', status: 'Errore' } },
  { field: 'alloggiatiManualRequired', testKey: 'alloggiati-manual', icon: Send, group: 'stay', badge: { kind: 'alloggiati', status: 'DaInviareManualmente' } },
  { field: 'guestCheckInsIncomplete', testKey: 'checkins', icon: Users, group: 'stay' },
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

function sectionOf(summary: ComplianceSummaryResult, field: keyof ComplianceSummaryResult): ComplianceSummarySection {
  const section = summary[field] as ComplianceSummarySection | null | undefined;
  return {
    count: typeof section?.count === 'number' ? section.count : 0,
    items: Array.isArray(section?.items) ? section.items : [],
  };
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
  const { t, hasPermission } = context;
  const known = isCockpitAction(item.action);
  const to = known ? complianceActionRoute(item, hasPermission) : null;
  const canWrite = hasPermission('short-rent', item.action === 'ActivateProperty' ? 'property.write' : 'booking.write');
  const cinMissing = item.action === 'ActivateProperty' && (item.missing ?? []).some((missing) => missing.code.startsWith('activation_cin'));
  const cta = known ? t(cinMissing ? 'dashboard.todo.ActivateProperty.ctaCin' : `dashboard.todo.${item.action}.cta`) : '';

  return {
    id: `${item.action}-${item.id}`,
    testKey: section.testKey,
    tier,
    group: section.group,
    icon: section.icon,
    title: known ? t(`dashboard.todo.${item.action}.title`, { label: item.label }) : item.label,
    subject: item.label,
    sub: section.group === 'property' ? facts.property?.city?.trim() || undefined : facts.stay?.propertyName?.trim() || undefined,
    detail: missingDetail(item, context),
    // Only what the law dates has its deadline in words: the other levels stay calm.
    note: tier === 'fine' ? deadlineNote(facts.dueAt, context, now) : undefined,
    badge:
      section.group === 'property'
        ? { kind: 'property', status: facts.property?.complianceStatus === 'Suspended' ? 'Suspended' : 'Pending' }
        : section.badge,
    to,
    // Whoever may only look is taken to the page, not told to do what the page will not let them do.
    cta: canWrite ? cta : t('dashboard.todo.open'),
    drawer: drawerTargetOf(item, facts.stay?.propertyId),
  };
}

/**
 * The tone of the block that holds a row: red for what the law dates and is late or about to be (or failed), amber for the rest
 * of that level, the accent of the area for what only keeps a property from starting or is upkeep. The words of the block say
 * the same: the tone is never the only signal.
 */
export function focusToneOf(row: CockpitRow): CalmTone {
  if (row.tier !== 'fine') return 'neutral';
  return row.note?.tone === 'danger' || (row.badge?.kind === 'alloggiati' && row.badge.status === 'Errore') ? 'danger' : 'warning';
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

const byUrgency = (a: Ranked, b: Ranked) => a.due - b.due || a.order - b.order || a.index - b.index;
/** A property that was working and stopped comes first; the others keep the order of the server (by name). */
const byStopped = (a: Ranked, b: Ranked) => Number(b.suspended) - Number(a.suspended) || a.index - b.index;

/**
 * What the cockpit shows, from `GET /api/compliance/summary` and, to say where, from the Home's "Da fare" and the list of
 * properties. Those two only add words: a row is there because the summary says so, with or without them. The rows are in three
 * levels (`CockpitTier`): what the law dates, what keeps a property from starting, the upkeep. A deadline the summary sends
 * (`dueAt`) wins over the one of the Home, which lists only the first things to do.
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
  const pendingIds = new Set<string>();

  SECTIONS.forEach((section, order) => {
    const tier = TIER_OF_FIELD[section.field];
    const { count, items } = sectionOf(summary, section.field);
    const level = tiers[tier];
    level.total += count;
    level.hidden += Math.max(0, count - items.length);

    items.forEach((item, index) => {
      const stay = stayOf(item);
      const property = item.propertyId ? properties.get(item.propertyId) : undefined;
      const dueAt = item.dueAt ?? stay?.dueAt ?? null;
      const row = rowOf(item, section, tier, { stay, property, dueAt }, context, now);
      level.ranked.push({ row, due: dueTime(dueAt), order, index, suspended: row.badge?.kind === 'property' && row.badge.status === 'Suspended' });
      if (section.group === 'property' && item.propertyId) pendingIds.add(item.propertyId);
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

  // The others, in order: the state of every property is on the page, not only of the ones that need something.
  const activeProperties = [...properties.values()]
    .filter((property) => property.complianceStatus === 'Active' && !pendingIds.has(property.id))
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

  return {
    fine,
    start,
    chore,
    activeProperties,
    total: fine.total + start.total + chore.total,
    focus: [...fine.rows, ...start.rows, ...chore.rows].find((row) => row.to !== null) ?? null,
  };
}
