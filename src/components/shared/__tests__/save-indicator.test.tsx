import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import i18n from "@/i18n/config";
import type { WizardSaveStatus } from "@/types/wizard";
import { SaveIndicator } from "../save-indicator";

// 09:30 UTC is 10:30 in Rome in November.
const SERVER_TIME = Date.UTC(2026, 10, 6, 9, 30);

const show = (status: WizardSaveStatus, savedAt: number | null = SERVER_TIME, onRetry = vi.fn()) => {
  render(<SaveIndicator status={status} savedAt={savedAt} onRetry={onRetry} data-testid="indicator" />);
  return { onRetry, indicator: screen.getByTestId("indicator") };
};

describe("SaveIndicator", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("it");
  });

  afterEach(() => {
    cleanup();
  });

  it("SaveIndicator_Saved_SaysWhenTheServerSavedItInRomeTime", () => {
    const { indicator } = show("saved");

    expect(indicator).toHaveTextContent("Salvato alle 10:30");
    expect(indicator).toHaveAttribute("aria-live", "polite");
  });

  it("SaveIndicator_SavedInEnglish_UsesTheEnglishText", async () => {
    await i18n.changeLanguage("en");

    const { indicator } = show("saved");

    // English clocks add AM / PM after the time.
    expect(indicator).toHaveTextContent(/^Saved at 10:30/);
  });

  it.each<WizardSaveStatus>(["pending", "saving"])("SaveIndicator_%s_SaysItIsSaving", (status) => {
    const { indicator } = show(status);

    expect(indicator).toHaveTextContent("Salvataggio…");
    expect(indicator).not.toHaveTextContent("Salvato alle");
  });

  it("SaveIndicator_Error_SaysItAndOffersToTryAgain", () => {
    const { indicator, onRetry } = show("error");

    expect(indicator).toHaveTextContent("Non riesco a salvare");
    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it.each<WizardSaveStatus>(["idle", "conflict"])("SaveIndicator_%s_StaysEmptyButStaysOnThePageForTheScreenReader", (status) => {
    const { indicator } = show(status);

    expect(indicator).toBeEmptyDOMElement();
  });

  it("SaveIndicator_SavedWithNoTimeKnown_SaysNothingInsteadOfAWrongTime", () => {
    const { indicator } = show("saved", null);

    expect(indicator).toBeEmptyDOMElement();
  });
});
