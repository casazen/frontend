import { describe, expect, it } from "vitest";
import it_ from "@/i18n/locales/it.json";
import en from "@/i18n/locales/en.json";
import { ADMIN_SUPPLIER_STATUSES } from "@/types/admin-suppliers";
import { LEASE_STATUSES } from "@/types/lease.types";
import {
  PIPELINE_STEP_OF,
  STATUS_DICTIONARY,
  STATUS_PIPELINES,
  getStatusDefinition,
  isStatusKind,
  pipelineIndex,
  propertyStatus,
  rentStatus,
  statusTextKey,
  type StatusDefinition,
  type StatusKind,
} from "../status-dictionary";

type Tree = { [key: string]: string | string[] | Tree };
const texts: Record<"it" | "en", Tree> = { it: (it_ as unknown as { status: Tree }).status, en: (en as unknown as { status: Tree }).status };

/** The values each backend enum has, as the API serializes them. A new value in the backend is a new line here and in the dictionary. */
const ENUM_VALUES: Record<StatusKind, readonly string[]> = {
  // Casazen.Core.Entities.BookingStatus
  booking: ["Pending", "Confirmed", "CheckedIn", "CheckedOut", "Cancelled"],
  // PropertyComplianceStatus, and the pause the host sets (`IsPaused`, not an enum value)
  property: ["Pending", "Active", "Suspended", "Paused"],
  // ServiceRequestStatus, with Annullato (SP-04)
  request: ["Richiesto", "PresoInCarico", "InCorso", "Completato", "Pagato", "Rifiutato", "Annullato"],
  // OrgMemberStatus (AM-01) and OrgInvitationStatus (AM-02)
  member: ["Active", "Deactivated", "Pending", "Accepted", "Revoked", "Expired"],
  // SubscriptionStatus as `GET /api/billing/subscription` sends it
  subscription: ["active", "trialing", "past_due", "incomplete", "unpaid", "canceled", "none"],
  lease: [...LEASE_STATUSES],
  // RentLedgerStatus, and the overdue installment that the API flags with `isOverdue`
  rent: ["Scheduled", "Overdue", "Processing", "Paid", "Failed", "Cancelled"],
  supplier: [...ADMIN_SUPPLIER_STATUSES],
  // GuestCheckInSessionStatus
  checkin: ["Inviato", "InCompilazione", "Completo", "AlloggiatiInviato", "Scaduto"],
  // AlloggiatiWebStatus
  alloggiati: ["DaInviare", "DaInviareManualmente", "InviatoManualmente", "Inviato", "Rifiutato", "Errore"],
};

const kinds = Object.keys(STATUS_DICTIONARY) as StatusKind[];
const entries = kinds.flatMap((kind) =>
  Object.entries(STATUS_DICTIONARY[kind] as Record<string, StatusDefinition>).map(([status, definition]) => ({ kind, status, definition })),
);

function textAt(language: "it" | "en", path: string[]): string | string[] | undefined {
  let node: string | string[] | Tree | undefined = texts[language];
  for (const part of path) {
    if (node === undefined || typeof node === "string" || Array.isArray(node)) return undefined;
    node = node[part];
  }
  return node as string | string[] | undefined;
}

describe("dictionary and enums", () => {
  it("dictionary_KindsAvailable_AreTheOnesWithABackendEnum", () => {
    expect(kinds.sort()).toEqual(Object.keys(ENUM_VALUES).sort());
  });

  it.each(kinds)("dictionary_%s_HasExactlyTheValuesOfItsEnum", (kind) => {
    expect(Object.keys(STATUS_DICTIONARY[kind]).sort()).toEqual([...ENUM_VALUES[kind]].sort());
  });

  it("dictionary_DerivedStates_AreTheOnesTheInterfaceWorksOut", () => {
    const derived = entries.filter(({ definition }) => definition.derived).map(({ kind, status }) => `${kind}.${status}`);

    expect(derived.sort()).toEqual(["property.Paused", "rent.Overdue"]);
  });

  it("dictionary_RequestKind_HasInCorsoAndAnnullatoOfSP04", () => {
    expect(Object.keys(STATUS_DICTIONARY.request)).toEqual(expect.arrayContaining(["InCorso", "Annullato"]));
  });

  it("getStatusDefinition_UnknownValueOrKindWithoutIt_IsNull", () => {
    expect(getStatusDefinition("booking", "Teleported")).toBeNull();
    expect(getStatusDefinition("booking", "toString")).toBeNull();
    expect(getStatusDefinition("booking", "Confirmed")?.tone).toBe("success");
  });

  it("isStatusKind_OnlyTheKindsOfTheDictionary", () => {
    expect(isStatusKind("lease")).toBe(true);
    expect(isStatusKind("site")).toBe(false);
    expect(isStatusKind("constructor")).toBe(false);
  });
});

describe("dictionary shape", () => {
  it.each(entries)("dictionary_$kind.$status_NextIsAnotherStateOfTheSameKind", ({ kind, status, definition }) => {
    if (!definition.next) return;
    expect(Object.keys(STATUS_DICTIONARY[kind])).toContain(definition.next);
    expect(definition.next).not.toBe(status);
  });

  it.each(entries)("dictionary_$kind.$status_NeedGoesWithNext", ({ definition }) => {
    // What it takes to move on exists only for a state that has somewhere to go.
    expect(Boolean(definition.need)).toBe(Boolean(definition.next));
  });

  it("dictionary_StatesThatEndAThing_HaveNoWayForward", () => {
    for (const [kind, status] of [
      ["booking", "CheckedOut"],
      ["booking", "Cancelled"],
      ["request", "Pagato"],
      ["lease", "Registered"],
      ["rent", "Paid"],
      ["alloggiati", "Inviato"],
    ] as const) {
      expect(getStatusDefinition(kind, status)?.next).toBeUndefined();
    }
  });
});

describe("texts of the dictionary", () => {
  it.each(entries.flatMap((entry) => (["it", "en"] as const).map((language) => ({ ...entry, language }))))(
    "texts_$kind.$status_$language_HaveLabelExplanationAndWhatIsNeeded",
    ({ kind, status, definition, language }) => {
      const label = textAt(language, [kind, status, "label"]);
      const explain = textAt(language, [kind, status, "explain"]);
      expect(typeof label === "string" && label.trim().length > 0, `label ${kind}.${status}`).toBe(true);
      expect(typeof explain === "string" && explain.trim().length > 0, `explain ${kind}.${status}`).toBe(true);

      const need = textAt(language, [kind, status, "need"]);
      if (definition.need) {
        expect(Array.isArray(need) && need.length > 0 && need.every((item) => item.trim().length > 0), `need ${kind}.${status}`).toBe(true);
        expect((need as string[]).length).toBeLessThanOrEqual(4);
      } else {
        expect(need, `need ${kind}.${status} must not exist`).toBeUndefined();
      }
    },
  );

  it.each(entries.filter(({ definition }) => definition.supplier).flatMap((entry) => (["it", "en"] as const).map((language) => ({ ...entry, language }))))(
    "texts_$kind.$status_$language_SupplierPointOfViewHasItsOwnWords",
    ({ kind, status, definition, language }) => {
      const explain = textAt(language, [kind, status, "supplier", "explain"]);
      expect(typeof explain === "string" && explain.length > 0, `supplier explain ${kind}.${status}`).toBe(true);
      const label = textAt(language, [kind, status, "supplier", "label"]);
      expect(label !== undefined, `supplier label ${kind}.${status}`).toBe(Boolean(definition.supplier?.label));
      const need = textAt(language, [kind, status, "supplier", "need"]);
      expect(need !== undefined, `supplier need ${kind}.${status}`).toBe(Boolean(definition.supplier?.need));
    },
  );

  it.each(["it", "en"] as const)("texts_%s_HaveNothingThatTheDictionaryDoesNotKnow", (language) => {
    const stray: string[] = [];
    for (const kind of kinds) {
      const states = (texts[language][kind] ?? {}) as Tree;
      for (const [status, parts] of Object.entries(states)) {
        const definition = getStatusDefinition(kind, status);
        if (!definition) {
          stray.push(`${kind}.${status}`);
          continue;
        }
        for (const part of Object.keys(parts as Tree)) {
          const allowed = ["label", "explain", ...(definition.need ? ["need"] : []), ...(definition.supplier ? ["supplier"] : [])];
          if (!allowed.includes(part)) stray.push(`${kind}.${status}.${part}`);
        }
      }
    }
    // Namespaces of the shared parts and of the kinds, and nothing else.
    const topLevel = Object.keys(texts[language]).filter((key) => !kinds.includes(key as StatusKind));
    expect(topLevel.sort()).toEqual(["explainer", "pipeline"]);
    expect(stray).toEqual([]);
  });

  it("texts_BothLanguages_HaveTheSameShapeForEveryState", () => {
    const shape = (language: "it" | "en") =>
      entries.map(({ kind, status }) => {
        const node = (texts[language][kind] as Tree)[status] as Tree;
        return `${kind}.${status}:${Object.keys(node).sort().join(",")}`;
      });

    expect(shape("it")).toEqual(shape("en"));
  });

  it("statusTextKey_HostAndSupplier_PointAtTheRightPlace", () => {
    expect(statusTextKey("request", "Richiesto", "label")).toBe("status.request.Richiesto.label");
    expect(statusTextKey("request", "Richiesto", "need", "supplier")).toBe("status.request.Richiesto.supplier.need");
  });

  it("texts_RulesOfLaw_FollowTheBackendRegulationsAndNotTheDemo", () => {
    // D32: Alloggiati Web, art. 109 TULPS: 24 hours from arrival, 6 hours if the stay does not exceed 24 hours ("una sola notte" was the demo).
    const alloggiati = textAt("it", ["alloggiati", "DaInviareManualmente", "explain"]) as string;
    expect(alloggiati).toContain("entro 24 ore dall'arrivo");
    expect(alloggiati).toContain("6 ore se il soggiorno non supera le 24 ore");
    expect(alloggiati).not.toMatch(/una sola notte/i);
    // Registration of the lease: 30 days from signing or from the start date, whichever is earlier ("dalla firma" was the demo).
    const lease = textAt("it", ["lease", "Signed", "explain"]) as string;
    expect(lease).toContain("30 giorni dalla stipula o dalla decorrenza, se anteriore");
    expect(lease).not.toMatch(/dalla firma/i);
    expect(textAt("en", ["lease", "Signed", "explain"]) as string).toContain("whichever comes first");
  });

  it("texts_StatesThatCasaZenDoesNotTransmit_NeverPretendTo", () => {
    // The Questura portal is used by the host: CasaZen sends nothing and holds no receipt for a manual sending.
    expect(textAt("it", ["alloggiati", "DaInviareManualmente", "explain"]) as string).toContain("CasaZen non la trasmette");
    expect(textAt("it", ["alloggiati", "InviatoManualmente", "explain"]) as string).toContain("CasaZen non ha una ricevuta");
  });

  it("texts_Dictionary_HasNoPlaceholdersOrMarkup", () => {
    const all: string[] = [];
    for (const kind of kinds) {
      for (const language of ["it", "en"] as const) {
        const walk = (node: string | string[] | Tree) => {
          if (typeof node === "string") all.push(node);
          else if (Array.isArray(node)) all.push(...node);
          else Object.values(node).forEach(walk);
        };
        walk(texts[language][kind] as Tree);
      }
    }
    expect(all.filter((text) => /\{\{|<\/?\w+>/.test(text))).toEqual([]);
  });
});

describe("pipelines", () => {
  it("pipelines_EveryStep_IsAStateOfItsKindWithoutRepeats", () => {
    for (const kind of kinds) {
      const steps = STATUS_PIPELINES[kind] as readonly string[] | undefined;
      if (!steps) continue;
      expect(new Set(steps).size).toBe(steps.length);
      for (const step of steps) expect(Object.keys(STATUS_DICTIONARY[kind])).toContain(step);
    }
  });

  it("pipelines_StatesPartOfAStep_PointAtAStepOfTheirPath", () => {
    for (const kind of kinds) {
      const aliases = (PIPELINE_STEP_OF[kind] ?? {}) as Record<string, string>;
      const steps = (STATUS_PIPELINES[kind] ?? []) as readonly string[];
      for (const [state, step] of Object.entries(aliases)) {
        expect(Object.keys(STATUS_DICTIONARY[kind]), `${kind}.${state}`).toContain(state);
        expect(steps, `${kind}.${state} -> ${step}`).toContain(step);
      }
    }
  });

  it("pipelineIndex_StatesOnThePath_ArePositioned", () => {
    expect(pipelineIndex("booking", "Pending")).toBe(0);
    expect(pipelineIndex("booking", "CheckedIn")).toBe(2);
    expect(pipelineIndex("lease", "PartiallySigned")).toBe(1);
    expect(pipelineIndex("lease", "SentToProvider")).toBe(3);
    expect(pipelineIndex("rent", "Overdue")).toBe(0);
    expect(pipelineIndex("member", "Accepted")).toBe(1);
  });

  it("pipelineIndex_OffThePathOrNoPath_IsMinusOne", () => {
    expect(pipelineIndex("booking", "Cancelled")).toBe(-1);
    expect(pipelineIndex("lease", "Rejected")).toBe(-1);
    expect(pipelineIndex("request", "Annullato")).toBe(-1);
    expect(pipelineIndex("subscription", "active")).toBe(-1);
    expect(pipelineIndex("booking", "Teleported")).toBe(-1);
  });
});

describe("states the interface works out", () => {
  it.each([
    [{ complianceStatus: "Active", isPaused: false }, "Active"],
    [{ complianceStatus: "Active", isPaused: true }, "Paused"],
    [{ complianceStatus: "Pending", isPaused: false }, "Pending"],
    [{ complianceStatus: "Pending", isPaused: true }, "Paused"],
    [{ complianceStatus: "Suspended", isPaused: true }, "Suspended"],
    [{ complianceStatus: "Suspended" }, "Suspended"],
    [{ complianceStatus: null }, "Pending"],
    [{}, "Pending"],
  ])("propertyStatus_%j_Is%s", (property, expected) => {
    expect(propertyStatus(property)).toBe(expected);
  });

  it.each([
    [{ status: "Scheduled", isOverdue: true }, "Overdue"],
    [{ status: "Failed", isOverdue: true }, "Overdue"],
    [{ status: "Scheduled", isOverdue: false }, "Scheduled"],
    [{ status: "Paid", isOverdue: true }, "Paid"],
    [{ status: "Processing", isOverdue: true }, "Processing"],
    [{ status: "Cancelled" }, "Cancelled"],
  ] as const)("rentStatus_%j_Is%s", (installment, expected) => {
    expect(rentStatus(installment)).toBe(expected);
  });
});
