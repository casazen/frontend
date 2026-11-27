import type { AlloggiatiWebStatus } from "@/types/alloggiati.types";
import type { AdminSupplierStatus } from "@/types/admin-suppliers";
import type { BillingSubscriptionStatus } from "@/types/billing.types";
import type { BookingStatus } from "@/types/booking.types";
import type { CinStatus } from "@/types/cin.types";
import type { ChannelPublishStatus } from "@/types/listing.types";
import type { PropertyComplianceStatus } from "@/types/compliance.types";
import type { LeaseStage, LeaseStatus } from "@/types/lease.types";
import type { PaymentStatus } from "@/types/payment.types";
import type { GuestCheckInSessionStatus } from "@/types/public-checkin.types";
import type { RentInstallmentStatus } from "@/types/rent.types";
import type { ServiceRequestStatus } from "@/types/service-request";
import type { SupplierEarningState } from "@/types/supplier-earnings";
import type { SupplierServiceStatus } from "@/types/supplier-services";

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
  | "undo"
  | "wrench"
  | "x-circle";

export type StatusPerspective = "host" | "supplier";

export interface StatusDefinition<Key extends string = string> {
  tone: StatusTone;
  icon: StatusIconName;
  next?: Key;
  need?: true;
  derived?: true;
  supplier?: { tone?: StatusTone; icon?: StatusIconName; label?: true; need?: true };
}

function defineKind<Key extends string>(definitions: Record<Key, StatusDefinition<Key>>): Record<Key, StatusDefinition<Key>> {
  return definitions;
}

export type PropertyStatus = PropertyComplianceStatus | "Paused";
export type LongRentPropertyStatus = "Rented" | "Free";
export type FiscalRegimeStatus = "Confirmed" | "ToConfirm" | "NotChosen";
export type MemberStatus = "Active" | "Deactivated" | "Pending" | "Accepted" | "Revoked" | "Expired";
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
  longRentProperty: defineKind<LongRentPropertyStatus>({
    Rented: { tone: "info", icon: "key", derived: true },
    Free: { tone: "neutral", icon: "circle-dashed", next: "Rented", need: true, derived: true },
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
  /**
   * Where a long-term lease stands on its path (LR-01b, LR-09): the stage the server decides and sends with the lease, from the draft to the
   * end. Preparing is told by what the landlord still has to do; once the contract is signed the words follow the life of the lease. The
   * stage `DataPending` is for the tenant's own data (phase 2) and is not sent yet, but it has its words.
   */
  leaseStage: defineKind<LeaseStage>({
    Draft: { tone: "neutral", icon: "pencil", next: "InReview", need: true },
    DataPending: { tone: "info", icon: "hourglass", next: "InReview", need: true },
    InReview: { tone: "info", icon: "shield-check", next: "SentForSignature", need: true },
    SentForSignature: { tone: "info", icon: "signature", next: "Signed", need: true },
    Signed: { tone: "warning", icon: "landmark", next: "Active", need: true },
    Active: { tone: "success", icon: "check-circle" },
    Expiring: { tone: "warning", icon: "clock" },
    Concluded: { tone: "neutral", icon: "check" },
  }),
  rent: defineKind<RentStatus>({
    Scheduled: { tone: "neutral", icon: "clock", next: "Paid", need: true },
    Overdue: { tone: "danger", icon: "alert-circle", next: "Paid", need: true, derived: true },
    Processing: { tone: "info", icon: "hourglass", next: "Paid", need: true },
    Paid: { tone: "success", icon: "check-circle" },
    Failed: { tone: "danger", icon: "alert-circle", next: "Paid", need: true },
    Cancelled: { tone: "neutral", icon: "ban" },
  }),
  payment: defineKind<PaymentStatus>({
    Pending: { tone: "warning", icon: "clock" },
    Processing: { tone: "info", icon: "hourglass" },
    Completed: { tone: "success", icon: "check-circle" },
    Failed: { tone: "danger", icon: "alert-circle" },
    Refunded: { tone: "neutral", icon: "undo" },
    PartiallyRefunded: { tone: "neutral", icon: "undo" },
    Canceled: { tone: "neutral", icon: "ban" },
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
    Sending: { tone: "info", icon: "send" },
    PartiallyAccepted: { tone: "warning", icon: "alert-triangle" },
    ToVerify: { tone: "warning", icon: "alert-circle" },
    DaInviare: { tone: "neutral", icon: "clock" },
    DaInviareManualmente: { tone: "warning", icon: "alert-triangle", next: "InviatoManualmente", need: true },
    InviatoManualmente: { tone: "success", icon: "shield-check" },
    SentReceiptPending: { tone: "info", icon: "clock", next: "Inviato", need: true },
    Inviato: { tone: "success", icon: "shield-check" },
    Rifiutato: { tone: "danger", icon: "alert-circle", next: "InviatoManualmente", need: true },
    Errore: { tone: "danger", icon: "alert-circle", next: "InviatoManualmente", need: true },
    NotDue: { tone: "neutral", icon: "circle-dashed" },
    EntrustedToChannelManager: { tone: "warning", icon: "hourglass", next: "Inviato", need: true },
    ChannelManagerWriteFailed: { tone: "danger", icon: "alert-circle", next: "EntrustedToChannelManager", need: true },
  }),
  /** The CIN of a property, as `GET /properties/cin-compliance` says it. The deadline and the penalties are the page's: they come from the backend. */
  cin: defineKind<CinStatus>({
    valid: { tone: "success", icon: "id-card" },
    missing: { tone: "warning", icon: "alert-triangle" },
    invalid: { tone: "danger", icon: "alert-circle" },
  }),
  fiscalRegime: defineKind<FiscalRegimeStatus>({
    Confirmed: { tone: "success", icon: "check-circle", derived: true },
    ToConfirm: { tone: "warning", icon: "hourglass", derived: true },
    NotChosen: { tone: "warning", icon: "circle-dashed", derived: true },
  }),
  channel: defineKind<ChannelPublishStatus>({
    Draft: { tone: "neutral", icon: "pencil" },
    Sending: { tone: "warning", icon: "send" },
    Accepted: { tone: "warning", icon: "hourglass" },
    Published: { tone: "success", icon: "check-circle" },
    ToFix: { tone: "danger", icon: "alert-circle" },
    ManagedOnChannel: { tone: "neutral", icon: "circle-dashed" },
  }),
  serviceListing: defineKind<SupplierServiceStatus>({
    Draft: { tone: "neutral", icon: "pencil" },
    Active: { tone: "success", icon: "check-circle" },
    Paused: { tone: "warning", icon: "pause" },
  }),
  earning: defineKind<SupplierEarningState>({
    to_collect: { tone: "info", icon: "hourglass" },
    paid: { tone: "success", icon: "check-circle" },
    late: { tone: "danger", icon: "alert-triangle" },
    in_review: { tone: "warning", icon: "alert-circle" },
    refunded: { tone: "neutral", icon: "undo" },
    partially_refunded: { tone: "neutral", icon: "undo" },
  }),
} as const;

export type StatusKind = keyof typeof STATUS_DICTIONARY;
export type StatusOf<K extends StatusKind> = Extract<keyof (typeof STATUS_DICTIONARY)[K], string>;

export const STATUS_PIPELINES: { [K in StatusKind]?: ReadonlyArray<StatusOf<K>> } = {
  booking: ["Pending", "Confirmed", "CheckedIn", "CheckedOut"],
  property: ["Pending", "Active"],
  request: ["Richiesto", "PresoInCarico", "InCorso", "Completato", "Pagato"],
  lease: ["Draft", "AwaitingSignature", "Signed", "RegistrationPending", "Registered"],
  rent: ["Scheduled", "Processing", "Paid"],
  member: ["Pending", "Active"],
  checkin: ["Inviato", "InCompilazione", "Completo", "AlloggiatiInviato"],
};

export const PIPELINE_STEP_OF: { [K in StatusKind]?: { [S in StatusOf<K>]?: StatusOf<K> } } = {
  lease: { PartiallySigned: "AwaitingSignature", SentToProvider: "RegistrationPending" },
  member: { Accepted: "Active" },
  rent: { Overdue: "Scheduled", Failed: "Scheduled" },
};

export function isStatusKind(value: string): value is StatusKind {
  return Object.prototype.hasOwnProperty.call(STATUS_DICTIONARY, value);
}

export function getStatusDefinition(kind: StatusKind, status: string): StatusDefinition<string> | null {
  const kindDefinitions = STATUS_DICTIONARY[kind] as unknown as Record<string, StatusDefinition<string>>;
  return Object.prototype.hasOwnProperty.call(kindDefinitions, status) ? kindDefinitions[status] : null;
}

export type StatusTextPart = "label" | "explain" | "need";

export function statusTextKey(kind: StatusKind, status: string, part: StatusTextPart, perspective: StatusPerspective = "host"): string {
  return perspective === "supplier" ? `status.${kind}.${status}.supplier.${part}` : `status.${kind}.${status}.${part}`;
}

export function propertyStatus(property: { complianceStatus?: string | null; isPaused?: boolean; isActive?: boolean }): PropertyStatus {
  if (property.isActive === false) return "Pending";
  const compliance = property.complianceStatus;
  if (compliance === "Suspended") return "Suspended";
  if (property.isPaused) return "Paused";
  return compliance === "Active" ? "Active" : "Pending";
}

export function rentStatus(installment: { status: RentInstallmentStatus; isOverdue?: boolean }): RentStatus {
  const open = installment.status === "Scheduled" || installment.status === "Failed";
  return installment.isOverdue && open ? "Overdue" : installment.status;
}

export function pipelineIndex(kind: StatusKind, status: string): number {
  const pipeline = STATUS_PIPELINES[kind] as ReadonlyArray<string> | undefined;
  if (!pipeline) return -1;
  const aliases = PIPELINE_STEP_OF[kind] as Record<string, string> | undefined;
  return pipeline.indexOf(aliases?.[status] ?? status);
}
