import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import i18n from "@/i18n/config";
import { Button } from "@/components/ui/button";
import { StatusExplainer } from "../status-explainer";

beforeEach(async () => {
  await i18n.changeLanguage("it");
});

afterEach(cleanup);

describe("StatusExplainer full", () => {
  it("StatusExplainer_StateWithAWayForward_SaysWhatItMeansWhatIsNeededAndWhatComesNext", () => {
    const { container } = render(<StatusExplainer kind="lease" status="Draft" />);

    // The current state, and the next one: "Bozza" then "In attesa di firma".
    expect(container.querySelector("[data-status='Draft']")).toHaveTextContent("Bozza");
    expect(screen.getByText("In attesa di firma")).toBeInTheDocument();
    expect(screen.getByText("Il contratto è in preparazione: non è ancora stato inviato alla firma.")).toBeInTheDocument();
    expect(screen.getByText("Per passare a «In attesa di firma» serve:")).toBeInTheDocument();
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Immobile e parti del contratto(da fare)",
      "Canone e durata(da fare)",
      "Tipo di contratto e regime fiscale(da fare)",
    ]);
  });

  it("StatusExplainer_ItemsDone_AreMarkedWithACheckAndReadAsDone", () => {
    const { container } = render(<StatusExplainer kind="lease" status="Draft" done={[0, 2]} />);

    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("(completato)");
    expect(items[1]).toHaveTextContent("(da fare)");
    expect(items[2]).toHaveTextContent("(completato)");
    // Done ones have a check; the others an empty circle: the difference is not only color.
    expect(items[0].querySelector("svg")).not.toBeNull();
    expect(items[1].querySelector("svg")).toBeNull();
    expect(container.querySelectorAll("li svg")).toHaveLength(2);
  });

  it("StatusExplainer_StateThatEndsTheThing_HasNoNeedAndNoNext", () => {
    render(<StatusExplainer kind="lease" status="Registered" />);

    expect(screen.getByText("Il contratto è registrato. I documenti restano consultabili.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByText(/Per passare a/)).not.toBeInTheDocument();
  });

  it("StatusExplainer_Actions_GoUnderTheText", () => {
    render(<StatusExplainer kind="lease" status="Draft" actions={<Button>Continua il contratto</Button>} />);

    expect(screen.getByRole("button", { name: "Continua il contratto" })).toBeInTheDocument();
  });

  it("StatusExplainer_NextState_IsReadByAScreenReaderAsTheNextState", () => {
    render(<StatusExplainer kind="booking" status="Confirmed" />);

    expect(screen.getByText("Stato successivo:")).toHaveClass("sr-only");
  });

  it("StatusExplainer_SupplierPointOfView_UsesTheSuppliersSentencesAndNames", () => {
    render(<StatusExplainer kind="request" status="Richiesto" perspective="supplier" />);

    expect(screen.getByText("Un cliente ti ha chiesto un intervento: accettalo o rifiutalo.")).toBeInTheDocument();
    expect(screen.getByText("Accetta la richiesta, oppure rifiutala indicando il motivo", { exact: false })).toBeInTheDocument();
    // The next state is named as the supplier knows it.
    expect(screen.getByText("Per passare a «Preso in carico» serve:")).toBeInTheDocument();
  });

  it("StatusExplainer_HostPointOfView_UsesTheHostsSentences", () => {
    render(<StatusExplainer kind="request" status="Richiesto" />);

    expect(screen.getByText("La richiesta è stata inviata: il fornitore deve ancora accettarla o rifiutarla.")).toBeInTheDocument();
    expect(screen.queryByText(/Un cliente ti ha chiesto/)).not.toBeInTheDocument();
  });

  it("StatusExplainer_EnglishLanguage_IsTranslatedEvenTheFixedWords", async () => {
    await i18n.changeLanguage("en");

    render(<StatusExplainer kind="lease" status="Draft" done={[1]} />);

    expect(screen.getByText("To move to “Awaiting signature” you need:")).toBeInTheDocument();
    expect(screen.getByText("Rent and duration")).toBeInTheDocument();
    expect(screen.getByText("(done)")).toBeInTheDocument();
  });

  it("StatusExplainer_UnknownState_ShowsTheStateAndNothingInvented", () => {
    const { container } = render(<StatusExplainer kind="booking" status={"Teleported" as never} />);

    expect(container).toHaveTextContent("Teleported");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(container.querySelectorAll("p")).toHaveLength(0);
  });

  it("StatusExplainer_LongTexts_WrapInsteadOfPushingThePageSideways", () => {
    render(<StatusExplainer kind="property" status="Pending" />);

    for (const item of screen.getAllByRole("listitem")) expect(item.className).toContain("min-w-0");
    expect(screen.getByText(/L'immobile è salvato ma non è ancora attivo/).className).toContain("break-words");
  });
});

describe("StatusExplainer compact", () => {
  it("StatusExplainer_Compact_IsOneBlockWithTheStateTheNextOneAndWhatIsMissingInTheSentence", () => {
    const { container } = render(<StatusExplainer kind="lease" status="Draft" compact />);

    expect(container.querySelector("[data-status-explainer='compact']")).not.toBeNull();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    const text = container.querySelector("p")?.textContent ?? "";
    expect(text).toContain("Il contratto è in preparazione");
    expect(text).toContain("Per passare a «In attesa di firma»:");
    expect(text).toContain("immobile e parti del contratto; canone e durata; tipo di contratto e regime fiscale.");
  });

  it("StatusExplainer_CompactWithSomeDone_ListsOnlyWhatIsMissing", () => {
    const { container } = render(<StatusExplainer kind="lease" status="Draft" compact done={[0, 1]} />);

    const text = container.querySelector("p")?.textContent ?? "";
    expect(text).toContain("tipo di contratto e regime fiscale.");
    expect(text).not.toContain("canone e durata");
  });

  it("StatusExplainer_CompactWithEverythingDone_DropsTheNeedSentence", () => {
    const { container } = render(<StatusExplainer kind="lease" status="Draft" compact done={[0, 1, 2]} />);

    expect(container.querySelector("p")?.textContent).toBe("Il contratto è in preparazione: non è ancora stato inviato alla firma.");
  });

  it("StatusExplainer_CompactKeepsAcronymsInCapitalsWhenItLowersTheFirstLetter", () => {
    const { container } = render(<StatusExplainer kind="property" status="Pending" compact />);

    const text = container.querySelector("p")?.textContent ?? "";
    // "I dati dell'immobile e il codice CIN" becomes lower case at the start; CIN stays in capitals.
    expect(text).toContain("i dati dell'immobile e il codice CIN; i documenti richiesti; la checklist di sicurezza");
  });

  it("StatusExplainer_CompactEndState_IsJustTheStateAndItsSentence", () => {
    const { container } = render(<StatusExplainer kind="booking" status="Cancelled" compact />);

    expect(container.querySelector("p")?.textContent).toContain("La prenotazione è stata annullata");
    expect(container.textContent).not.toContain("Per passare a");
  });

  it("StatusExplainer_CompactActions_GoAfterTheText", () => {
    render(<StatusExplainer kind="lease" status="Draft" compact actions={<Button>Vai</Button>} />);

    expect(screen.getByRole("button", { name: "Vai" })).toBeInTheDocument();
  });
});
