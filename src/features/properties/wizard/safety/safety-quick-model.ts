import { minimumExtinguishers, safetyItemRequirement } from '@/lib/safety-checklist';
import {
  COMBUSTION_APPLIANCES,
  SAFETY_ITEM_CODES,
  type CombustionAppliance,
  type SafetyChecklist,
  type SafetyChecklistFacts,
  type SafetyChecklistItem,
  type SafetyItemCode,
  type SaveSafetyChecklistCommand,
  type SaveSafetyChecklistItem,
} from '@/types/compliance.types';

/**
 * The quick safety sheet of «Aggiungi immobile» (item 3 of the pre-release list): the same checklist as the full form of CO-07,
 * asked as three questions and a list of things to tick, like the «Dispositivi di sicurezza» of the big platforms. It writes the
 * very body of `PUT /properties/:id/compliance/safety-checklist`, so the server's rules (`SafetyChecklistRules`) decide what is
 * missing exactly as with the full form; what the quick sheet does not ask (where the devices are, the dates, the proofs, the
 * m² of each floor) is sent back as it is stored.
 */

/** What burns in the unit, one tap each: the gas that arrives (mains, LPG, cylinder) and the appliances of the checklist. */
export const HEAT_SOURCES = ['GasSupply', 'GasHob', 'Boiler', 'WaterHeater', 'Stove', 'Fireplace', 'Other'] as const;
export type HeatSource = (typeof HEAT_SOURCES)[number];

/** The items of «Cosa hai già in casa?», in order; the declaration in BDSR closes the list. */
export const QUICK_ITEMS: readonly SafetyItemCode[] = [
  'FireExtinguishers',
  'GasDetector',
  'CoDetector',
  'SystemsCompliance',
  'SmokeDetector',
  'EmergencyInstructions',
  'BdsrDeclaration',
];

/** Same limit as the backend (`SafetyChecklistRules.MaxQuantity`). */
export const MAX_EXTINGUISHERS = 100;

export interface QuickSafetyState {
  /** «C'è gas o una fiamma in casa?»: yes, no (all electric) or not answered yet. */
  heat: 'yes' | 'no' | null;
  /** With `heat: 'yes'`: what there is. */
  heatSources: HeatSource[];
  entrepreneurial: boolean | null;
  floorCount: number;
  /** The items ticked as present. */
  present: SafetyItemCode[];
  /** The items the host ticked or unticked here: an item left alone and not ticked stays unanswered. */
  touched: SafetyItemCode[];
  /** How many extinguishers the host says; `null` = the stored number, or the minimum for a new answer. */
  extinguishers: number | null;
  /** The final confirmation (SC-08): asked again at every save, as the full form does. */
  confirm: boolean;
}

/**
 * Where a prefilled answer comes from. The sheet never decides for the host: an answer filled in from what CasaZen already
 * knows is shown as such, with its reason, until the host changes it, and nothing is confirmed without the host's tick.
 */
export type PrefillReason = 'amenity' | 'fiscalVat' | 'fiscalThreshold' | 'fiscalNone' | 'floors' | 'cin';
export type PrefillKey = 'heat' | 'entrepreneurial' | 'floorCount' | SafetyItemCode;
export type Prefilled = Partial<Record<PrefillKey, PrefillReason>>;

/** What CasaZen already knows about the property and its org, read by the wizard. */
export interface SafetyHints {
  /** The amenities chosen in the step, saved or not yet. */
  amenities: readonly string[];
  /** Whole square metres of the property; null when not given. */
  areaSqm: number | null;
  /** The property's CIN, when it has one: it is issued only with the declaration in BDSR. */
  cinCode: string | null;
  /** From the tax data, when the host may read them (`payment.read`); null when unknown. */
  fiscal: { hasPartitaIva: boolean; requiresPartitaIva: boolean } | null;
}

/** The amenities of the wizard that say an item of the sheet is in the unit. */
const ITEM_FROM_AMENITY: ReadonlyArray<[amenity: string, item: SafetyItemCode]> = [
  ['FireExtinguisher', 'FireExtinguishers'],
  ['CarbonMonoxideDetector', 'CoDetector'],
  ['SmokeDetector', 'SmokeDetector'],
];

const isAppliance = (source: HeatSource): source is CombustionAppliance =>
  (COMBUSTION_APPLIANCES as readonly string[]).includes(source);

/**
 * The facts of the checklist from the answer about gas and flames. «All electric» is the exemption of the detectors (no gas and
 * no appliance). With «yes» the gas counts as present when the host picks it, or the gas hob, which needs it; otherwise it is
 * left unstated rather than denied (a boiler may burn gas), and the appliances picked make the detectors required anyway.
 */
export function heatFacts(state: Pick<QuickSafetyState, 'heat' | 'heatSources'>): Pick<SafetyChecklistFacts, 'hasGasSupply' | 'combustionAppliances'> {
  if (state.heat === 'no') return { hasGasSupply: false, combustionAppliances: [] };
  if (state.heat !== 'yes') return { hasGasSupply: null, combustionAppliances: null };
  const appliances = state.heatSources.filter(isAppliance);
  const gas = state.heatSources.includes('GasSupply') || state.heatSources.includes('GasHob');
  return { hasGasSupply: gas ? true : null, combustionAppliances: appliances.length > 0 ? appliances : null };
}

/** «Yes» needs at least one thing picked, or the server could not tell whether the detectors are required. */
export function heatIsIncomplete(state: Pick<QuickSafetyState, 'heat' | 'heatSources'>): boolean {
  return state.heat === 'yes' && state.heatSources.length === 0;
}

/**
 * The m² of each floor as they are sent: the stored ones when they match the floors, else the area of the property when the
 * unit is on one floor (one extinguisher every 200 m²), else none (the minimum is then one per floor, as the server says).
 */
export function floorAreasFor(floorCount: number, facts: SafetyChecklistFacts, areaSqm: number | null): number[] | null {
  if (facts.floorAreasSqm && facts.floorAreasSqm.length === floorCount) return facts.floorAreasSqm;
  if (floorCount === 1 && areaSqm !== null && areaSqm > 0) return [areaSqm];
  return null;
}

/** The minimum number of extinguishers for these answers, with the rule of the server. */
export function quickMinimum(state: Pick<QuickSafetyState, 'floorCount'>, checklist: SafetyChecklist, hints: SafetyHints): number {
  const areas = floorAreasFor(state.floorCount, checklist.facts, hints.areaSqm);
  return minimumExtinguishers(state.floorCount, areas ?? []) ?? state.floorCount;
}

/** How many extinguishers are declared: the number the host set, else the stored one, else the minimum. */
export function extinguisherCount(state: QuickSafetyState, checklist: SafetyChecklist, hints: SafetyHints): number {
  if (state.extinguishers !== null) return state.extinguishers;
  const stored = checklist.items.find((item) => item.code === 'FireExtinguishers');
  if (stored?.answer === 'Present' && stored.quantity) return stored.quantity;
  return quickMinimum(state, checklist, hints);
}

/**
 * The items of «Cosa hai già in casa?» that apply to these answers: the ones the law asks for (the detectors only with gas or a
 * flame, the compliant systems only for a business) and the recommended ones. An item that depends on a question not answered
 * yet is not shown: the question comes first.
 */
export function visibleItems(state: Pick<QuickSafetyState, 'heat' | 'heatSources' | 'entrepreneurial'>): SafetyItemCode[] {
  const facts = { entrepreneurial: state.entrepreneurial, ...heatFacts(state) };
  return QUICK_ITEMS.filter((code) => {
    const { requirement } = safetyItemRequirement(code, {
      entrepreneurial: facts.entrepreneurial,
      hasGasSupply: facts.hasGasSupply,
      appliances: facts.combustionAppliances,
    });
    return requirement === 'Required' || requirement === 'Optional';
  });
}

/** The stored answer as it can be sent again: `ToReview` (imported from the old checklist) is never sent. */
function sendable(item: SafetyChecklistItem | undefined): SaveSafetyChecklistItem['answer'] {
  return item?.answer === 'Present' || item?.answer === 'Missing' ? item.answer : null;
}

/** The answers the sheet opens with: the stored ones, and where there is none what CasaZen already knows, marked as such. */
export function initialQuickState(checklist: SafetyChecklist, hints: SafetyHints): { state: QuickSafetyState; prefilled: Prefilled } {
  const prefilled: Prefilled = {};
  const { facts } = checklist;
  const byCode = new Map(checklist.items.map((item) => [item.code, item]));

  let heat: QuickSafetyState['heat'] = null;
  let heatSources: HeatSource[] = [];
  if (facts.hasGasSupply === false && facts.combustionAppliances?.length === 0) {
    heat = 'no';
  } else if (facts.hasGasSupply === true || (facts.combustionAppliances?.length ?? 0) > 0) {
    heat = 'yes';
    heatSources = [...(facts.hasGasSupply === true ? (['GasSupply'] as HeatSource[]) : []), ...(facts.combustionAppliances ?? [])];
  } else if (hints.amenities.includes('Fireplace')) {
    heat = 'yes';
    heatSources = ['Fireplace'];
    prefilled.heat = 'amenity';
  }

  let entrepreneurial = facts.entrepreneurial;
  if (entrepreneurial === null && hints.fiscal) {
    if (hints.fiscal.hasPartitaIva) {
      entrepreneurial = true;
      prefilled.entrepreneurial = 'fiscalVat';
    } else if (hints.fiscal.requiresPartitaIva) {
      entrepreneurial = true;
      prefilled.entrepreneurial = 'fiscalThreshold';
    } else {
      entrepreneurial = false;
      prefilled.entrepreneurial = 'fiscalNone';
    }
  }

  let floorCount = facts.floorCount ?? 0;
  if (floorCount < 1) {
    floorCount = 1;
    prefilled.floorCount = 'floors';
  }

  const present: SafetyItemCode[] = [];
  for (const code of QUICK_ITEMS) {
    const stored = byCode.get(code);
    if (stored?.answer === 'Present') {
      present.push(code);
      continue;
    }
    if (stored?.answer) continue; // Missing, or to review: the host's own answer, nothing to prefill.
    if (ITEM_FROM_AMENITY.some(([amenity, item]) => item === code && hints.amenities.includes(amenity))) {
      present.push(code);
      prefilled[code] = 'amenity';
    } else if (code === 'BdsrDeclaration' && hints.cinCode) {
      present.push(code);
      prefilled[code] = 'cin';
    }
  }

  return {
    state: { heat, heatSources, entrepreneurial, floorCount, present, touched: [], extinguishers: null, confirm: false },
    prefilled,
  };
}

/**
 * The body of the save: the facts of these answers and every item of the checklist. A ticked item is present; an item unticked
 * here, or answered «no» before, is missing; an item left alone stays unanswered. Items that do not apply, and everything the
 * quick sheet does not ask, go back as they are stored.
 */
export function quickCommand(state: QuickSafetyState, checklist: SafetyChecklist, hints: SafetyHints): SaveSafetyChecklistCommand {
  const byCode = new Map(checklist.items.map((item) => [item.code, item]));
  const shown = new Set(visibleItems(state));

  const items = SAFETY_ITEM_CODES.map((code): SaveSafetyChecklistItem => {
    const stored = byCode.get(code);
    let answer = sendable(stored);
    if (shown.has(code)) {
      if (state.present.includes(code)) answer = 'Present';
      else if (state.touched.includes(code) || stored?.answer === 'Missing') answer = 'Missing';
      else answer = null;
    }
    return {
      code,
      answer,
      quantity: code === 'FireExtinguishers' && answer === 'Present' ? extinguisherCount(state, checklist, hints) : (stored?.quantity ?? null),
      location: stored?.location ?? null,
      detectorType: stored?.detectorType ?? null,
      checkedOn: stored?.checkedOn ?? null,
      expiresOn: stored?.expiresOn ?? null,
      evidenceDocumentId: stored?.evidenceDocumentId ?? null,
      notes: stored?.notes ?? null,
    };
  });

  return {
    facts: {
      entrepreneurial: state.entrepreneurial,
      ...heatFacts(state),
      floorCount: state.floorCount,
      floorAreasSqm: floorAreasFor(state.floorCount, checklist.facts, hints.areaSqm),
    },
    items,
    confirm: state.confirm,
  };
}
