import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CalendarPlus } from "lucide-react";
import i18n from "@/i18n/config";
import { WizardDone, type WizardDoneProps } from "../wizard-done";

const PROPS: WizardDoneProps = {
  title: "Immobile creato",
  description: "Casa Aurora è nell'elenco dei tuoi immobili.",
  whatNext: [
    { text: "Abbiamo salvato i dati e le foto." },
    { text: "Per ricevere prenotazioni completa l'attivazione." },
    { text: "Ti ricordiamo ogni scadenza.", icon: CalendarPlus },
  ],
  primary: { label: "Apri l'immobile", to: "/app/short-rent/properties/p-1" },
  secondary: { label: "Aggiungi un altro immobile", to: "/app/short-rent/properties/new" },
};

const renderDone = (props: Partial<WizardDoneProps> = {}) =>
  render(
    <MemoryRouter>
      <WizardDone {...PROPS} {...props} />
    </MemoryRouter>,
  );

beforeEach(async () => {
  await i18n.changeLanguage("it");
});

afterEach(cleanup);

describe("WizardDone", () => {
  it("WizardDone_Opening_ConfirmsWhatWasDoneAndTheFocusGoesThere", () => {
    renderDone();

    const title = screen.getByRole("heading", { level: 2, name: "Immobile creato" });
    expect(title).toHaveFocus();
    expect(screen.getByText("Casa Aurora è nell'elenco dei tuoi immobili.")).toBeInTheDocument();
  });

  it("WizardDone_WhatHappensNow_ListsThePoints", () => {
    renderDone();

    const section = screen.getByRole("region", { name: "Cosa succede ora" });
    expect(within(section).getByRole("heading", { level: 3, name: "Cosa succede ora" })).toBeInTheDocument();
    const items = within(section).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Abbiamo salvato i dati e le foto.",
      "Per ricevere prenotazioni completa l'attivazione.",
      "Ti ricordiamo ogni scadenza.",
    ]);
  });

  it("WizardDone_TwoActions_AreLinksTheMainOneTowardWhatWasCreated", () => {
    renderDone();

    const primary = screen.getByRole("link", { name: "Apri l'immobile" });
    const secondary = screen.getByRole("link", { name: "Aggiungi un altro immobile" });
    expect(primary).toHaveAttribute("href", "/app/short-rent/properties/p-1");
    expect(secondary).toHaveAttribute("href", "/app/short-rent/properties/new");
    // No dead end, and nothing else to press: exactly these two ways on.
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    // The main action is the filled one, the other is quieter.
    expect(primary.className).toContain("bg-primary");
    expect(secondary.className).not.toContain("bg-primary");
  });

  it("WizardDone_NoDescription_RendersNoEmptyLine", () => {
    renderDone({ description: undefined });

    expect(screen.getByRole("heading", { level: 2 }).parentElement?.querySelectorAll("p")).toHaveLength(0);
  });

  it("WizardDone_PointsAndActions_DoNotPushThePageSideways", () => {
    renderDone();

    for (const link of screen.getAllByRole("link")) {
      expect(link.className).toContain("whitespace-normal");
      expect(link.className).toContain("min-h-11");
    }
    expect(screen.getByRole("heading", { level: 2 }).className).toContain("break-words");
    for (const item of screen.getAllByRole("listitem")) {
      expect(item.className).toContain("min-w-0");
    }
  });

  it("WizardDone_EnglishLanguage_TranslatesTheHeadingOfThePoints", async () => {
    await i18n.changeLanguage("en");

    renderDone();

    expect(screen.getByRole("heading", { level: 3, name: "What happens now" })).toBeInTheDocument();
  });

  it("WizardDone_DecorativeIcons_AreHiddenFromAssistiveTechnology", () => {
    const { container } = renderDone();

    const icons = container.querySelectorAll("svg");
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) expect(icon).toHaveAttribute("aria-hidden", "true");
  });
});
