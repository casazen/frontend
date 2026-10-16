import type { TFunction } from 'i18next';
import { AlertCircle, Home, LogOut, Send, Sparkles, Users, type LucideIcon } from 'lucide-react';
import type { PermissionPredicate } from '@/config/route-manifest';
import { urgencyOf, type RowNote } from '@/features/dashboard/lib/home-model';
import { complianceActionRoute } from '@/lib/compliance-routes';
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

/** The state a row shows as a badge, when the dictionary of states has one for it. */
export type CockpitBadge =
  | { kind: 'property'; status: PropertyComplianceStatus }
  | { kind: 'alloggiati'; status: AlloggiatiWebStatus };

export interface CockpitRow {
  id: string;
  /** What the `data-testid`s of the row are called (`compliance-summary-<testKey>-link`), as the cockpit has always named its sections. */
  testKey: string;
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
  /** How pressing it is, when the server fixes a deadline. */
  note?: RowNote;
  badge?: CockpitBadge;
  /** Where the button goes; null when there is nothing this user can open for it. */
  to: string | null;
  /** The label of the button: what it does, or "Apri" for whoever may only look. */
  cta: string;
  /** Only to read (a property that is in order): the title opens its page and there is no button. */
  quiet?: boolean;
}

export interface CockpitModel {
  /** The stays to look after, most pressing first. */
  stays: CockpitRow[];
  /** The properties to activate. */
  properties: CockpitRow[];
  /** The properties that are in order, to read. */
  activeProperties: CockpitRow[];
  /** What the server counts, which is more than it lists (it sends the first ones of some sections). */
  stayTotal: number;
  propertyTotal: number;
  /** Counted by the server and not listed. */
  hidden: number;
  /** The one thing to do first, among those that have a place to go to. */
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
 * The sections of the cockpit in the order of urgency the Home uses for its "Da fare" (SR-03): a communication that failed,
 * one to send, the guest data it needs, the departure to close, the property to declare ready, and last the properties to
 * activate. Inside a section the server's order stays, except that a known deadline comes first.
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
  /** What the Home's "Da fare" says about the same things: the property and the deadline of a stay. Missing: the rows do without. */
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

function rowOf(item: ComplianceSummaryItem, section: Section, extras: { stay?: DashboardTodoItem; property?: Property }, context: CockpitContext): CockpitRow {
  const { t, hasPermission } = context;
  const known = isCockpitAction(item.action);
  const to = known ? complianceActionRoute(item, hasPermission) : null;
  const canWrite = hasPermission('short-rent', item.action === 'ActivateProperty' ? 'property.write' : 'booking.write');
  const cinMissing = item.action === 'ActivateProperty' && (item.missing ?? []).some((missing) => missing.code.startsWith('activation_cin'));
  const cta = known ? t(cinMissing ? 'dashboard.todo.ActivateProperty.ctaCin' : `dashboard.todo.${item.action}.cta`) : '';
  const dueAt = extras.stay?.dueAt ?? null;

  return {
    id: `${item.action}-${item.id}`,
    testKey: section.testKey,
    group: section.group,
    icon: section.icon,
    title: known ? t(`dashboard.todo.${item.action}.title`, { label: item.label }) : item.label,
    subject: item.label,
    sub: section.group === 'property' ? extras.property?.city?.trim() || undefined : extras.stay?.propertyName?.trim() || undefined,
    detail: missingDetail(item, context),
    note: dueAt ? urgencyOf(dueAt, context) : undefined,
    badge:
      section.group === 'property'
        ? { kind: 'property', status: extras.property?.complianceStatus === 'Suspended' ? 'Suspended' : 'Pending' }
        : section.badge,
    to,
    // Whoever may only look is taken to the page, not told to do what the page will not let them do.
    cta: canWrite ? cta : t('dashboard.todo.open'),
  };
}

/** Earliest known deadline first; items without one keep the order of the server. */
function byDeadline(items: ComplianceSummaryItem[], dueOf: (item: ComplianceSummaryItem) => number): ComplianceSummaryItem[] {
  return items
    .map((item, index) => ({ item, index, due: dueOf(item) }))
    .sort((a, b) => a.due - b.due || a.index - b.index)
    .map(({ item }) => item);
}

/**
 * What the cockpit shows, from `GET /api/compliance/summary` and, to say where and until when, from the Home's "Da fare" and
 * the list of properties. Those two only add words: a row is there because the summary says so, with or without them.
 */
export function buildCockpit(summary: ComplianceSummaryResult, extras: CockpitExtras, context: CockpitContext): CockpitModel {
  const todo = new Map((extras.todo ?? []).map((item) => [`${item.action}|${item.bookingId ?? item.propertyId ?? ''}`, item]));
  const properties = new Map((extras.properties ?? []).map((property) => [property.id, property]));
  const stayOf = (item: ComplianceSummaryItem) => todo.get(`${item.action}|${item.bookingId ?? item.propertyId ?? ''}`);
  const dueOf = (item: ComplianceSummaryItem) => {
    const due = stayOf(item)?.dueAt;
    const time = due ? new Date(due).getTime() : Number.NaN;
    return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
  };

  const stays: CockpitRow[] = [];
  const propertyRows: CockpitRow[] = [];
  const pendingIds = new Set<string>();
  let stayTotal = 0;
  let propertyTotal = 0;
  let hidden = 0;

  for (const section of SECTIONS) {
    const { count, items } = sectionOf(summary, section.field);
    hidden += Math.max(0, count - items.length);
    const rows = byDeadline(items, dueOf).map((item) =>
      rowOf(item, section, { stay: stayOf(item), property: item.propertyId ? properties.get(item.propertyId) : undefined }, context),
    );
    if (section.group === 'property') {
      propertyTotal += count;
      propertyRows.push(...rows);
      for (const item of items) if (item.propertyId) pendingIds.add(item.propertyId);
    } else {
      stayTotal += count;
      stays.push(...rows);
    }
  }

  // The others, in order: the state of every property is on the page, not only of the ones that need something.
  const activeProperties = [...properties.values()]
    .filter((property) => property.complianceStatus === 'Active' && !pendingIds.has(property.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (property): CockpitRow => ({
        id: `property-${property.id}`,
        testKey: 'properties-active',
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
    stays,
    properties: propertyRows,
    activeProperties,
    stayTotal,
    propertyTotal,
    hidden,
    focus: [...stays, ...propertyRows].find((row) => row.to !== null) ?? null,
  };
}
