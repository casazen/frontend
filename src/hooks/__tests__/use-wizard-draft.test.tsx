import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { readWizardDraft, writeWizardDraft } from "@/lib/wizard-draft";
import { useWizardDraft, type UseWizardDraftOptions } from "../use-wizard-draft";

let currentUser: { id: string } | null = { id: "user-1" };
let currentOrg: { id: string } | null = { id: "org-1" };
vi.mock("@/queries/use-users", () => ({
  useCurrentUser: () => ({ user: currentUser, org: currentOrg }),
}));

const SCOPE = { userId: "user-1", orgId: "org-1" };

const open = (options?: UseWizardDraftOptions) => renderHook(() => useWizardDraft("flow", options));

beforeEach(() => {
  currentUser = { id: "user-1" };
  currentOrg = { id: "org-1" };
  sessionStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useWizardDraft opening", () => {
  it("useWizardDraft_NothingSaved_HasNoRestoredDraft", () => {
    const { result } = open();

    expect(result.current.restored).toBeNull();
    expect(result.current.savedAt).toBeNull();
  });

  it("useWizardDraft_ASavedDraft_IsRestoredWithItsTime", () => {
    const written = writeWizardDraft("flow", SCOPE, { step: "documents", values: { name: "Casa" } });

    const { result } = open();

    expect(result.current.restored).toEqual(written);
    expect(result.current.savedAt).toBe(written?.savedAt);
  });

  it("useWizardDraft_WhileSaving_TheRestoredDraftDoesNotChangeUnderThePersonsHands", () => {
    writeWizardDraft("flow", SCOPE, { step: "documents", values: { name: "Casa" } });
    const { result } = open();
    const restored = result.current.restored;

    act(() => {
      result.current.save({ step: "photos", values: { name: "Villa" } });
      vi.advanceTimersByTime(400);
    });

    expect(result.current.restored).toBe(restored);
  });

  it("useWizardDraft_NoSignedInUser_ReadsAndWritesNothing", () => {
    writeWizardDraft("flow", SCOPE, { step: "a", values: { name: "Casa" } });
    currentUser = null;
    currentOrg = null;

    const { result } = open();
    act(() => {
      result.current.save({ step: "a", values: { name: "Villa" } });
      vi.advanceTimersByTime(400);
    });

    expect(result.current.restored).toBeNull();
    expect(readWizardDraft("flow", SCOPE)?.values).toEqual({ name: "Casa" });
  });

  it("useWizardDraft_Disabled_ReadsAndWritesNothing", () => {
    writeWizardDraft("flow", SCOPE, { step: "a", values: { name: "Casa" } });

    const { result } = open({ enabled: false });
    act(() => {
      result.current.save({ step: "a", values: { name: "Villa" } });
      vi.advanceTimersByTime(400);
    });

    expect(result.current.restored).toBeNull();
    expect(readWizardDraft("flow", SCOPE)?.values).toEqual({ name: "Casa" });
  });

  it("useWizardDraft_UserWithoutOrg_KeepsItsOwnDraft", () => {
    currentOrg = null;
    const { result } = open();

    act(() => {
      result.current.save({ step: "a", values: { name: "Casa" } });
      vi.advanceTimersByTime(400);
    });

    expect(readWizardDraft("flow", { userId: "user-1", orgId: null })?.values).toEqual({ name: "Casa" });
    expect(readWizardDraft("flow", SCOPE)).toBeNull();
  });
});

describe("useWizardDraft refusing a draft", () => {
  it("useWizardDraft_AcceptSaysNo_ThrowsTheDraftAwayAndDeletesIt", () => {
    writeWizardDraft("flow", SCOPE, { step: "documents", values: { name: "Casa" } });
    const accept = vi.fn(() => false);

    const { result } = open({ accept });

    expect(accept).toHaveBeenCalledWith(expect.objectContaining({ step: "documents", values: { name: "Casa" } }));
    expect(result.current.restored).toBeNull();
    expect(readWizardDraft("flow", SCOPE)).toBeNull();
  });

  it("useWizardDraft_AcceptSaysYes_KeepsTheDraft", () => {
    writeWizardDraft("flow", SCOPE, { step: "documents", values: { name: "Casa" } });

    const { result } = open({ accept: () => true });

    expect(result.current.restored?.values).toEqual({ name: "Casa" });
    expect(readWizardDraft("flow", SCOPE)).not.toBeNull();
  });

  it("useWizardDraft_AcceptWithNoDraft_IsNeverAsked", () => {
    const accept = vi.fn(() => true);

    open({ accept });

    expect(accept).not.toHaveBeenCalled();
  });
});

describe("useWizardDraft saving", () => {
  it("useWizardDraft_ChangesCloseTogether_AreWrittenOnceAfterTheDebounce", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const { result } = open();

    act(() => {
      result.current.save({ step: "a", values: { name: "C" } });
      vi.advanceTimersByTime(200);
      result.current.save({ step: "a", values: { name: "Ca" } });
      vi.advanceTimersByTime(200);
      result.current.save({ step: "b", values: { name: "Casa" } });
    });
    expect(setItem).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(349);
    });
    expect(setItem).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(readWizardDraft("flow", SCOPE)).toMatchObject({ step: "b", values: { name: "Casa" } });
    expect(result.current.savedAt).not.toBeNull();
  });

  it("useWizardDraft_CustomDebounce_IsUsed", () => {
    const { result } = open({ debounceMs: 50 });

    act(() => {
      result.current.save({ step: "a", values: { name: "Casa" } });
      vi.advanceTimersByTime(49);
    });
    expect(readWizardDraft("flow", SCOPE)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(readWizardDraft("flow", SCOPE)).not.toBeNull();
  });

  it("useWizardDraft_Flush_WritesAtOnce", () => {
    const { result } = open();

    act(() => {
      result.current.save({ step: "a", values: { name: "Casa" } });
      result.current.flush();
    });

    expect(readWizardDraft("flow", SCOPE)?.values).toEqual({ name: "Casa" });
  });

  it("useWizardDraft_SensitiveFields_AreNotWritten", () => {
    const { result } = open({ exclude: ["fiscalCode", "guests.*.email"] });

    act(() => {
      result.current.save({
        step: "a",
        values: { name: "Casa", fiscalCode: "RSSMRA80A01H501U", guests: [{ name: "Luca", email: "luca@example.com" }] },
      });
      result.current.flush();
    });

    expect(readWizardDraft("flow", SCOPE)?.values).toEqual({ name: "Casa", guests: [{ name: "Luca" }] });
  });

  it("useWizardDraft_Unmount_WritesWhatWasStillQueued", () => {
    const { result, unmount } = open();
    act(() => result.current.save({ step: "a", values: { name: "Casa" } }));

    unmount();

    expect(readWizardDraft("flow", SCOPE)?.values).toEqual({ name: "Casa" });
  });

  it("useWizardDraft_PageHide_WritesWhatWasStillQueued", () => {
    const { result } = open();
    act(() => result.current.save({ step: "a", values: { name: "Casa" } }));
    expect(readWizardDraft("flow", SCOPE)).toBeNull();

    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });

    expect(readWizardDraft("flow", SCOPE)?.values).toEqual({ name: "Casa" });
  });

  it("useWizardDraft_StorageFull_DoesNotThrowAndKeepsNoSavedTime", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    const { result } = open();

    act(() => {
      result.current.save({ step: "a", values: { name: "Casa" } });
      vi.advanceTimersByTime(400);
    });

    expect(result.current.savedAt).toBeNull();
  });
});

describe("useWizardDraft clearing", () => {
  it("useWizardDraft_Clear_DeletesTheDraftAndForgetsTheSavedTime", () => {
    const { result } = open();
    act(() => {
      result.current.save({ step: "a", values: { name: "Casa" } });
      result.current.flush();
    });
    expect(readWizardDraft("flow", SCOPE)).not.toBeNull();

    act(() => result.current.clear());

    expect(readWizardDraft("flow", SCOPE)).toBeNull();
    expect(result.current.savedAt).toBeNull();
  });

  it("useWizardDraft_ClearWithAWriteQueued_CancelsItNowAndOnUnmount", () => {
    const { result, unmount } = open();
    act(() => {
      result.current.save({ step: "a", values: { name: "Casa" } });
      result.current.clear();
      vi.advanceTimersByTime(1000);
    });
    expect(readWizardDraft("flow", SCOPE)).toBeNull();

    unmount();

    expect(readWizardDraft("flow", SCOPE)).toBeNull();
  });

  it("useWizardDraft_SaveAfterClear_StartsANewDraft", () => {
    const { result } = open();
    act(() => {
      result.current.save({ step: "a", values: { name: "Casa" } });
      result.current.clear();
      result.current.save({ step: "a", values: { name: "Villa" } });
      result.current.flush();
    });

    expect(readWizardDraft("flow", SCOPE)?.values).toEqual({ name: "Villa" });
  });
});
