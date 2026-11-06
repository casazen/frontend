import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, cleanup, configure, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wizardDraftApi } from "@/api/wizard-draft.api";
import { clearAllWizardDrafts, readWizardDraft, writeWizardDraft } from "@/lib/wizard-draft";
import type { ServerWizardDraft } from "@/types/wizard";
import { useWizardDraft, type UseWizardDraftOptions } from "../use-wizard-draft";

let currentUser: { id: string } | null = { id: "user-1" };
vi.mock("@/queries/use-users", () => ({
  useCurrentUser: () => ({ user: currentUser, org: currentUser ? { id: "org-1" } : null }),
}));
vi.mock("@/api/wizard-draft.api", () => ({
  WIZARD_DRAFTS_KEY: ["wizard-drafts"],
  wizardDraftApi: { get: vi.fn(), save: vi.fn(), remove: vi.fn() },
}));

// Explicit conditions only; a generous ceiling so that a loaded CI machine does not fail a correct test.
configure({ asyncUtilTimeout: 5_000 });

const SCOPE = { userId: "user-1", orgId: "org-1" };
const SAVED = { status: "saved", version: 1, lastSavedAt: "2026-11-06T09:30:00Z" } as const;

function serverDraft(overrides: Partial<ServerWizardDraft> = {}): ServerWizardDraft {
  return {
    type: "BookingCreate",
    entityId: null,
    version: 4,
    data: { shape: 1, step: "photos", values: { name: "From the server" } },
    lastSavedAt: new Date(Date.now() - 10_000).toISOString(),
    ...overrides,
  };
}

function open(options: UseWizardDraftOptions = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  const hook = renderHook(() => useWizardDraft("flow", { server: { type: "BookingCreate" }, ...options }), { wrapper });
  return { ...hook, invalidate };
}

async function openReady(options: UseWizardDraftOptions = {}) {
  const opened = open(options);
  await waitFor(() => expect(opened.result.current.ready).toBe(true));
  return opened;
}

const sentOnce = () => {
  expect(wizardDraftApi.save).toHaveBeenCalledTimes(1);
  return vi.mocked(wizardDraftApi.save).mock.calls[0];
};

beforeEach(() => {
  currentUser = { id: "user-1" };
  sessionStorage.clear();
  vi.mocked(wizardDraftApi.get).mockReset().mockResolvedValue(null);
  vi.mocked(wizardDraftApi.save).mockReset().mockResolvedValue(SAVED);
  vi.mocked(wizardDraftApi.remove).mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  // The flows are unmounted before the real timers come back: the interval of a flow was made with the fake ones.
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useWizardDraft with a draft on the server: opening", () => {
  it("useWizardDraft_ServerFlow_IsNotReadyUntilTheServerHasAnswered", async () => {
    const { result } = open();

    expect(result.current.ready).toBe(false);
    expect(result.current.restored).toBeNull();

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(wizardDraftApi.get).toHaveBeenCalledWith("BookingCreate", null);
    expect(result.current.status).toBe("idle");
  });

  it("useWizardDraft_ServerDraftNewerThanTheBrowserCopy_IsRestoredAndItsVersionIsTheBaseOfTheNextSave", async () => {
    writeWizardDraft("flow", SCOPE, { step: "dates", values: { name: "Older, from the browser" } }, { now: Date.now() - 60_000 });
    const found = serverDraft();
    vi.mocked(wizardDraftApi.get).mockResolvedValue(found);

    const { result } = await openReady();

    expect(result.current.restored).toEqual({ step: "photos", values: { name: "From the server" }, savedAt: Date.parse(found.lastSavedAt) });
    expect(result.current.status).toBe("saved");
    expect(result.current.serverSavedAt).toBe(Date.parse(found.lastSavedAt));

    act(() => {
      result.current.save({ step: "photos", values: { name: "Typed here" } });
      result.current.flush();
    });
    await waitFor(() => expect(wizardDraftApi.save).toHaveBeenCalledTimes(1));
    expect(sentOnce()[1]).toMatchObject({ clientVersion: 4 });
  });

  it("useWizardDraft_BrowserCopyNewerThanTheServerDraft_IsRestoredButSavesOnTheServerVersion", async () => {
    writeWizardDraft("flow", SCOPE, { step: "dates", values: { name: "Newer, from the browser" } }, { now: Date.now() - 1_000 });
    vi.mocked(wizardDraftApi.get).mockResolvedValue(serverDraft({ lastSavedAt: new Date(Date.now() - 60_000).toISOString() }));

    const { result } = await openReady();

    expect(result.current.restored?.values).toEqual({ name: "Newer, from the browser" });
    expect(result.current.status).toBe("idle");

    act(() => {
      result.current.save({ step: "dates", values: { name: "Newer, from the browser" } });
      result.current.flush();
    });
    await waitFor(() => expect(wizardDraftApi.save).toHaveBeenCalledTimes(1));
    expect(sentOnce()[1]).toMatchObject({ clientVersion: 4 });
  });

  it("useWizardDraft_ServerCannotBeRead_TheFlowGoesOnWithTheBrowserCopy", async () => {
    writeWizardDraft("flow", SCOPE, { step: "dates", values: { name: "From the browser" } });
    vi.mocked(wizardDraftApi.get).mockRejectedValue(new Error("offline"));

    const { result } = await openReady();

    expect(result.current.restored?.values).toEqual({ name: "From the browser" });
  });
});

describe("useWizardDraft with a draft on the server: saving", () => {
  it("useWizardDraft_ServerFlow_SensitiveFieldsAreSentNowhere", async () => {
    const { result } = await openReady({ exclude: ["fiscalCode", "guests.*.documentNumber"] });

    act(() => {
      result.current.save({
        step: "guests",
        values: { name: "Casa", fiscalCode: "RSSMRA80A01H501U", guests: [{ name: "Luca", documentNumber: "AX1234567" }] },
      });
      result.current.flush();
    });
    await waitFor(() => expect(wizardDraftApi.save).toHaveBeenCalledTimes(1));

    const [type, sent] = sentOnce();
    expect(type).toBe("BookingCreate");
    expect(sent.data).toEqual({ shape: 1, step: "guests", values: { name: "Casa", guests: [{ name: "Luca" }] } });
    expect(JSON.stringify(sent)).not.toContain("RSSMRA80A01H501U");
    expect(JSON.stringify(sent)).not.toContain("AX1234567");
  });

  it("useWizardDraft_ASavedDraft_ShowsTheTimeOfTheServerAndInvalidatesTheDraftQueries", async () => {
    const { result, invalidate } = await openReady();

    act(() => {
      result.current.save({ step: "a", values: { name: "Casa" } });
      result.current.onBlur();
    });
    await waitFor(() => expect(result.current.status).toBe("saved"));

    expect(result.current.serverSavedAt).toBe(Date.parse(SAVED.lastSavedAt));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["wizard-drafts"] });
  });

  it("useWizardDraft_ChangesCloseTogether_AreSentOnceAfterThePauseWithTheLastValue", async () => {
    const { result } = await openReady({ debounceMs: 20 });

    act(() => {
      result.current.save({ step: "a", values: { name: "C" } });
      result.current.save({ step: "a", values: { name: "Ca" } });
      result.current.save({ step: "a", values: { name: "Casa" } });
    });
    expect(result.current.status).toBe("pending");
    expect(wizardDraftApi.save).not.toHaveBeenCalled();

    await waitFor(() => expect(result.current.status).toBe("saved"));
    expect(sentOnce()[1].data).toMatchObject({ values: { name: "Casa" } });
  });

  it("useWizardDraft_UnsavedChanges_AreSentByTheTimerOfThirtySeconds", async () => {
    const { result } = await openReady({ debounceMs: 120_000 });
    vi.useFakeTimers();

    act(() => result.current.save({ step: "a", values: { name: "Casa" } }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_000);
    });
    expect(wizardDraftApi.save).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(sentOnce()[1].data).toMatchObject({ values: { name: "Casa" } });
    expect(result.current.status).toBe("saved");
  });

  it("useWizardDraft_ASaveThatFails_IsSaidAndRetriedOnRequest", async () => {
    vi.mocked(wizardDraftApi.save).mockRejectedValueOnce(new Error("network"));
    const { result } = await openReady();

    act(() => {
      result.current.save({ step: "a", values: { name: "Casa" } });
      result.current.flush();
    });
    await waitFor(() => expect(result.current.status).toBe("error"));

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe("saved"));
    expect(wizardDraftApi.save).toHaveBeenCalledTimes(2);
  });

  it("useWizardDraft_NoSignedInUser_ReadsAndSendsNothing", async () => {
    currentUser = null;

    const { result } = await openReady();
    await act(async () => {
      result.current.save({ step: "a", values: { name: "Casa" } });
      result.current.flush();
    });

    expect(wizardDraftApi.get).not.toHaveBeenCalled();
    expect(wizardDraftApi.save).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("useWizardDraft_SignOutWhileAnswersAreQueued_NothingIsSentAfterwards", async () => {
    const { result, unmount } = await openReady();

    await act(async () => {
      result.current.save({ step: "a", values: { name: "private" } });
      clearAllWizardDrafts();
      result.current.flush();
    });
    unmount();

    expect(wizardDraftApi.save).not.toHaveBeenCalled();
  });
});

describe("useWizardDraft with a draft on the server: two devices", () => {
  const theirs = () => serverDraft({ version: 7, data: { shape: 1, step: "photos", values: { name: "Theirs" } } });

  async function conflicting() {
    vi.mocked(wizardDraftApi.save).mockResolvedValueOnce({ status: "conflict", serverDraft: theirs(), serverVersion: 7 });
    const opened = await openReady();
    act(() => {
      opened.result.current.save({ step: "dates", values: { name: "Mine" } });
      opened.result.current.flush();
    });
    await waitFor(() => expect(opened.result.current.status).toBe("conflict"));
    return opened;
  }

  it("useWizardDraft_ASaveBehindTheServer_StopsAndHoldsBothVersionsWithoutOverwritingAnything", async () => {
    const { result } = await conflicting();

    expect(result.current.conflict?.serverVersion).toBe(7);
    expect(result.current.conflict?.serverDraft?.data).toMatchObject({ values: { name: "Theirs" } });

    await act(async () => {
      result.current.save({ step: "dates", values: { name: "Mine, a bit more" } });
      result.current.flush();
    });
    expect(wizardDraftApi.save).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("conflict");
  });

  it("useWizardDraft_KeepMine_SavesAgainOnTheVersionOfTheServer", async () => {
    const { result } = await conflicting();

    act(() => result.current.keepMine());
    await waitFor(() => expect(result.current.status).toBe("saved"));

    expect(result.current.conflict).toBeNull();
    expect(wizardDraftApi.save).toHaveBeenCalledTimes(2);
    expect(vi.mocked(wizardDraftApi.save).mock.calls[1][1]).toMatchObject({
      clientVersion: 7,
      data: { step: "dates", values: { name: "Mine" } },
    });
  });

  it("useWizardDraft_TakeTheirs_GivesTheServerDraftBackAndSendsNothingOfWhatWasTypedHere", async () => {
    const { result } = await conflicting();

    let taken: ReturnType<typeof result.current.takeTheirs> = null;
    act(() => {
      taken = result.current.takeTheirs();
    });

    expect(taken).toMatchObject({ step: "photos", values: { name: "Theirs" } });
    expect(result.current.conflict).toBeNull();
    expect(result.current.status).toBe("saved");
    // A reload does not bring back what was given up.
    expect(readWizardDraft("flow", SCOPE)).toMatchObject({ step: "photos", values: { name: "Theirs" } });

    act(() => {
      result.current.save({ step: "photos", values: { name: "Theirs, and one more thing" } });
      result.current.flush();
    });
    await waitFor(() => expect(wizardDraftApi.save).toHaveBeenCalledTimes(2));
    expect(vi.mocked(wizardDraftApi.save).mock.calls[1][1]).toMatchObject({
      clientVersion: 7,
      data: { values: { name: "Theirs, and one more thing" } },
    });
  });
});

describe("useWizardDraft with a draft on the server: clearing", () => {
  it("useWizardDraft_Clear_DeletesTheDraftOfTheServerToo", async () => {
    const { result, invalidate } = await openReady();

    act(() => result.current.clear());
    await waitFor(() => expect(wizardDraftApi.remove).toHaveBeenCalledWith("BookingCreate", null));

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["wizard-drafts"] }));
    expect(result.current.status).toBe("idle");
  });

  it("useWizardDraft_ClearWithAChangeWaiting_NeverSendsIt", async () => {
    const { result, unmount } = await openReady();

    act(() => {
      result.current.save({ step: "a", values: { name: "Casa" } });
      result.current.clear();
    });
    unmount();
    await waitFor(() => expect(wizardDraftApi.remove).toHaveBeenCalledTimes(1));

    expect(wizardDraftApi.save).not.toHaveBeenCalled();
  });

  it("useWizardDraft_SigningOut_DoesNotDeleteTheDraftOfTheServer", async () => {
    const { result } = await openReady();

    await act(async () => {
      clearAllWizardDrafts();
      result.current.clear();
    });

    expect(wizardDraftApi.remove).not.toHaveBeenCalled();
  });
});
