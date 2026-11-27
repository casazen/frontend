import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { UseFormReturn } from "react-hook-form";
import i18n from "@/i18n/config";
import { wizardDraftApi } from "@/api/wizard-draft.api";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ServerWizardDraft } from "@/types/wizard";
import { WizardShell, type WizardStep } from "../wizard-shell";

vi.mock("@/queries/use-users", () => ({
  useCurrentUser: () => ({ user: { id: "user-1" }, org: { id: "org-1" } }),
}));
vi.mock("@/api/wizard-draft.api", () => ({
  WIZARD_DRAFTS_KEY: ["wizard-drafts"],
  wizardDraftApi: { get: vi.fn(), save: vi.fn(), remove: vi.fn() },
}));

// Explicit conditions only; a generous ceiling so that a loaded CI machine does not fail a correct test.
configure({ asyncUtilTimeout: 5_000 });
vi.setConfig({ testTimeout: 30_000 });

interface Values {
  name: string;
}

// 09:30 UTC is 10:30 in Rome in November.
const SAVED_AT = "2026-11-06T09:30:00Z";

const serverDraft = (version: number, name: string): ServerWizardDraft => ({
  type: "BookingCreate",
  entityId: null,
  version,
  data: { shape: 1, step: "person", values: { name } },
  lastSavedAt: SAVED_AT,
});

const field = (form: UseFormReturn<Values>, name: keyof Values, label: string) => (
  <Field label={label} error={form.formState.errors[name]}>
    <Input {...form.register(name)} />
  </Field>
);

const STEPS: WizardStep<Values>[] = [
  { id: "person", label: "Persona", title: "Chi sei", render: ({ form }) => field(form, "name", "Nome") },
  { id: "review", label: "Riepilogo", title: "Controlla e conferma", render: () => <p>riepilogo</p> },
];

function renderWizard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/app/bookings/new"]}>
        <WizardShell<Values, void>
          id="test-wizard"
          steps={STEPS}
          defaultValues={{ name: "" }}
          finishLabel="Crea la prenotazione"
          onFinish={vi.fn()}
          renderDone={() => <p>fatto</p>}
          draft={{ server: { type: "BookingCreate" } }}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  sessionStorage.clear();
  vi.mocked(wizardDraftApi.get).mockReset().mockResolvedValue(null);
  vi.mocked(wizardDraftApi.save).mockReset().mockResolvedValue({ status: "saved", version: 1, lastSavedAt: SAVED_AT });
  vi.mocked(wizardDraftApi.remove).mockReset().mockResolvedValue(undefined);
  await i18n.changeLanguage("it");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("WizardShell with a draft on the server", () => {
  it("WizardShell_ServerDraft_ShowsASpinnerThenTheFormStartedFromTheAnswersOfTheServer", async () => {
    vi.mocked(wizardDraftApi.get).mockResolvedValue(serverDraft(3, "Dal server"));

    renderWizard();

    expect(screen.getByTestId("wizard-shell")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByLabelText("Nome")).not.toBeInTheDocument();

    expect(await screen.findByLabelText("Nome")).toHaveValue("Dal server");
    expect(wizardDraftApi.get).toHaveBeenCalledWith("BookingCreate", null);
    expect(screen.getByTestId("wizard-draft-saved")).toHaveTextContent("Salvato alle 10:30");
  });

  it("WizardShell_LeavingAFieldWithAChange_SendsTheDraftToTheServerAndSaysWhenItWasSaved", async () => {
    renderWizard();
    const name = await screen.findByLabelText("Nome");

    fireEvent.change(name, { target: { value: "Casa Rossi" } });
    fireEvent.blur(name);

    await waitFor(() => expect(wizardDraftApi.save).toHaveBeenCalledTimes(1));
    expect(vi.mocked(wizardDraftApi.save).mock.calls[0][1]).toMatchObject({
      clientVersion: 0,
      data: { step: "person", values: { name: "Casa Rossi" } },
    });
    await waitFor(() => expect(screen.getByTestId("wizard-draft-saved")).toHaveTextContent("Salvato alle 10:30"));
  });

  it("WizardShell_ASaveThatCannotBeMade_SaysSoAndTheButtonTriesAgain", async () => {
    vi.mocked(wizardDraftApi.save).mockRejectedValueOnce(new Error("network"));
    renderWizard();
    const name = await screen.findByLabelText("Nome");

    fireEvent.change(name, { target: { value: "Casa Rossi" } });
    fireEvent.blur(name);
    await waitFor(() => expect(screen.getByTestId("wizard-draft-saved")).toHaveTextContent("Non riesco a salvare"));

    fireEvent.click(within(screen.getByTestId("wizard-draft-saved")).getByRole("button", { name: "Riprova" }));

    await waitFor(() => expect(screen.getByTestId("wizard-draft-saved")).toHaveTextContent("Salvato alle 10:30"));
    expect(wizardDraftApi.save).toHaveBeenCalledTimes(2);
  });

  it("WizardShell_AConflict_AsksWhichVersionToKeepAndTakingTheirsPutsTheirsBackInTheForm", async () => {
    vi.mocked(wizardDraftApi.save).mockResolvedValue({ status: "conflict", serverDraft: serverDraft(7, "Dal server"), serverVersion: 7 });
    renderWizard();
    const name = await screen.findByLabelText("Nome");

    fireEvent.change(name, { target: { value: "Mio" } });
    fireEvent.blur(name);

    const dialog = await screen.findByRole("dialog", { name: "Conflitto di versione" });
    expect(within(dialog).getByTestId("wizard-conflict-saved-at")).toHaveTextContent("Versione salvata alle 10:30");
    // Nothing is decided yet: what was typed here is still in the form.
    expect(screen.getByDisplayValue("Mio")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByTestId("wizard-conflict-take-theirs"));
    const asked = within(screen.getByRole("dialog", { name: "Usa la versione del server" }));
    fireEvent.click(asked.getByRole("button", { name: "Usa la versione del server" }));

    await waitFor(() => expect(screen.getByLabelText("Nome")).toHaveValue("Dal server"));
    expect(screen.queryByTestId("wizard-conflict-dialog")).not.toBeInTheDocument();
    expect(wizardDraftApi.save).toHaveBeenCalledTimes(1);
  });
});
