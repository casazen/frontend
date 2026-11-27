import type { CedolareAdvisory, LeaseConcordatoAssessment } from '@/types';

export type RegimeOutcome =
  | { kind: 'cedolareCheaper'; amount: number; withoutBollo: boolean }
  | { kind: 'ordinaryCheaper'; amount: number; withoutBollo: boolean }
  | { kind: 'equal' }
  | { kind: 'incomeNeeded' }
  | { kind: 'notComputed'; reasonCode: string | null; year: number | null };

const SAME_COST_EUR = 1;

export function regimeOutcome(advisory: CedolareAdvisory): RegimeOutcome {
  const { cedolare, ordinary } = advisory;
  const { irpef, registro, bollo } = ordinary;

  if (irpef.status === 'InputRequired') return { kind: 'incomeNeeded' };
  if (irpef.status !== 'Computed' || irpef.additionalGrossIrpefEur === null) {
    return { kind: 'notComputed', reasonCode: irpef.reasonCode, year: irpef.taxYear };
  }

  const withoutBollo = bollo.amountEur === null;
  const ordinaryYearOne = registro.firstYearEur + (bollo.amountEur ?? 0) + irpef.additionalGrossIrpefEur;
  const difference = ordinaryYearOne - cedolare.annualTaxEur;
  if (Math.abs(difference) < SAME_COST_EUR) return { kind: 'equal' };
  return difference > 0
    ? { kind: 'cedolareCheaper', amount: difference, withoutBollo }
    : { kind: 'ordinaryCheaper', amount: -difference, withoutBollo };
}

export type RentPlace = 'within' | 'above' | 'below';

const CENT_TOLERANCE = 0.005;

export function rentPlace(rent: number, min: number, max: number): RentPlace {
  if (rent > max + CENT_TOLERANCE) return 'above';
  if (rent < min - CENT_TOLERANCE) return 'below';
  return 'within';
}

export interface StoredRentAnswer {
  place: RentPlace;
  min: number;
  max: number;
  indicative: boolean;
}

export function storedRentAnswer(assessment: LeaseConcordatoAssessment | null, rent: number): StoredRentAnswer | null {
  if (!assessment || !(rent > 0)) return null;
  const min = assessment.canoneMinMensile;
  const max = assessment.canoneMaxMensile;
  let place = rentPlace(rent, min, max);
  if (assessment.rentWithinRange) place = 'within';
  else if (place === 'within') place = rent >= max ? 'above' : 'below';
  return { place, min, max, indicative: assessment.indicative };
}
