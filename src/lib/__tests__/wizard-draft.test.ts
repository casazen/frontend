import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WIZARD_DRAFT_TTL_MS,
  clearAllWizardDrafts,
  onWizardDraftsWiped,
  clearWizardDraft,
  readWizardDraft,
  storableValues,
  wizardDraftKey,
  writeWizardDraft,
} from "../wizard-draft";

const SCOPE = { userId: "user-1", orgId: "org-1" };
const NOW = 1_800_000_000_000;

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("wizardDraftKey", () => {
  it("wizardDraftKey_UserOrgAndFlow_AreAllInTheKey", () => {
    expect(wizardDraftKey("property-new", SCOPE)).toBe("casazen.wizardDraft:user-1:org-1:property-new");
  });

  it("wizardDraftKey_UserWithoutOrg_UsesADashNotAnEmptyPart", () => {
    expect(wizardDraftKey("property-new", { userId: "user-1", orgId: null })).toBe("casazen.wizardDraft:user-1:-:property-new");
  });

  it("wizardDraftKey_SeparatorsInTheParts_AreEncodedSoPartsCannotCollide", () => {
    const a = wizardDraftKey("x", { userId: "auth0|a:b", orgId: "c" });
    const b = wizardDraftKey("x", { userId: "auth0|a", orgId: "b:c" });
    expect(a).not.toBe(b);
    expect(a).toBe("casazen.wizardDraft:auth0%7Ca%3Ab:c:x");
  });
});

describe("write and read", () => {
  it("writeWizardDraft_ThenRead_GivesBackTheStepTheAnswersAndTheTime", () => {
    const written = writeWizardDraft("flow", SCOPE, { step: "documents", values: { name: "Casa", rooms: 3 } }, { now: NOW });

    expect(written).toEqual({ step: "documents", values: { name: "Casa", rooms: 3 }, savedAt: NOW });
    expect(readWizardDraft("flow", SCOPE, { now: NOW + 1000 })).toEqual(written);
  });

  it("readWizardDraft_NothingSaved_IsNull", () => {
    expect(readWizardDraft("flow", SCOPE)).toBeNull();
  });

  it("readWizardDraft_AnotherUserOrAnotherOrg_NeverSeesTheDraft", () => {
    writeWizardDraft("flow", SCOPE, { step: "a", values: { name: "Casa" } });

    expect(readWizardDraft("flow", { userId: "user-2", orgId: "org-1" })).toBeNull();
    expect(readWizardDraft("flow", { userId: "user-1", orgId: "org-2" })).toBeNull();
    expect(readWizardDraft("flow", { userId: "user-1", orgId: null })).toBeNull();
    expect(readWizardDraft("other-flow", SCOPE)).toBeNull();
  });

  it("readWizardDraft_ExactlyTheTimeToLive_IsStillGood", () => {
    writeWizardDraft("flow", SCOPE, { step: "a", values: { name: "Casa" } }, { now: NOW });

    expect(readWizardDraft("flow", SCOPE, { now: NOW + WIZARD_DRAFT_TTL_MS })).not.toBeNull();
  });

  it("readWizardDraft_OlderThanADay_IsNullAndDeleted", () => {
    writeWizardDraft("flow", SCOPE, { step: "a", values: { name: "Casa" } }, { now: NOW });

    expect(readWizardDraft("flow", SCOPE, { now: NOW + WIZARD_DRAFT_TTL_MS + 1 })).toBeNull();
    expect(sessionStorage.getItem(wizardDraftKey("flow", SCOPE))).toBeNull();
  });

  it("readWizardDraft_AShorterTimeToLive_IsHonoured", () => {
    writeWizardDraft("flow", SCOPE, { step: "a", values: {} }, { now: NOW });

    expect(readWizardDraft("flow", SCOPE, { now: NOW + 61_000, ttlMs: 60_000 })).toBeNull();
  });

  it("readWizardDraft_WrittenInTheFarFuture_IsRejectedAsANonsenseClock", () => {
    writeWizardDraft("flow", SCOPE, { step: "a", values: {} }, { now: NOW + 3 * WIZARD_DRAFT_TTL_MS });

    expect(readWizardDraft("flow", SCOPE, { now: NOW })).toBeNull();
  });

  it("readWizardDraft_OtherVersion_IsNullAndDeleted", () => {
    writeWizardDraft("flow", SCOPE, { step: "a", values: { name: "Casa" } }, { version: 1 });

    expect(readWizardDraft("flow", SCOPE, { version: 2 })).toBeNull();
    expect(sessionStorage.getItem(wizardDraftKey("flow", SCOPE))).toBeNull();
  });

  it.each([
    ["not JSON", "{oops"],
    ["not an object", '"text"'],
    ["no step", JSON.stringify({ values: {}, savedAt: NOW, version: 1 })],
    ["values is an array", JSON.stringify({ step: "a", values: [], savedAt: NOW, version: 1 })],
    ["no time", JSON.stringify({ step: "a", values: {}, version: 1 })],
  ])("readWizardDraft_Corrupt_%s_IsNullAndDeleted", (_label, raw) => {
    sessionStorage.setItem(wizardDraftKey("flow", SCOPE), raw);

    expect(readWizardDraft("flow", SCOPE, { now: NOW })).toBeNull();
    expect(sessionStorage.getItem(wizardDraftKey("flow", SCOPE))).toBeNull();
  });

  it("clearWizardDraft_RemovesOnlyThatDraft", () => {
    writeWizardDraft("flow", SCOPE, { step: "a", values: {} });
    writeWizardDraft("other", SCOPE, { step: "a", values: {} });

    clearWizardDraft("flow", SCOPE);

    expect(readWizardDraft("flow", SCOPE)).toBeNull();
    expect(readWizardDraft("other", SCOPE)).not.toBeNull();
  });
});

describe("what is never written", () => {
  it("storableValues_ExcludedFields_AreLeftOutAtAnyDepth", () => {
    const values = {
      name: "Anna",
      fiscalCode: "RSSMRA80A01H501U",
      owner: { iban: "IT60X0542811101000000123456", city: "Roma" },
      guests: [
        { name: "Luca", documentNumber: "AA123", email: "luca@example.com" },
        { name: "Sara", documentNumber: "BB456", email: "sara@example.com" },
      ],
    };

    expect(storableValues(values, ["fiscalCode", "owner.iban", "guests.*.documentNumber", "guests.*.email"])).toEqual({
      name: "Anna",
      owner: { city: "Roma" },
      guests: [{ name: "Luca" }, { name: "Sara" }],
    });
  });

  it("storableValues_PathThatDoesNotExist_IsIgnored", () => {
    expect(storableValues({ name: "Anna" }, ["nothing.here", "guests.*.email"])).toEqual({ name: "Anna" });
  });

  it("storableValues_ExcludedFieldsAreNotChangedInTheOriginal", () => {
    const values = { name: "Anna", fiscalCode: "RSSMRA80A01H501U" };

    storableValues(values, ["fiscalCode"]);

    expect(values.fiscalCode).toBe("RSSMRA80A01H501U");
  });

  it("storableValues_FilesBlobsAndFunctions_AreDropped", () => {
    const values = {
      name: "Anna",
      photo: new File(["x"], "foto.png", { type: "image/png" }),
      attachment: new Blob(["x"]),
      onClick: () => undefined,
      nothing: undefined,
    };

    expect(storableValues(values)).toEqual({ name: "Anna" });
  });

  it("storableValues_DatesBecomeText_AndNullsStay", () => {
    expect(storableValues({ from: new Date("2026-10-09T10:00:00Z"), note: null })).toEqual({
      from: "2026-10-09T10:00:00.000Z",
      note: null,
    });
  });

  it("storableValues_CircularStructure_IsNullInsteadOfThrowing", () => {
    const loop: Record<string, unknown> = { name: "Anna" };
    loop.self = loop;

    expect(storableValues(loop)).toBeNull();
  });

  it("writeWizardDraft_SensitiveFieldsExcluded_NeverReachTheStorage", () => {
    writeWizardDraft(
      "flow",
      SCOPE,
      { step: "a", values: { name: "Anna", fiscalCode: "RSSMRA80A01H501U", iban: "IT60X0542811101000000123456" } },
      { exclude: ["fiscalCode", "iban"] },
    );

    const raw = sessionStorage.getItem(wizardDraftKey("flow", SCOPE)) ?? "";
    expect(raw).toContain("Anna");
    expect(raw).not.toContain("RSSMRA80A01H501U");
    expect(raw).not.toContain("IT60X0542811101000000123456");
  });
});

describe("when the storage does not work", () => {
  it("writeWizardDraft_StorageFull_ReturnsNullAndDoesNotThrow", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });

    expect(writeWizardDraft("flow", SCOPE, { step: "a", values: { name: "Anna" } })).toBeNull();
  });

  it("readWizardDraft_StorageBlocked_IsNullAndDoesNotThrow", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });

    expect(readWizardDraft("flow", SCOPE)).toBeNull();
  });

  it("clearWizardDraft_StorageBlocked_DoesNotThrow", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });

    expect(() => clearWizardDraft("flow", SCOPE)).not.toThrow();
  });
});

describe("clearAllWizardDrafts", () => {
  it("clearAllWizardDrafts_SignOut_RemovesTheDraftsOfEveryUserAndFlowAndNothingElse", () => {
    writeWizardDraft("flow", SCOPE, { step: "a", values: {} });
    writeWizardDraft("other", { userId: "user-2", orgId: null }, { step: "a", values: {} });
    sessionStorage.setItem("casazen.pendingCheckout", "x");
    sessionStorage.setItem("casazen.wizardDraftNot", "x");

    clearAllWizardDrafts();

    expect(readWizardDraft("flow", SCOPE)).toBeNull();
    expect(readWizardDraft("other", { userId: "user-2", orgId: null })).toBeNull();
    expect(sessionStorage.getItem("casazen.pendingCheckout")).toBe("x");
    // A key that only starts with the same letters is not a draft.
    expect(sessionStorage.getItem("casazen.wizardDraftNot")).toBe("x");
  });

  it("clearAllWizardDrafts_StorageBlocked_DoesNotThrow", () => {
    vi.spyOn(Storage.prototype, "key").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });

    expect(() => clearAllWizardDrafts()).not.toThrow();
  });
});

describe("onWizardDraftsWiped", () => {
  it("onWizardDraftsWiped_ClearAll_CallsTheListenersBeforeTheDraftsGo", () => {
    writeWizardDraft("flow", SCOPE, { step: "a", values: {} });
    let draftWasThere = false;
    const stop = onWizardDraftsWiped(() => {
      draftWasThere = readWizardDraft("flow", SCOPE) !== null;
    });

    clearAllWizardDrafts();
    stop();

    expect(draftWasThere).toBe(true);
    expect(readWizardDraft("flow", SCOPE)).toBeNull();
  });

  it("onWizardDraftsWiped_Unregistered_IsNotCalledAnymore", () => {
    const listener = vi.fn();
    const stop = onWizardDraftsWiped(listener);
    stop();

    clearAllWizardDrafts();

    expect(listener).not.toHaveBeenCalled();
  });

  it("onWizardDraftsWiped_AListenerThrows_TheOthersStillRunAndTheDraftsGo", () => {
    writeWizardDraft("flow", SCOPE, { step: "a", values: {} });
    const second = vi.fn();
    const stopFirst = onWizardDraftsWiped(() => {
      throw new Error("cannot forget");
    });
    const stopSecond = onWizardDraftsWiped(second);

    expect(() => clearAllWizardDrafts()).not.toThrow();
    stopFirst();
    stopSecond();

    expect(second).toHaveBeenCalledTimes(1);
    expect(readWizardDraft("flow", SCOPE)).toBeNull();
  });
});
