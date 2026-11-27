import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { formatRomeDateTime } from "@/lib/stay-dates";
import type { ServerWizardDraft } from "@/types/wizard";

const TIME_ONLY: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

interface WizardConflictDialogProps {
  open: boolean;
  /** Keeps what was typed here: it replaces the version saved elsewhere. Asked after the person confirms. */
  onKeepMine: () => void;
  /** Gives up what was typed here for the version of the server (the caller puts its values back in the form). Asked after the person confirms. */
  onTakeTheirs: () => void;
  /** The draft as the server holds it, for its time; `null` when the server has none left to show (then there is only «keep mine»). */
  serverDraft: ServerWizardDraft | null;
  /** The version of the draft on the server. */
  serverVersion: number;
}

/**
 * The draft of a wizard was also saved from another device or tab, and nothing was written: the person chooses which version to
 * keep (ADR-024-R7). The conflict has to be answered, so a click outside or Escape does not close it (as the dialogs of the lease
 * and of the showcase), and each choice asks for a confirmation that says in one line what it does (UX-11: click, confirm, action).
 *
 * Render it outside the `<form>` of the wizard: a dialog inside a form submits it.
 */
export function WizardConflictDialog({ open, onKeepMine, onTakeTheirs, serverDraft, serverVersion }: WizardConflictDialogProps) {
  const { t, i18n } = useTranslation();
  const [choice, setChoice] = useState<"keepMine" | "takeTheirs" | null>(null);

  const time = serverDraft ? formatRomeDateTime(serverDraft.lastSavedAt, i18n.language, TIME_ONLY) : "";
  const savedAt = time ? t("wizard.conflict.serverSavedAt", { time }) : null;
  const close = (next: boolean) => {
    if (!next) setChoice(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={() => undefined}>
        <DialogContent
          data-testid="wizard-conflict-dialog"
          data-server-version={serverVersion}
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{t("wizard.conflict.title")}</DialogTitle>
            <DialogDescription>{t("wizard.conflict.description")}</DialogDescription>
          </DialogHeader>
          {savedAt ? (
            <p data-testid="wizard-conflict-saved-at" className="text-sm text-muted-foreground">
              {savedAt}
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            {serverDraft ? (
              <Button type="button" variant="outline" data-testid="wizard-conflict-take-theirs" onClick={() => setChoice("takeTheirs")}>
                {t("wizard.conflict.takeTheirs")}
              </Button>
            ) : null}
            <Button type="button" data-testid="wizard-conflict-keep-mine" onClick={() => setChoice("keepMine")}>
              {t("wizard.conflict.keepMine")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={open && choice === "keepMine"}
        onOpenChange={close}
        title={t("wizard.conflict.keepMine")}
        description={savedAt ?? t("wizard.conflict.description")}
        consequences={[t("wizard.conflict.confirmKeepMine")]}
        confirmLabel={t("wizard.conflict.keepMine")}
        onConfirm={onKeepMine}
      />
      <ConfirmationDialog
        open={open && choice === "takeTheirs"}
        onOpenChange={close}
        title={t("wizard.conflict.takeTheirs")}
        description={savedAt ?? t("wizard.conflict.description")}
        consequences={[t("wizard.conflict.confirmTakeTheirs")]}
        confirmLabel={t("wizard.conflict.takeTheirs")}
        onConfirm={onTakeTheirs}
      />
    </>
  );
}
