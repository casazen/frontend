import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "@/i18n/config";
import type { ServerWizardDraft } from "@/types/wizard";
import { WizardConflictDialog } from "../wizard-conflict-dialog";

// 09:30 UTC is 10:30 in Rome in November.
const SERVER_DRAFT: ServerWizardDraft = {
  type: "BookingCreate",
  entityId: null,
  version: 7,
  data: { shape: 1, step: "dates", values: { name: "Theirs" } },
  lastSavedAt: "2026-11-06T09:30:00Z",
};

function show(serverDraft: ServerWizardDraft | null = SERVER_DRAFT) {
  const onKeepMine = vi.fn();
  const onTakeTheirs = vi.fn();
  render(<WizardConflictDialog open serverDraft={serverDraft} serverVersion={7} onKeepMine={onKeepMine} onTakeTheirs={onTakeTheirs} />);
  return { onKeepMine, onTakeTheirs };
}

const confirmation = (name: string) => within(screen.getByRole("dialog", { name }));

describe("WizardConflictDialog", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("it");
  });

  afterEach(() => {
    cleanup();
  });

  it("WizardConflictDialog_Open_OffersKeepMineAndTakeTheirsAndSaysWhenTheServerVersionWasSaved", () => {
    show();

    expect(screen.getByRole("dialog", { name: "Conflitto di versione" })).toBeInTheDocument();
    expect(screen.getByTestId("wizard-conflict-saved-at")).toHaveTextContent("Versione salvata alle 10:30");
    expect(screen.getByRole("button", { name: "Mantieni le mie modifiche" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Usa la versione del server" })).toBeInTheDocument();
  });

  it("WizardConflictDialog_KeepMine_AsksForConfirmationAndOnlyThenKeeps", async () => {
    const { onKeepMine, onTakeTheirs } = show();

    fireEvent.click(screen.getByTestId("wizard-conflict-keep-mine"));
    const asked = confirmation("Mantieni le mie modifiche");

    expect(asked.getByText("Le tue modifiche sostituiranno la versione salvata altrove.")).toBeInTheDocument();
    expect(onKeepMine).not.toHaveBeenCalled();

    fireEvent.click(asked.getByRole("button", { name: "Mantieni le mie modifiche" }));

    await waitFor(() => expect(onKeepMine).toHaveBeenCalledTimes(1));
    expect(onTakeTheirs).not.toHaveBeenCalled();
  });

  it("WizardConflictDialog_TakeTheirs_AsksForConfirmationAndOnlyThenTakes", async () => {
    const { onKeepMine, onTakeTheirs } = show();

    fireEvent.click(screen.getByTestId("wizard-conflict-take-theirs"));
    const asked = confirmation("Usa la versione del server");

    expect(asked.getByText("Le modifiche non salvate di questa scheda andranno perse.")).toBeInTheDocument();
    expect(onTakeTheirs).not.toHaveBeenCalled();

    fireEvent.click(asked.getByRole("button", { name: "Usa la versione del server" }));

    await waitFor(() => expect(onTakeTheirs).toHaveBeenCalledTimes(1));
    expect(onKeepMine).not.toHaveBeenCalled();
  });

  it("WizardConflictDialog_ChangedMind_CancellingTheConfirmationChangesNothing", async () => {
    const { onKeepMine, onTakeTheirs } = show();

    fireEvent.click(screen.getByTestId("wizard-conflict-take-theirs"));
    fireEvent.click(confirmation("Usa la versione del server").getByRole("button", { name: "Annulla" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Usa la versione del server" })).not.toBeInTheDocument());
    expect(onKeepMine).not.toHaveBeenCalled();
    expect(onTakeTheirs).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Conflitto di versione" })).toBeInTheDocument();
  });

  it("WizardConflictDialog_NoServerDraftLeft_OffersOnlyKeepMine", () => {
    show(null);

    expect(screen.queryByTestId("wizard-conflict-take-theirs")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wizard-conflict-saved-at")).not.toBeInTheDocument();
    expect(screen.getByTestId("wizard-conflict-keep-mine")).toBeInTheDocument();
  });

  it("WizardConflictDialog_English_UsesTheEnglishTexts", async () => {
    await i18n.changeLanguage("en");

    show();

    expect(screen.getByRole("dialog", { name: "Version conflict" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep my changes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use server version" })).toBeInTheDocument();
    expect(screen.getByTestId("wizard-conflict-saved-at")).toHaveTextContent(/^Version saved at 10:30/);
  });
});
