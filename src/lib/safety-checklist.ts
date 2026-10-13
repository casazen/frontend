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

/** Same input limit as the backend (`SafetyChecklistRules.MaxFloors`). */
export const MAX_FLOORS = 20;

/** Recommended items, not required by art. 13-ter: they never block. */
export const OPTIONAL_SAFETY_ITEMS: readonly SafetyItemCode[] = ['SmokeDetector', 'EmergencyInstructions'];

/** Detectors: they collect a device type and the end of life of the sensor. */
export const SAFETY_DETECTORS: readonly SafetyItemCode[] = ['GasDetector', 'CoDetector', 'SmokeDetector'];

/**
 * Minimum number of extinguishers (prudent proposal of RS-3): `max(1, ceil(m² / 200))` on each floor of the unit,
 * summed; one per floor when the areas are not all given. Null without the number of floors.
 */
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
  /** null = not answered, [] = no combustion appliance. */
  appliances: CombustionAppliance[] | null;
}

/**
 * How an item applies to the unit: gas and CO detectors are "not applicable" only with no gas system and no combustion
 * appliance (both conditions); the compliant systems only when the rental is not run as a business.
 */
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
