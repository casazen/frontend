import type {
  CombustionAppliance,
  SafetyItemCode,
  SafetyItemRequirement,
  SafetyNotApplicableReason,
} from '@/types/compliance.types';

/**
 * D.L. 145/2023 art. 13-ter safety checklist (CO-07): live feedback while the host edits the form.
 *
 * Mirror of the backend single source of truth `Casazen.Core/Regulatory/SafetyChecklistRules.cs`: keep the two in sync.
 * The server evaluates the saved checklist and decides the blockers; these helpers only preview them.
 */

/** Art. 13-ter c. 7: one extinguisher every 200 m² of floor or fraction, at least one per floor. */
export const FLOOR_AREA_PER_EXTINGUISHER_SQM = 200;

export const MAX_FLOORS = 20;

/** Recommended items, not required by art. 13-ter: they never block. */
export const OPTIONAL_SAFETY_ITEMS: readonly SafetyItemCode[] = ['SmokeDetector', 'EmergencyInstructions'];

export const SAFETY_DETECTORS: readonly SafetyItemCode[] = ['GasDetector', 'CoDetector', 'SmokeDetector'];

export function minimumExtinguishers(floorCount: number | null, floorAreas: (number | null)[]): number | null {
  if (!floorCount || floorCount < 1) return null;
  if (floorAreas.length !== floorCount || floorAreas.some((a) => a === null || a <= 0)) return floorCount;
  return floorAreas.reduce<number>(
    (sum, area) => sum + Math.max(1, Math.ceil((area ?? 0) / FLOOR_AREA_PER_EXTINGUISHER_SQM)),
    0,
  );
}

export interface SafetyFactsPreview {
  entrepreneurial: boolean | null;
  hasGasSupply: boolean | null;
  appliances: CombustionAppliance[] | null;
}

export function safetyItemRequirement(
  code: SafetyItemCode,
  facts: SafetyFactsPreview,
): { requirement: SafetyItemRequirement; reason: SafetyNotApplicableReason | null } {
  if (OPTIONAL_SAFETY_ITEMS.includes(code)) return { requirement: 'Optional', reason: null };
  if (code === 'GasDetector' || code === 'CoDetector') {
    if (facts.hasGasSupply === false && facts.appliances?.length === 0)
      return { requirement: 'NotApplicable', reason: 'NoGasNoCombustion' };
    if (facts.hasGasSupply === true || (facts.appliances?.length ?? 0) > 0) return { requirement: 'Required', reason: null };
    return { requirement: 'Undetermined', reason: null };
  }
  if (code === 'SystemsCompliance') {
    if (facts.entrepreneurial === false) return { requirement: 'NotApplicable', reason: 'NotEntrepreneurial' };
    return { requirement: facts.entrepreneurial === true ? 'Required' : 'Undetermined', reason: null };
  }
  return { requirement: 'Required', reason: null };
}
