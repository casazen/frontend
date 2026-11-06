import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { formatRomeDateTime } from "@/lib/stay-dates";
import { cn } from "@/lib/utils";
import type { WizardSaveStatus } from "@/types/wizard";

const TIME_ONLY: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

interface SaveIndicatorProps {
  /** Where the saving stands. */
  status: WizardSaveStatus;
  /** When the server saved the draft last, ms since the epoch: the «saved at» is the time of the server, in Europe/Rome. */
  savedAt: number | null;
  /** Sends again what could not be saved. */
  onRetry: () => void;
  "data-testid"?: string;
  className?: string;
}

/**
 * Says where the saving of a draft stands: «Saving…» while a change waits or is on its way, «Saved at HH:MM» once the server has it,
 * and the error with a «Try again» button when it could not be saved. A live region (`aria-live="polite"`) that is always on the page,
 * so that a screen reader announces each change; empty while nothing has happened (and while a conflict waits for the person to choose,
 * which the conflict dialog says).
 */
export function SaveIndicator({ status, savedAt, onRetry, className, "data-testid": testId }: SaveIndicatorProps) {
  const { t, i18n } = useTranslation();
  const time = savedAt !== null && Number.isFinite(savedAt) ? formatRomeDateTime(new Date(savedAt).toISOString(), i18n.language, TIME_ONLY) : "";

  return (
    <p aria-live="polite" data-testid={testId} className={cn("min-w-0 text-xs text-muted-foreground", className)}>
      {status === "pending" || status === "saving" ? t("wizard.saving") : null}
      {status === "saved" && time ? t("wizard.savedAt", { time }) : null}
      {status === "error" ? (
        <>
          <span className="text-[color:var(--color-danger-foreground,#b4232a)]">{t("wizard.saveError")}</span>{" "}
          <Button type="button" variant="link" size="sm" onClick={onRetry} className="h-auto px-1 py-0 text-xs">
            {t("wizard.saveRetry")}
          </Button>
        </>
      ) : null}
    </p>
  );
}
