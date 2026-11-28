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

export const HEAT_SOURCES = ['GasSupply', 'GasHob', 'Boiler', 'WaterHeater', 'Stove', 'Fireplace', 'Other'] as const;
export type HeatSource = (typeof HEAT_SOURCES)[number];

export const QUICK_ITEMS: readonly SafetyItemCode[] = [
  'FireExtinguishers',
  'GasDetector',
  'CoDetector',
  'SystemsCompliance',
  'SmokeDetector',
  'EmergencyInstructions',
  'BdsrDeclaration',
];

export const MAX_EXTINGUISHERS = 100;

export interface QuickSafetyState {
  heat: 'yes' | 'no' | null;
  heatSources: HeatSource[];
  entrepreneurial: boolean | null;
  floorCount: number;
  present: SafetyItemCode[];
  touched: SafetyItemCode[];
  extinguishers: number | null;
  confirm: boolean;
}

export type PrefillReason = 'amenity' | 'fiscalVat' | 'fiscalThreshold' | 'fiscalNone' | 'floors' | 'cin';
export type PrefillKey = 'heat' | 'entrepreneurial' | 'floorCount' | SafetyItemCode;
export type Prefilled = Partial<Record<PrefillKey, PrefillReason>>;

export interface SafetyHints {
  amenities: readonly string[];
  areaSqm: number | null;
  /** The property's CIN, when it has one: it is issued only with the declaration in BDSR. */
  cinCode: string | null;
  fiscal: { hasPartitaIva: boolean; requiresPartitaIva: boolean } | null;
}

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

export function heatIsIncomplete(state: Pick<QuickSafetyState, 'heat' | 'heatSources'>): boolean {
  return state.heat === 'yes' && state.heatSources.length === 0;
}

export function floorAreasFor(floorCount: number, facts: SafetyChecklistFacts, areaSqm: number | null): number[] | null {
  if (facts.floorAreasSqm && facts.floorAreasSqm.length === floorCount) return facts.floorAreasSqm;
  if (floorCount === 1 && areaSqm !== null && areaSqm > 0) return [areaSqm];
  return null;
}

export function quickMinimum(state: Pick<QuickSafetyState, 'floorCount'>, checklist: SafetyChecklist, hints: SafetyHints): number {
  const areas = floorAreasFor(state.floorCount, checklist.facts, hints.areaSqm);
  return minimumExtinguishers(state.floorCount, areas ?? []) ?? state.floorCount;
}

export function extinguisherCount(state: QuickSafetyState, checklist: SafetyChecklist, hints: SafetyHints): number {
  if (state.extinguishers !== null) return state.extinguishers;
  const stored = checklist.items.find((item) => item.code === 'FireExtinguishers');
  if (stored?.answer === 'Present' && stored.quantity) return stored.quantity;
  return quickMinimum(state, checklist, hints);
}

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

function sendable(item: SafetyChecklistItem | undefined): SaveSafetyChecklistItem['answer'] {
  return item?.answer === 'Present' || item?.answer === 'Missing' ? item.answer : null;
}

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
    if (stored?.answer) continue;
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
