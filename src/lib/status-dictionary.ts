import type { AlloggiatiWebStatus } from "@/types/alloggiati.types";
import type { AdminSupplierStatus } from "@/types/admin-suppliers";
import type { BillingSubscriptionStatus } from "@/types/billing.types";
import type { BookingStatus } from "@/types/booking.types";
import type { PropertyComplianceStatus } from "@/types/compliance.types";
import type { LeaseStatus } from "@/types/lease.types";
import type { GuestCheckInSessionStatus } from "@/types/public-checkin.types";
import type { RentInstallmentStatus } from "@/types/rent.types";
import type { ServiceRequestStatus } from "@/types/service-request";

/**
 * The states of the things a person manages, each told the same way: an icon and a word (never only a color), a sentence
 * that says what it means, and what is needed to move on. Used by `StatusBadge`, `StatusExplainer` and `StatusPipeline`.
 *
 * The keys are the values the API sends (the backend enums), so a state is looked up with what the server answered. Each
 * kind is typed against the frontend's copy of its enum: a value added to the enum without an entry here does not compile,
 * and `status-dictionary.test.ts` checks that every entry has its texts in both languages. Texts are in the `status`
 * namespace of the locale files: `status.<kind>.<key>.label`, `.explain` and, when the state has a way forward, `.need` (a
 * list). Where the supplier sees the same request differently the entry has a `supplier` part with its own texts
 * (`status.<kind>.<key>.supplier.explain`, and `label` / `need` when they differ).
 *
 * Statements about rules of law (Alloggiati Web, registration of a lease) follow `backend/.claude/context/regulations`
 * (decision D32), not the demo.
 *
 * Kinds of the demo that are not here, on purpose: `site` (a state derived from the publication checks, no enum), `invoice`
 * and `compliance` (no enum in the backend yet). They come when their enum exists.
 */

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

/** Names of the icons, drawn in `components/shared/status/status-icons.ts`. */
export type StatusIconName =
  | "alert-circle"
  | "alert-triangle"
  | "badge-check"
  | "ban"
  | "calendar-check"
  | "check"
  | "check-circle"
  | "circle-dashed"
  | "clock"
  | "euro"
  | "hourglass"
  | "id-card"
  | "inbox"
  | "key"
  | "landmark"
  | "mail"
  | "pause"
  | "pencil"
  | "send"
  | "shield-check"
  | "signature"
  | "wrench"
  | "x-circle";

export type StatusPerspective = "host" | "supplier";

export interface StatusDefinition<Key extends string = string> {
  tone: StatusTone;
  icon: StatusIconName;
  /** The state this one moves to on the way forward; `need` lists what it takes. */
  next?: Key;
  /** There is a list of what it takes to reach `next` (`status.<kind>.<key>.need`). */
  need?: true;
  /** Not a value of the backend enum: the interface works it out (`Paused`, `Overdue`). */
  derived?: true;
  /** The supplier sees this state with other words (`status.<kind>.<key>.supplier.*`; `explain` is always there). */
  supplier?: { tone?: StatusTone; icon?: StatusIconName; label?: true; need?: true };
}

/** Types a kind against its enum: all the values are there, and only them. */
function defineKind<Key extends string>(definitions: Record<Key, StatusDefinition<Key>>): Record<Key, StatusDefinition<Key>> {
  return definitions;
}

/** Status of a property: the compliance status of the API, plus the pause that the host sets (`isPaused`). */
export type PropertyStatus = PropertyComplianceStatus | "Paused";
/** `OrgMemberStatus` (a member) and `OrgInvitationStatus` (an invitation) of the backend: the list of people shows both. */
export type MemberStatus = "Active" | "Deactivated" | "Pending" | "Accepted" | "Revoked" | "Expired";
/** Status of a rent installment: the one of the API, plus `Overdue` (not paid after its due date: the API says it with `isOverdue`). */
export type RentStatus = RentInstallmentStatus | "Overdue";

export const STATUS_DICTIONARY = {
  booking: defineKind<BookingStatus>({
    Pending: { tone: "warning", icon: "hourglass", next: "Confirmed", need: true },
    Confirmed: { tone: "success", icon: "check-circle", next: "CheckedIn", need: true },
    CheckedIn: { tone: "info", icon: "key", next: "CheckedOut", need: true },
    CheckedOut: { tone: "neutral", icon: "check" },
    Cancelled: { tone: "danger", icon: "x-circle" },
  }),
  property: defineKind<PropertyStatus>({
    Pending: { tone: "warning", icon: "hourglass", next: "Active", need: true },
    Active: { tone: "success", icon: "check-circle" },
    Suspended: { tone: "danger", icon: "ban", next: "Active", need: true },
    Paused: { tone: "neutral", icon: "pause", next: "Active", need: true, derived: true },
  }),
  request: defineKind<ServiceRequestStatus>({
    Richiesto: { tone: "info", icon: "send", next: "PresoInCarico", need: true, supplier: { tone: "warning", icon: "inbox", label: true, need: true } },
    PresoInCarico: { tone: "info", icon: "calendar-check", next: "InCorso", need: true, supplier: { need: true } },
    InCorso: { tone: "info", icon: "wrench", next: "Completato", need: true, supplier: { need: true } },
    Completato: { tone: "warning", icon: "euro", next: "Pagato", need: true, supplier: { tone: "neutral", icon: "clock", label: true, need: true } },
    Pagato: { tone: "success", icon: "check-circle", supplier: {} },
    Rifiutato: { tone: "danger", icon: "x-circle", supplier: { tone: "neutral" } },
    Annullato: { tone: "neutral", icon: "ban" },
  }),
  member: defineKind<MemberStatus>({
    Active: { tone: "success", icon: "check-circle" },
    Deactivated: { tone: "neutral", icon: "ban" },
    Pending: { tone: "warning", icon: "mail", next: "Active", need: true },
    Accepted: { tone: "success", icon: "check-circle" },
    Revoked: { tone: "neutral", icon: "ban" },
    Expired: { tone: "neutral", icon: "clock" },
  }),
  subscription: defineKind<BillingSubscriptionStatus>({
    active: { tone: "success", icon: "check-circle" },
    trialing: { tone: "info", icon: "clock", next: "active", need: true },
    past_due: { tone: "danger", icon: "alert-circle", next: "active", need: true },
    incomplete: { tone: "warning", icon: "hourglass", next: "active", need: true },
    unpaid: { tone: "danger", icon: "alert-circle", next: "active", need: true },
    canceled: { tone: "neutral", icon: "ban", next: "active", need: true },
    none: { tone: "neutral", icon: "circle-dashed", next: "active", need: true },
  }),
  lease: defineKind<LeaseStatus>({
    Draft: { tone: "neutral", icon: "pencil", next: "AwaitingSignature", need: true },
    AwaitingSignature: { tone: "info", icon: "signature", next: "Signed", need: true },
    PartiallySigned: { tone: "info", icon: "signature", next: "Signed", need: true },
    Signed: { tone: "warning", icon: "landmark", next: "Registered", need: true },
    RegistrationPending: { tone: "warning", icon: "clock", next: "Registered", need: true },
    SentToProvider: { tone: "info", icon: "send", next: "Registered", need: true },
    Registered: { tone: "success", icon: "check-circle" },
    Rejected: { tone: "danger", icon: "alert-circle", next: "Registered", need: true },
  }),
  rent: defineKind<RentStatus>({
    Scheduled: { tone: "neutral", icon: "clock", next: "Paid", need: true },
    Overdue: { tone: "danger", icon: "alert-circle", next: "Paid", need: true, derived: true },
    Processing: { tone: "info", icon: "hourglass", next: "Paid", need: true },
    Paid: { tone: "success", icon: "check-circle" },
    Failed: { tone: "danger", icon: "alert-circle", next: "Paid", need: true },
    Cancelled: { tone: "neutral", icon: "ban" },
  }),
  supplier: defineKind<AdminSupplierStatus>({
    Pending: { tone: "warning", icon: "hourglass", next: "Active", need: true },
    Active: { tone: "success", icon: "badge-check" },
    Suspended: { tone: "danger", icon: "ban" },
  }),
  checkin: defineKind<GuestCheckInSessionStatus>({
    Inviato: { tone: "neutral", icon: "send", next: "Completo", need: true },
    InCompilazione: { tone: "info", icon: "pencil", next: "Completo", need: true },
    Completo: { tone: "success", icon: "id-card" },
    AlloggiatiInviato: { tone: "success", icon: "shield-check" },
    Scaduto: { tone: "danger", icon: "alert-circle", next: "Inviato", need: true },
  }),
  alloggiati: defineKind<AlloggiatiWebStatus>({
    DaInviare: { tone: "neutral", icon: "clock" },
    DaInviareManualmente: { tone: "warning", icon: "alert-triangle", next: "InviatoManualmente", need: true },
    InviatoManualmente: { tone: "success", icon: "shield-check" },
    Inviato: { tone: "success", icon: "shield-check" },
    Rifiutato: { tone: "danger", icon: "alert-circle", next: "InviatoManualmente", need: true },
    Errore: { tone: "danger", icon: "alert-circle", next: "InviatoManualmente", need: true },
  }),
} as const;

export type StatusKind = keyof typeof STATUS_DICTIONARY;
/** The states of a kind. */
export type StatusOf<K extends StatusKind> = Extract<keyof (typeof STATUS_DICTIONARY)[K], string>;

/**
 * The way forward of the kinds that have one, as the states a flow goes through. A state that is not on the path but is
 * part of it while it lasts (`PartiallySigned` is still "awaiting signature") has its place in `PIPELINE_STEP_OF`.
 */
export const STATUS_PIPELINES: { [K in StatusKind]?: ReadonlyArray<StatusOf<K>> } = {
  booking: ["Pending", "Confirmed", "CheckedIn", "CheckedOut"],
  property: ["Pending", "Active"],
  request: ["Richiesto", "PresoInCarico", "InCorso", "Completato", "Pagato"],
  lease: ["Draft", "AwaitingSignature", "Signed", "RegistrationPending", "Registered"],
  rent: ["Scheduled", "Processing", "Paid"],
  member: ["Pending", "Active"],
  checkin: ["Inviato", "InCompilazione", "Completo", "AlloggiatiInviato"],
};

/** Where a state that is not a step of its pipeline sits while it lasts. */
export const PIPELINE_STEP_OF: { [K in StatusKind]?: { [S in StatusOf<K>]?: StatusOf<K> } } = {
  lease: { PartiallySigned: "AwaitingSignature", SentToProvider: "RegistrationPending" },
  member: { Accepted: "Active" },
  rent: { Overdue: "Scheduled", Failed: "Scheduled" },
};

export function isStatusKind(value: string): value is StatusKind {
  return Object.prototype.hasOwnProperty.call(STATUS_DICTIONARY, value);
}

/** The entry of a state, or `null` when the server sent a value this version of the app does not know. */
export function getStatusDefinition(kind: StatusKind, status: string): StatusDefinition<string> | null {
  const kindDefinitions = STATUS_DICTIONARY[kind] as unknown as Record<string, StatusDefinition<string>>;
  return Object.prototype.hasOwnProperty.call(kindDefinitions, status) ? kindDefinitions[status] : null;
}

export type StatusTextPart = "label" | "explain" | "need";

/** Key of a text of the dictionary in the locale files. The supplier's own texts are under `supplier`. */
export function statusTextKey(kind: StatusKind, status: string, part: StatusTextPart, perspective: StatusPerspective = "host"): string {
  return perspective === "supplier" ? `status.${kind}.${status}.supplier.${part}` : `status.${kind}.${status}.${part}`;
}

/** The status of a property to show: suspended first (it needs fixing), then the pause the host set, then the compliance status. */
export function propertyStatus(property: { complianceStatus?: string | null; isPaused?: boolean }): PropertyStatus {
  const compliance = property.complianceStatus;
  if (compliance === "Suspended") return "Suspended";
  if (property.isPaused) return "Paused";
  return compliance === "Active" ? "Active" : "Pending";
}

/** The status of a rent installment to show: not paid after its due date is `Overdue`, whatever the API calls it. */
export function rentStatus(installment: { status: RentInstallmentStatus; isOverdue?: boolean }): RentStatus {
  const open = installment.status === "Scheduled" || installment.status === "Failed";
  return installment.isOverdue && open ? "Overdue" : installment.status;
}

/** Index of the step of the pipeline a state is at, or -1 when it is off the path (cancelled, rejected...) or has no pipeline. */
export function pipelineIndex(kind: StatusKind, status: string): number {
  const pipeline = STATUS_PIPELINES[kind] as ReadonlyArray<string> | undefined;
  if (!pipeline) return -1;
  const aliases = PIPELINE_STEP_OF[kind] as Record<string, string> | undefined;
  return pipeline.indexOf(aliases?.[status] ?? status);
}
