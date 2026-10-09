import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import type { UseFormReturn } from "react-hook-form";
import i18n from "@/i18n/config";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { readWizardDraft, writeWizardDraft } from "@/lib/wizard-draft";
import { WizardShell, type WizardShellProps, type WizardStep } from "../wizard-shell";
import { WizardSummary } from "../wizard-summary";

let currentUser: { id: string } | null = { id: "user-1" };
vi.mock("@/queries/use-users", () => ({
  useCurrentUser: () => ({ user: currentUser, org: currentUser ? { id: "org-1" } : null }),
}));

interface Values {
  name: string;
  fiscalCode: string;
  rooms: string;
  notes: string;
}

const DEFAULTS: Values = { name: "", fiscalCode: "", rooms: "", notes: "" };
const SCOPE = { userId: "user-1", orgId: "org-1" };
const WAIT_FOR_DRAFT_MS = 450;

const field = (form: UseFormReturn<Values>, name: keyof Values, label: string) => (
  <Field label={label} error={form.formState.errors[name]}>
    <Input {...form.register(name)} />
  </Field>
);

function makeSteps(overrides: Partial<Record<string, Partial<WizardStep<Values>>>> = {}): WizardStep<Values>[] {
  const steps: WizardStep<Values>[] = [
    {
      id: "person",
      label: "Persona",
      title: "Chi sei",
      purpose: "Il nome e il codice fiscale.",
      schema: z.object({ name: z.string().min(1, "validation.required") }),
      render: ({ form }) => (
        <>
          {field(form, "name", "Nome")}
          {field(form, "fiscalCode", "Codice fiscale")}
        </>
      ),
    },
    {
      id: "home",
      label: "Casa",
      title: "La casa",
      purpose: "Quante stanze ha.",
      optional: true,
      schema: z.object({ rooms: z.string().regex(/^\d*$/, "validation.invalid") }),
      render: ({ form }) => field(form, "rooms", "Stanze"),
    },
    {
      id: "review",
      label: "Riepilogo",
      title: "Controlla e conferma",
      render: ({ form }) => (
        <WizardSummary
          items={[
            { id: "name", label: "Nome", value: form.getValues("name"), stepId: "person" },
            { id: "rooms", label: "Stanze", value: form.getValues("rooms"), stepId: "home" },
          ]}
        />
      ),
    },
  ];
  return steps.map((step) => ({ ...step, ...overrides[step.id] }));
}

function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <div>
      <p data-testid="location">{`${location.pathname}${location.search}`}</p>
      {/* Moves the address the way a link, the back button or a typed address does. */}
      <button type="button" data-testid="go-bare" onClick={() => navigate(location.pathname)}>
        bare
      </button>
      <button type="button" data-testid="go-review" onClick={() => navigate(`${location.pathname}?step=review`)}>
        review
      </button>
    </div>
  );
}

function renderWizard(
  props: Partial<WizardShellProps<Values, { id: string }>> = {},
  entry = "/app/short-rent/properties/new",
) {
  const onFinish = props.onFinish ?? vi.fn(async () => ({ id: "p-1" }));
  const utils = render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <WizardShell<Values, { id: string }>
        id="test-wizard"
        steps={makeSteps()}
        defaultValues={DEFAULTS}
        finishLabel="Crea la casa"
        onFinish={onFinish}
        renderDone={({ result }) => <p data-testid="done">{result ? `creata ${result.id}` : "fatto senza risultato"}</p>}
        {...props}
      />
    </MemoryRouter>,
  );
  return { ...utils, onFinish };
}

const location = () => screen.getByTestId("location").textContent;
const next = () => fireEvent.click(screen.getByTestId("wizard-next"));
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const settleDraft = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, WAIT_FOR_DRAFT_MS))));

beforeEach(async () => {
  currentUser = { id: "user-1" };
  sessionStorage.clear();
  await i18n.changeLanguage("it");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("WizardShell steps and address", () => {
  it("WizardShell_FirstOpening_ShowsTheFirstStepWithoutRewritingTheAddress", () => {
    renderWizard();

    expect(screen.getByRole("heading", { level: 2, name: "Chi sei" })).toBeInTheDocument();
    expect(screen.getByText("Il nome e il codice fiscale.")).toBeInTheDocument();
    expect(location()).toBe("/app/short-rent/properties/new");
    expect(screen.getByTestId("wizard-shell")).toHaveAttribute("data-step", "person");
    // The compact stepper of the phone says where the person is.
    expect(screen.getAllByText("Passo 1 di 3").length).toBeGreaterThan(0);
  });

  it.each([
    ["?step=home", "La casa"],
    ["?step=2", "La casa"],
    ["?step=3", "Controlla e conferma"],
    ["?step=review&from=list", "Controlla e conferma"],
  ])("WizardShell_AddressWith%s_OpensThatStep", (search, title) => {
    renderWizard({}, `/app/short-rent/properties/new${search}`);

    expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
  });

  it.each(["?step=unknown", "?step=0", "?step=99", "?step="])("WizardShell_AddressWith%s_FallsBackToTheFirstStep", (search) => {
    renderWizard({}, `/app/short-rent/properties/new${search}`);

    expect(screen.getByRole("heading", { level: 2, name: "Chi sei" })).toBeInTheDocument();
  });

  it("WizardShell_Continue_MovesToTheNextStepKeepingTheOtherQueryParameters", async () => {
    renderWizard({}, "/app/short-rent/properties/new?immobile=abc");

    type("Nome", "Anna");
    next();

    await waitFor(() => expect(location()).toBe("/app/short-rent/properties/new?immobile=abc&step=home"));
    const heading = screen.getByRole("heading", { level: 2, name: "La casa" });
    expect(heading).toBeInTheDocument();
    // The focus goes to the new heading: a screen reader reads where it is (an effect that runs just after the new step is drawn).
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it("WizardShell_NextButton_NamesTheNextStepAndTheLastButtonNamesTheResult", async () => {
    renderWizard();

    expect(screen.getByTestId("wizard-next")).toHaveTextContent("Continua: Casa");
    type("Nome", "Anna");
    next();
    await screen.findByRole("heading", { level: 2, name: "La casa" });
    expect(screen.getByTestId("wizard-next")).toHaveTextContent("Continua: Riepilogo");
    next();
    await screen.findByRole("heading", { level: 2, name: "Controlla e conferma" });
    expect(screen.getByTestId("wizard-finish")).toHaveTextContent("Crea la casa");
    expect(screen.queryByTestId("wizard-next")).not.toBeInTheDocument();
  });

  it("WizardShell_StepNextLabel_ReplacesTheDefaultName", () => {
    renderWizard({ steps: makeSteps({ person: { nextLabel: "Salva la persona" } }) });

    expect(screen.getByTestId("wizard-next")).toHaveTextContent("Salva la persona");
  });

  it("WizardShell_Back_ReturnsToTheStepKeepingWhatWasTyped", async () => {
    renderWizard();

    type("Nome", "Anna");
    next();
    await screen.findByRole("heading", { level: 2, name: "La casa" });
    fireEvent.click(screen.getByTestId("wizard-back"));

    await screen.findByRole("heading", { level: 2, name: "Chi sei" });
    expect(screen.getByLabelText("Nome")).toHaveValue("Anna");
    expect(screen.queryByTestId("wizard-back")).not.toBeInTheDocument();
  });

  it("WizardShell_InitialStepId_OpensThereAndTheBareAddressGoesToThatStepAgain", async () => {
    renderWizard({ initialStepId: "home" });

    expect(screen.getByRole("heading", { level: 2, name: "La casa" })).toBeInTheDocument();
    // Moving on writes `?step=`; the bare address (the browser's back button) is the step the page opened on, not the first.
    next();
    await screen.findByRole("heading", { level: 2, name: "Controlla e conferma" });
    expect(location()).toBe("/app/short-rent/properties/new?step=review");
    fireEvent.click(screen.getByTestId("go-bare"));

    await screen.findByRole("heading", { level: 2, name: "La casa" });
  });

  it("WizardShell_UnknownInitialStepId_OpensTheFirstStep", () => {
    renderWizard({ initialStepId: "no-such-step" });

    expect(screen.getByRole("heading", { level: 2, name: "Chi sei" })).toBeInTheDocument();
  });

  it("WizardShell_Stepper_OnlyStepsAlreadyPassedCanBeOpened", async () => {
    renderWizard();

    expect(screen.queryByRole("button", { name: /Persona/ })).not.toBeInTheDocument();
    type("Nome", "Anna");
    next();
    await screen.findByRole("heading", { level: 2, name: "La casa" });

    fireEvent.click(screen.getByRole("button", { name: /Persona/ }));
    await screen.findByRole("heading", { level: 2, name: "Chi sei" });
    expect(screen.queryByRole("button", { name: /Riepilogo/ })).not.toBeInTheDocument();
  });

  it("WizardShell_OptionalStep_OffersSkipAndSkipDoesNotValidate", async () => {
    renderWizard({}, "/app/short-rent/properties/new?step=home");

    type("Stanze", "abc");
    fireEvent.click(screen.getByTestId("wizard-skip"));

    await screen.findByRole("heading", { level: 2, name: "Controlla e conferma" });
  });

  it("WizardShell_RequiredStep_HasNoSkip", () => {
    renderWizard();

    expect(screen.queryByTestId("wizard-skip")).not.toBeInTheDocument();
  });

  it("WizardShell_StepChange_TellsThePageWhichStepsAndWithWhatAnswers", async () => {
    const onStepChange = vi.fn();
    renderWizard({ onStepChange });

    type("Nome", "Anna");
    next();
    await screen.findByRole("heading", { level: 2, name: "La casa" });
    fireEvent.click(screen.getByTestId("wizard-back"));
    await screen.findByRole("heading", { level: 2, name: "Chi sei" });

    expect(onStepChange).toHaveBeenNthCalledWith(1, { from: "person", to: "home", values: expect.objectContaining({ name: "Anna" }) });
    expect(onStepChange).toHaveBeenNthCalledWith(2, { from: "home", to: "person", values: expect.objectContaining({ name: "Anna" }) });
    expect(onStepChange).toHaveBeenCalledTimes(2);
  });
});

describe("WizardShell validation", () => {
  it("WizardShell_InvalidStep_DoesNotAdvanceShowsTheProblemsAndFocusesTheFirst", async () => {
    renderWizard();

    next();

    const summary = await screen.findByTestId("wizard-error-summary");
    expect(summary).toHaveTextContent("C'è 1 campo da controllare");
    expect(within(summary).getByText("Campo obbligatorio")).toBeInTheDocument();
    expect(location()).toBe("/app/short-rent/properties/new");
    expect(screen.getByRole("heading", { level: 2, name: "Chi sei" })).toBeInTheDocument();
    // The field says it too, and the focus is on it.
    const name = screen.getByLabelText("Nome");
    expect(name).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(name).toHaveFocus());
    // Announced: a polite status with the number of problems.
    expect(screen.getAllByRole("status").some((node) => node.textContent === "C'è 1 campo da controllare")).toBe(true);
  });

  it("WizardShell_ProblemsFixed_TheSummaryGoesAwayAndTheStepAdvances", async () => {
    renderWizard();

    next();
    await screen.findByTestId("wizard-error-summary");
    type("Nome", "Anna");
    await waitFor(() => expect(screen.queryByTestId("wizard-error-summary")).not.toBeInTheDocument());
    next();

    await screen.findByRole("heading", { level: 2, name: "La casa" });
  });

  it("WizardShell_TwoProblems_SaysHowManyWithThePlural", async () => {
    const steps = makeSteps({
      person: {
        schema: z.object({
          name: z.string().min(1, "validation.required"),
          fiscalCode: z.string().min(1, "validation.required"),
        }),
      },
    });
    renderWizard({ steps });

    next();

    expect(await screen.findByTestId("wizard-error-summary")).toHaveTextContent("Ci sono 2 campi da controllare");
  });

  it("WizardShell_ProblemsOfAStep_DoNotFollowToTheOtherSteps", async () => {
    renderWizard();

    next();
    await screen.findByTestId("wizard-error-summary");
    type("Nome", "Anna");
    next();
    await screen.findByRole("heading", { level: 2, name: "La casa" });

    expect(screen.queryByTestId("wizard-error-summary")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Stanze")).not.toHaveAttribute("aria-invalid");
  });

  it("WizardShell_StepWithoutSchema_AlwaysAdvances", async () => {
    renderWizard({ steps: makeSteps({ person: { schema: undefined } }) });

    next();

    await screen.findByRole("heading", { level: 2, name: "La casa" });
  });

  it("WizardShell_BeforeNext_RunsAfterValidationAndAFailureKeepsTheStepWithTheMessage", async () => {
    const beforeNext = vi.fn().mockRejectedValue(new Error("boom"));
    renderWizard({ steps: makeSteps({ person: { beforeNext } }) });

    type("Nome", "Anna");
    next();

    expect(await screen.findByTestId("wizard-finish-error")).toHaveTextContent("Non siamo riusciti a completare l'operazione");
    expect(beforeNext).toHaveBeenCalledWith(expect.objectContaining({ name: "Anna" }));
    expect(screen.getByRole("heading", { level: 2, name: "Chi sei" })).toBeInTheDocument();
  });
});

describe("WizardShell finishing", () => {
  const openReview = (search = "?step=review") => `/app/short-rent/properties/new${search}`;

  it("WizardShell_Finish_ChecksEveryStepAndOpensTheFirstThatIsNotValid", async () => {
    const { onFinish } = renderWizard({}, openReview());

    fireEvent.click(screen.getByTestId("wizard-finish"));

    // Nobody typed a name: the person step is opened, with its problem.
    await screen.findByRole("heading", { level: 2, name: "Chi sei" });
    expect(await screen.findByTestId("wizard-error-summary")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveAttribute("aria-invalid", "true");
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("WizardShell_Finish_SendsAllTheAnswersAndShowsTheConfirmationInTheAddress", async () => {
    const { onFinish } = renderWizard();

    type("Nome", "Anna");
    next();
    await screen.findByRole("heading", { level: 2, name: "La casa" });
    type("Stanze", "3");
    next();
    await screen.findByRole("heading", { level: 2, name: "Controlla e conferma" });
    fireEvent.click(screen.getByTestId("wizard-finish"));

    expect(await screen.findByTestId("done")).toHaveTextContent("creata p-1");
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith({ name: "Anna", fiscalCode: "", rooms: "3", notes: "" });
    expect(location()).toBe("/app/short-rent/properties/new?step=fatto");
    expect(screen.getByTestId("wizard-shell")).toHaveAttribute("data-step", "fatto");
  });

  it("WizardShell_FinishRejected_StaysOnTheLastStepWithTheErrorAndCanTryAgain", async () => {
    const onFinish = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue({ id: "p-2" });
    writeWizardDraft("test-wizard", SCOPE, { step: "review", values: { ...DEFAULTS, name: "Anna" } });
    renderWizard({ onFinish }, openReview());

    fireEvent.click(screen.getByTestId("wizard-finish"));

    expect(await screen.findByTestId("wizard-finish-error")).toBeInTheDocument();
    expect(screen.queryByTestId("done")).not.toBeInTheDocument();
    expect(screen.getByTestId("wizard-finish")).toHaveTextContent("Crea la casa");

    fireEvent.click(screen.getByTestId("wizard-finish"));
    expect(await screen.findByTestId("done")).toHaveTextContent("creata p-2");
    expect(onFinish).toHaveBeenCalledTimes(2);
  });

  it("WizardShell_FinishPressedTwice_SendsOnce", async () => {
    let resolveFinish: (value: { id: string }) => void = () => undefined;
    const onFinish = vi.fn(() => new Promise<{ id: string }>((resolve) => (resolveFinish = resolve)));
    writeWizardDraft("test-wizard", SCOPE, { step: "review", values: { ...DEFAULTS, name: "Anna" } });
    renderWizard({ onFinish }, openReview());

    fireEvent.click(screen.getByTestId("wizard-finish"));
    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("wizard-finish")).toHaveAttribute("aria-busy", "true");
    fireEvent.click(screen.getByTestId("wizard-finish"));
    await act(async () => resolveFinish({ id: "p-3" }));

    expect(await screen.findByTestId("done")).toBeInTheDocument();
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("WizardShell_ConfirmationOpenedAgain_StillRendersTheConfirmationWithoutResult", () => {
    renderWizard({}, openReview("?step=fatto"));

    expect(screen.getByTestId("done")).toHaveTextContent("fatto senza risultato");
  });

  it("WizardShell_BackFromTheConfirmation_DoesNotReopenTheFormThatWouldSendTwice", async () => {
    writeWizardDraft("test-wizard", SCOPE, { step: "review", values: { ...DEFAULTS, name: "Anna" } });
    renderWizard({}, openReview());
    fireEvent.click(screen.getByTestId("wizard-finish"));
    await screen.findByTestId("done");

    // The back button, or a link, would return to the form: the wizard puts the confirmation back.
    fireEvent.click(screen.getByTestId("go-review"));
    await waitFor(() => expect(location()).toBe("/app/short-rent/properties/new?step=fatto"));
    expect(screen.getByTestId("done")).toBeInTheDocument();
    expect(screen.queryByTestId("wizard-finish")).not.toBeInTheDocument();
  });
});

describe("WizardShell summary", () => {
  it("WizardShell_Summary_EditLinksGoBackToTheirStepKeepingTheAnswers", async () => {
    writeWizardDraft("test-wizard", SCOPE, { step: "review", values: { ...DEFAULTS, name: "Anna", rooms: "4" } });
    renderWizard({}, "/app/short-rent/properties/new?step=review");

    const summary = screen.getByText("Nome", { selector: "dt" }).closest("dl") as HTMLElement;
    expect(within(summary).getByText("Anna")).toBeInTheDocument();
    const edit = within(summary).getByRole("link", { name: "Modifica Nome" });
    expect(edit).toHaveAttribute("href", "/app/short-rent/properties/new?step=person");

    fireEvent.click(edit);

    await screen.findByRole("heading", { level: 2, name: "Chi sei" });
    expect(screen.getByLabelText("Nome")).toHaveValue("Anna");
  });
});

describe("WizardShell draft", () => {
  it("WizardShell_Typing_SavesADraftForThisUserWithoutTheSensitiveFields", async () => {
    renderWizard({ draft: { exclude: ["fiscalCode"] } });

    type("Nome", "Anna");
    type("Codice fiscale", "RSSMRA80A01H501U");
    await settleDraft();

    const saved = readWizardDraft("test-wizard", SCOPE);
    expect(saved?.step).toBe("person");
    expect(saved?.values).toMatchObject({ name: "Anna" });
    expect(saved?.values).not.toHaveProperty("fiscalCode");
    expect(JSON.stringify(Object.entries(sessionStorage))).not.toContain("RSSMRA80A01H501U");
    expect(screen.getByTestId("wizard-draft-saved")).toHaveTextContent(/Bozza salvata alle \d{2}:\d{2}/);
  });

  it("WizardShell_NothingTypedYet_SavesNothingAndShowsNoDraftNote", async () => {
    renderWizard();

    await settleDraft();

    expect(readWizardDraft("test-wizard", SCOPE)).toBeNull();
    expect(screen.queryByTestId("wizard-draft-saved")).not.toBeInTheDocument();
  });

  it("WizardShell_Reload_RestoresTheAnswersAndOffersToResumeFromTheStepReached", async () => {
    const first = renderWizard();
    type("Nome", "Anna");
    next();
    await screen.findByRole("heading", { level: 2, name: "La casa" });
    type("Stanze", "3");
    await settleDraft();
    first.unmount();

    // A reload: the address is the bare one, the draft is in the session.
    renderWizard();

    expect(screen.getByLabelText("Nome")).toHaveValue("Anna");
    const banner = screen.getByTestId("wizard-draft-banner");
    expect(banner).toHaveTextContent(/Hai una bozza salvata alle \d{2}:\d{2}/);
    expect(banner).toHaveTextContent("Eri arrivato al passo 2 di 3: «Casa».");

    fireEvent.click(screen.getByTestId("wizard-draft-resume"));

    await screen.findByRole("heading", { level: 2, name: "La casa" });
    expect(screen.getByLabelText("Stanze")).toHaveValue("3");
    expect(screen.queryByTestId("wizard-draft-banner")).not.toBeInTheDocument();
  });

  it("WizardShell_StartOver_DeletesTheDraftAndRestoresTheDefaults", async () => {
    const first = renderWizard();
    type("Nome", "Anna");
    next();
    await screen.findByRole("heading", { level: 2, name: "La casa" });
    await settleDraft();
    first.unmount();
    renderWizard();

    fireEvent.click(screen.getByTestId("wizard-draft-restart"));

    await waitFor(() => expect(screen.queryByTestId("wizard-draft-banner")).not.toBeInTheDocument());
    expect(screen.getByLabelText("Nome")).toHaveValue("");
    expect(readWizardDraft("test-wizard", SCOPE)).toBeNull();
    expect(location()).toBe("/app/short-rent/properties/new");
  });

  it("WizardShell_AddressWithAStep_DoesNotOfferToResume", () => {
    writeWizardDraft("test-wizard", SCOPE, { step: "review", values: { ...DEFAULTS, name: "Anna" } });

    renderWizard({}, "/app/short-rent/properties/new?step=person");

    expect(screen.queryByTestId("wizard-draft-banner")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue("Anna");
  });

  it("WizardShell_DraftAtTheFirstStep_RestoresTheAnswersWithoutABanner", () => {
    writeWizardDraft("test-wizard", SCOPE, { step: "person", values: { ...DEFAULTS, name: "Anna" } });

    renderWizard();

    expect(screen.queryByTestId("wizard-draft-banner")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue("Anna");
  });

  it("WizardShell_ExpiredDraft_IsIgnoredAndDeleted", () => {
    const aDayAndAMinuteAgo = Date.now() - (24 * 60 + 1) * 60 * 1000;
    writeWizardDraft("test-wizard", SCOPE, { step: "review", values: { ...DEFAULTS, name: "Anna" } }, { now: aDayAndAMinuteAgo });

    renderWizard();

    expect(screen.getByLabelText("Nome")).toHaveValue("");
    expect(screen.queryByTestId("wizard-draft-banner")).not.toBeInTheDocument();
    expect(readWizardDraft("test-wizard", SCOPE)).toBeNull();
  });

  it("WizardShell_DraftOfAnotherUser_IsNeverRead", () => {
    writeWizardDraft("test-wizard", { userId: "someone-else", orgId: "org-1" }, { step: "review", values: { ...DEFAULTS, name: "Marco" } });

    renderWizard();

    expect(screen.getByLabelText("Nome")).toHaveValue("");
  });

  it("WizardShell_DraftOfAnotherVersion_IsIgnored", () => {
    writeWizardDraft("test-wizard", SCOPE, { step: "review", values: { ...DEFAULTS, name: "Anna" } }, { version: 1 });

    renderWizard({ draft: { version: 2 } });

    expect(screen.getByLabelText("Nome")).toHaveValue("");
  });

  it("WizardShell_DraftRefusedByTheFlow_StartsFromTheDefaultsAndForgetsIt", () => {
    writeWizardDraft("test-wizard", SCOPE, { step: "review", values: { ...DEFAULTS, name: "Anna" } });

    renderWizard({ draft: { accept: (saved) => saved.step !== "review" } });

    expect(screen.getByLabelText("Nome")).toHaveValue("");
    expect(screen.queryByTestId("wizard-draft-banner")).not.toBeInTheDocument();
    expect(readWizardDraft("test-wizard", SCOPE)).toBeNull();
  });

  it("WizardShell_DraftOff_ReadsAndWritesNothing", async () => {
    writeWizardDraft("test-wizard", SCOPE, { step: "review", values: { ...DEFAULTS, name: "Anna" } });
    renderWizard({ draft: false });

    expect(screen.getByLabelText("Nome")).toHaveValue("");
    type("Nome", "Luca");
    await settleDraft();

    expect(readWizardDraft("test-wizard", SCOPE)?.values).toMatchObject({ name: "Anna" });
  });

  it("WizardShell_NoSignedInUser_NeverWritesADraft", async () => {
    currentUser = null;
    renderWizard();

    type("Nome", "Anna");
    await settleDraft();

    expect(sessionStorage.length).toBe(0);
  });

  it("WizardShell_Finish_DeletesTheDraft", async () => {
    renderWizard();
    type("Nome", "Anna");
    next();
    await screen.findByRole("heading", { level: 2, name: "La casa" });
    await settleDraft();
    expect(readWizardDraft("test-wizard", SCOPE)).not.toBeNull();
    next();
    await screen.findByRole("heading", { level: 2, name: "Controlla e conferma" });
    fireEvent.click(screen.getByTestId("wizard-finish"));
    await screen.findByTestId("done");

    expect(readWizardDraft("test-wizard", SCOPE)).toBeNull();
    await settleDraft();
    expect(readWizardDraft("test-wizard", SCOPE)).toBeNull();
  });

  it("WizardShell_Exit_DeletesTheDraftAndLeaves", async () => {
    const onExit = vi.fn();
    renderWizard({ onExit });
    type("Nome", "Anna");
    await settleDraft();
    expect(readWizardDraft("test-wizard", SCOPE)).not.toBeNull();

    fireEvent.click(screen.getByTestId("wizard-exit"));

    expect(onExit).toHaveBeenCalledTimes(1);
    expect(readWizardDraft("test-wizard", SCOPE)).toBeNull();
  });

  it("WizardShell_NoExitHandler_ShowsNoCancelButton", () => {
    renderWizard();

    expect(screen.queryByTestId("wizard-exit")).not.toBeInTheDocument();
  });
});

describe("WizardShell on a phone", () => {
  it("WizardShell_Buttons_SitAboveTheBottomBarAndNeverOutsideTheScreen", () => {
    renderWizard({}, "/app/short-rent/properties/new?step=home");

    const bar = screen.getByTestId("wizard-next").closest("div.sticky");
    expect(bar).not.toBeNull();
    // Sticky above the bottom bar and its home indicator; an ordinary block from `md`.
    expect(bar?.className).toContain("bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px))]");
    expect(bar?.className).toContain("md:static");
    // Long names wrap instead of pushing the page sideways.
    for (const id of ["wizard-next", "wizard-back", "wizard-skip"]) {
      const button = screen.getByTestId(id);
      expect(button.className).toContain("whitespace-normal");
      expect(button.className).toContain("min-w-0");
      expect(button.className).toContain("min-h-11");
    }
  });
});
