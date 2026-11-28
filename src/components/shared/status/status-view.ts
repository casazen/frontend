import type { i18n as I18nInstance, TFunction } from "i18next";
import {
  getStatusDefinition,
  statusTextKey,
  type StatusIconName,
  type StatusKind,
  type StatusPerspective,
  type StatusTone,
} from "@/lib/status-dictionary";

export interface StatusView {
  known: boolean;
  tone: StatusTone;
  icon: StatusIconName;
  label: string;
  explain: string;
  need: string[];
  next: { status: string; label: string } | null;
}

const UNKNOWN: Pick<StatusView, "tone" | "icon"> = { tone: "neutral", icon: "circle-dashed" };

export const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-muted text-foreground ring-border",
  info: "bg-info-soft text-info-foreground ring-info-border",
  success: "bg-success-soft text-success-foreground ring-success-border",
  warning: "bg-warning-soft text-warning-foreground ring-warning-border",
  danger: "bg-danger-soft text-danger-foreground ring-danger-border",
};

function translated(t: TFunction, i18n: Pick<I18nInstance, "exists">, key: string): string | null {
  return i18n.exists(key) ? String(t(key)) : null;
}

function translatedList(t: TFunction, i18n: Pick<I18nInstance, "exists">, key: string): string[] {
  if (!i18n.exists(key)) return [];
  const value: unknown = t(key, { returnObjects: true });
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function statusLabel(kind: StatusKind, status: string, perspective: StatusPerspective, t: TFunction, i18n: Pick<I18nInstance, "exists">): string {
  const definition = getStatusDefinition(kind, status);
  if (!definition) return status;
  const supplierLabel = perspective === "supplier" && definition.supplier?.label;
  const own = translated(t, i18n, statusTextKey(kind, status, "label", supplierLabel ? "supplier" : "host"));
  return own ?? status;
}

/**
 * Everything the badge, the explainer and the pipeline show about a state, in one place: the entry of the dictionary with
 * its texts. A state the dictionary does not know is shown as it came (neutral, with a plain icon) instead of a raw key.
 */
export function getStatusView(kind: StatusKind, status: string, perspective: StatusPerspective, t: TFunction, i18n: Pick<I18nInstance, "exists">): StatusView {
  const definition = getStatusDefinition(kind, status);
  if (!definition) return { known: false, ...UNKNOWN, label: status, explain: "", need: [], next: null };

  // The supplier's own words, where the dictionary has them; the host's otherwise.
  const own = perspective === "supplier" ? definition.supplier : undefined;
  const explainKey = statusTextKey(kind, status, "explain", own ? "supplier" : "host");
  const needsOwnList = own ? own.need === true : definition.need === true;
  const need = definition.next && needsOwnList ? translatedList(t, i18n, statusTextKey(kind, status, "need", own ? "supplier" : "host")) : [];

  return {
    known: true,
    tone: own?.tone ?? definition.tone,
    icon: own?.icon ?? definition.icon,
    label: statusLabel(kind, status, perspective, t, i18n),
    explain: translated(t, i18n, explainKey) ?? "",
    need,
    next: definition.next ? { status: definition.next, label: statusLabel(kind, definition.next, perspective, t, i18n) } : null,
  };
}
