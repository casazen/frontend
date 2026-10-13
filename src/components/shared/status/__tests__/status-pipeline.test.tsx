import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import i18n from "@/i18n/config";
import { StatusPipeline } from "../status-pipeline";

beforeEach(async () => {
  await i18n.changeLanguage("it");
});

afterEach(cleanup);

const positions = () =>
  within(screen.getByRole("list")).getAllByRole("listitem").map((item) => `${item.textContent?.replace(/\s*\(.*\)$/, "")}:${item.getAttribute("data-position")}`);

describe("StatusPipeline", () => {
  it("StatusPipeline_MiddleOfThePath_StepsBehindAreDoneTheCurrentIsMarkedTheOthersToDo", () => {
    render(<StatusPipeline kind="booking" status="Confirmed" />);

    expect(positions()).toEqual([
      "In attesa:done",
      "Confermata:current",
      "Check-in effettuato:todo",
      "Check-out effettuato:todo",
    ]);
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.getAttribute("aria-current"))).toEqual([null, "step", null, null]);
  });

  it("StatusPipeline_EachStep_SaysItsPositionInWordsNotOnlyInColor", () => {
    render(<StatusPipeline kind="booking" status="CheckedIn" />);

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("(completato)");
    expect(items[2]).toHaveTextContent("(stato attuale)");
    expect(items[3]).toHaveTextContent("(da fare)");
    // A check on the done step; every step has an icon.
    for (const item of items) expect(item.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(items[0].querySelector("svg")?.getAttribute("class")).toContain("lucide-check");
    expect(items[2].className).toContain("font-semibold");
    expect(items[3].className).not.toContain("font-semibold");
  });

  it("StatusPipeline_ListHasAName", () => {
    render(<StatusPipeline kind="booking" status="Pending" />);

    expect(screen.getByRole("list", { name: "Avanzamento" })).toBeInTheDocument();
  });

  it("StatusPipeline_FirstAndLastStep_AreHandled", () => {
    const { rerender } = render(<StatusPipeline kind="booking" status="Pending" />);
    expect(positions()[0]).toBe("In attesa:current");
    expect(positions().slice(1).every((entry) => entry.endsWith(":todo"))).toBe(true);

    rerender(<StatusPipeline kind="booking" status="CheckedOut" />);
    expect(positions().slice(0, 3).every((entry) => entry.endsWith(":done"))).toBe(true);
    expect(positions()[3]).toBe("Check-out effettuato:current");
  });

  it("StatusPipeline_StateInsideAStep_SitsAtThatStep", () => {
    render(<StatusPipeline kind="lease" status="PartiallySigned" />);

    expect(positions()).toEqual(["Bozza:done", "In attesa di firma:current", "Firmato:todo", "Registrazione in attesa:todo", "Registrato:todo"]);
  });

  it("StatusPipeline_StateOffThePath_IsShownByItselfWithoutAPathItDidNotFollow", () => {
    const { container } = render(<StatusPipeline kind="booking" status="Cancelled" />);

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(container.querySelector("[data-status-pipeline='off-path']")).toHaveTextContent("Annullata");
    expect(screen.getByText("fuori dal percorso previsto")).toHaveClass("sr-only");
  });

  it("StatusPipeline_KindWithoutAPath_RendersNothing", () => {
    const { container } = render(<StatusPipeline kind="subscription" status="active" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("StatusPipeline_UnknownState_IsShownByItselfNotInTheMiddleOfThePath", () => {
    const { container } = render(<StatusPipeline kind="booking" status={"Teleported" as never} />);

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(container).toHaveTextContent("Teleported");
  });

  it("StatusPipeline_SupplierPointOfView_NamesTheStepsAsTheSupplierKnowsThem", () => {
    render(<StatusPipeline kind="request" status="Completato" perspective="supplier" />);

    expect(positions()).toEqual([
      "Nuova:done",
      "Preso in carico:done",
      "In corso:done",
      "In attesa di pagamento:current",
      "Pagato:todo",
    ]);
  });

  it("StatusPipeline_EnglishLanguage_IsTranslated", async () => {
    await i18n.changeLanguage("en");

    render(<StatusPipeline kind="booking" status="Confirmed" />);

    expect(screen.getByRole("list", { name: "Progress" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("(done)");
  });

  it("StatusPipeline_ManySteps_WrapOnASmallScreen", () => {
    render(<StatusPipeline kind="request" status="InCorso" />);

    expect(screen.getByRole("list").className).toContain("flex-wrap");
    for (const item of screen.getAllByRole("listitem")) {
      expect(item.className).toContain("min-w-0");
      expect(item.className).toContain("max-w-full");
    }
  });
});
