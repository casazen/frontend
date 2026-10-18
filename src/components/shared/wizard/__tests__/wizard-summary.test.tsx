import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "@/i18n/config";
import { WizardContext, type WizardContextValue } from "../wizard-context";
import { WizardSummary, type WizardSummaryItem } from "../wizard-summary";

const ITEMS: WizardSummaryItem[] = [
  { id: "name", label: "Nome", value: "Casa Aurora", stepId: "basics" },
  { id: "rooms", label: "Stanze", value: 0, stepId: "basics" },
  { id: "cin", label: "Codice CIN", value: "", stepId: "cin" },
  { id: "notes", label: "Note", value: null },
  { id: "pets", label: "Animali", value: false },
];

const wizard: WizardContextValue = {
  stepId: "review",
  stepIndex: 2,
  steps: [
    { id: "basics", label: "Dati" },
    { id: "cin", label: "CIN" },
    { id: "review", label: "Riepilogo" },
  ],
  hrefFor: (stepId) => ({ search: `?step=${stepId}` }),
  goTo: () => undefined,
};

beforeEach(async () => {
  await i18n.changeLanguage("it");
});

afterEach(cleanup);

describe("WizardSummary", () => {
  it("WizardSummary_Items_AreAListOfQuestionsAndAnswers", () => {
    render(
      <MemoryRouter>
        <WizardSummary items={ITEMS} />
      </MemoryRouter>,
    );

    const terms = screen.getAllByText(/^(Nome|Stanze|Codice CIN|Note|Animali)$/, { selector: "dt" });
    expect(terms).toHaveLength(5);
    expect(screen.getByText("Casa Aurora").closest("dd")).toBeInTheDocument();
  });

  it("WizardSummary_ZeroIsAnAnswer_ButEmptyNullAndFalseSayNotProvided", () => {
    render(
      <MemoryRouter>
        <WizardSummary items={ITEMS} />
      </MemoryRouter>,
    );

    const answerOf = (label: string) => screen.getByText(label, { selector: "dt" }).nextElementSibling as HTMLElement;
    expect(answerOf("Stanze")).toHaveTextContent("0");
    expect(answerOf("Codice CIN")).toHaveTextContent("Non indicato");
    expect(answerOf("Note")).toHaveTextContent("Non indicato");
    expect(answerOf("Animali")).toHaveTextContent("Non indicato");
  });

  it("WizardSummary_InsideAWizard_EachRowWithAStepHasAnEditLinkToIt", () => {
    render(
      <MemoryRouter>
        <WizardContext.Provider value={wizard}>
          <WizardSummary items={ITEMS} />
        </WizardContext.Provider>
      </MemoryRouter>,
    );

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    const cin = screen.getByRole("link", { name: "Modifica Codice CIN" });
    expect(cin).toHaveAttribute("href", "/?step=cin");
    expect(cin).toHaveTextContent("Modifica");
    // The visible word is part of the accessible name, and the name says which answer it edits.
    expect(within(screen.getByText("Nome", { selector: "dt" }).closest("div") as HTMLElement).getByRole("link")).toHaveAccessibleName(
      "Modifica Nome",
    );
  });

  it("WizardSummary_OutsideAWizard_IsReadOnly", () => {
    render(
      <MemoryRouter>
        <WizardSummary items={ITEMS} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("WizardSummary_EditLinks_AreBigEnoughToTapAndLongTextWraps", () => {
    render(
      <MemoryRouter>
        <WizardContext.Provider value={wizard}>
          <WizardSummary items={[{ id: "long", label: "Descrizione", value: "x".repeat(300), stepId: "basics" }]} />
        </WizardContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link").className).toContain("min-h-11");
    expect(screen.getByText("x".repeat(300)).className).toContain("break-words");
  });

  it("WizardSummary_EnglishLanguage_TranslatesTheFixedWords", async () => {
    await i18n.changeLanguage("en");

    render(
      <MemoryRouter>
        <WizardContext.Provider value={wizard}>
          <WizardSummary items={[{ id: "a", label: "Name", value: "", stepId: "basics" }]} />
        </WizardContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByText("Not provided")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit Name" })).toBeInTheDocument();
  });
});
