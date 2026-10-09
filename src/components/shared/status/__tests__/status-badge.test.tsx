import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import i18n from "@/i18n/config";
import { AA_TEXT_CONTRAST, contrastRatio } from "@/lib/public-site-colors";
import { STATUS_DICTIONARY, type StatusDefinition, type StatusKind, type StatusTone } from "@/lib/status-dictionary";
import { themeColor } from "@/test/colors";
import { StatusBadge } from "../status-badge";
import { STATUS_ICONS } from "../status-icons";
import { STATUS_TONE_CLASSES } from "../status-view";

beforeEach(async () => {
  await i18n.changeLanguage("it");
});

afterEach(cleanup);

describe("StatusBadge content", () => {
  it("StatusBadge_State_ShowsAnIconAndTheNameNeverOnlyAColor", () => {
    const { container } = render(<StatusBadge kind="booking" status="Confirmed" />);

    const badge = screen.getByText("Confermata").closest("span[data-status]") as HTMLElement;
    expect(badge).toHaveTextContent("Confermata");
    const icon = badge.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll("svg")).toHaveLength(1);
  });

  it("StatusBadge_State_CarriesWhatItIsOfForTestsAndStyles", () => {
    render(<StatusBadge kind="lease" status="AwaitingSignature" />);

    const badge = screen.getByText("In attesa di firma").closest("span[data-status]") as HTMLElement;
    expect(badge).toHaveAttribute("data-status-kind", "lease");
    expect(badge).toHaveAttribute("data-status", "AwaitingSignature");
  });

  it("StatusBadge_EnglishLanguage_ShowsTheEnglishName", async () => {
    await i18n.changeLanguage("en");

    render(<StatusBadge kind="lease" status="Signed" />);

    expect(screen.getByText("Signed")).toBeInTheDocument();
  });

  it("StatusBadge_SupplierPointOfView_UsesTheSuppliersWords", () => {
    const { rerender } = render(<StatusBadge kind="request" status="Richiesto" />);
    expect(screen.getByText("Richiesto")).toBeInTheDocument();

    rerender(<StatusBadge kind="request" status="Richiesto" perspective="supplier" />);
    expect(screen.getByText("Nuova")).toBeInTheDocument();

    rerender(<StatusBadge kind="request" status="Completato" perspective="supplier" />);
    expect(screen.getByText("In attesa di pagamento")).toBeInTheDocument();

    // A state the supplier sees the same way keeps its name.
    rerender(<StatusBadge kind="request" status="InCorso" perspective="supplier" />);
    expect(screen.getByText("In corso")).toBeInTheDocument();
  });

  it("StatusBadge_UnknownValueFromTheServer_ShowsTheValueNotARawKeyNorABlank", () => {
    // A backend newer than the app: it must not show "status.booking.Teleported.label" nor break.
    render(<StatusBadge kind="booking" status={"Teleported" as never} />);

    const badge = screen.getByText("Teleported").closest("span[data-status]") as HTMLElement;
    expect(badge).toHaveAttribute("data-status", "Teleported");
    expect(badge.querySelector("svg")).not.toBeNull();
    expect(badge.className).toContain(STATUS_TONE_CLASSES.neutral);
  });

  it("StatusBadge_EveryStateOfEveryKind_RendersItsNameAndIconInBothLanguages", async () => {
    for (const language of ["it", "en"]) {
      await i18n.changeLanguage(language);
      for (const kind of Object.keys(STATUS_DICTIONARY) as StatusKind[]) {
        for (const status of Object.keys(STATUS_DICTIONARY[kind])) {
          const { container, unmount } = render(<StatusBadge kind={kind} status={status as never} />);
          const text = container.textContent ?? "";
          expect(text.trim().length, `${kind}.${status}`).toBeGreaterThan(0);
          // A key that was not found would show itself.
          expect(text, `${kind}.${status}`).not.toMatch(/^status\./);
          expect(container.querySelector("svg"), `${kind}.${status}`).not.toBeNull();
          unmount();
        }
      }
    }
  });
});

describe("StatusBadge look", () => {
  it.each([
    ["Pending", "warning"],
    ["Confirmed", "success"],
    ["CheckedIn", "info"],
    ["CheckedOut", "neutral"],
    ["Cancelled", "danger"],
  ] as const)("StatusBadge_Booking%s_IsPaintedAs%s", (status, tone) => {
    render(<StatusBadge kind="booking" status={status} />);

    const badge = document.querySelector("span[data-status]") as HTMLElement;
    expect(badge.className).toContain(STATUS_TONE_CLASSES[tone]);
  });

  it("StatusBadge_LargeSize_IsBiggerAndKeepsTheSameContent", () => {
    const { rerender } = render(<StatusBadge kind="booking" status="Confirmed" />);
    const small = (document.querySelector("span[data-status]") as HTMLElement).className;

    rerender(<StatusBadge kind="booking" status="Confirmed" size="lg" />);
    const large = (document.querySelector("span[data-status]") as HTMLElement).className;

    expect(small).toContain("text-xs");
    expect(large).toContain("text-sm");
    expect(screen.getByText("Confermata")).toBeInTheDocument();
  });

  it("StatusBadge_LongName_WrapsInsteadOfPushingThePageSideways", () => {
    render(<StatusBadge kind="subscription" status="incomplete" />);

    const badge = document.querySelector("span[data-status]") as HTMLElement;
    expect(badge.className).toContain("max-w-full");
    expect(screen.getByText("Pagamento da completare").className).toContain("break-words");
    expect(screen.getByText("Pagamento da completare").className).toContain("min-w-0");
  });

  it("StatusBadge_ExtraClassesAndAttributes_ArePassedOn", () => {
    render(<StatusBadge kind="booking" status="Confirmed" className="ml-2" data-testid="b" title="Stato" />);

    expect(screen.getByTestId("b").className).toContain("ml-2");
    expect(screen.getByTestId("b")).toHaveAttribute("title", "Stato");
  });

  it("StatusBadge_EveryIconOfTheDictionary_IsDrawn", () => {
    const names = new Set<string>();
    for (const kind of Object.keys(STATUS_DICTIONARY) as StatusKind[]) {
      for (const definition of Object.values(STATUS_DICTIONARY[kind]) as StatusDefinition[]) {
        names.add(definition.icon);
        if (definition.supplier?.icon) names.add(definition.supplier.icon);
      }
    }

    for (const name of names) expect(STATUS_ICONS, name).toHaveProperty([name]);
  });
});

describe("StatusBadge contrast", () => {
  const tokens = readFileSync(resolve(process.cwd(), "src/styles/tokens.css"), "utf8");
  const token = (name: string) => {
    const match = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(tokens);
    if (!match) throw new Error(`${name} not found in tokens.css`);
    return match[1];
  };

  const PAIRS: Record<StatusTone, [text: string, background: string]> = {
    neutral: [themeColor("foreground"), themeColor("muted")],
    info: [token("--blue-text"), token("--blue-bg")],
    success: [token("--green-text"), token("--green-bg")],
    warning: [token("--amber-text"), token("--amber-bg")],
    danger: [token("--red-text"), token("--red-bg")],
  };

  it.each(Object.keys(PAIRS) as StatusTone[])("StatusBadge_%sTone_TextMeetsAAOnItsBackground", (tone) => {
    const [text, background] = PAIRS[tone];

    expect(contrastRatio(text, background)).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
  });

  it("StatusBadge_ToneClasses_AreTheSemanticTokenPairs", () => {
    expect(STATUS_TONE_CLASSES.success).toBe("bg-success-soft text-success-foreground ring-success-border");
    expect(STATUS_TONE_CLASSES.warning).toBe("bg-warning-soft text-warning-foreground ring-warning-border");
    expect(STATUS_TONE_CLASSES.danger).toBe("bg-danger-soft text-danger-foreground ring-danger-border");
    expect(STATUS_TONE_CLASSES.info).toBe("bg-info-soft text-info-foreground ring-info-border");
  });
});
