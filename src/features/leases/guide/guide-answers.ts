import type { CedolareAdvisory, LeaseConcordatoAssessment } from '@/types';

/**
 * What the tax advisory of the lease (LT-08) comes to, in one sentence's worth: which regime costs less in the first year and by how
 * much. No new computation: it is the difference of two figures the server already computed. The comparison is only made when the
 * server could compute the IRPEF too (it needs the landlord's other income); until then the honest answer is that it cannot be said.
 */
export type RegimeOutcome =
  | { kind: 'cedolareCheaper'; amount: number; withoutBollo: boolean }
  | { kind: 'ordinaryCheaper'; amount: number; withoutBollo: boolean }
  | { kind: 'equal' }
  /** The IRPEF needs the income of the landlord: asked in «Affina la stima». */
  | { kind: 'incomeNeeded' }
  /** The server could not compute the IRPEF (brackets outdated, income over the limit…): its reason code, as the panel has always told it. */
  | { kind: 'notComputed'; reasonCode: string | null; year: number | null };

/** Two figures this close are the same cost for whoever reads them. */
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

/** Where a monthly rent stands against the range of the agreement. */
export type RentPlace = 'within' | 'above' | 'below';

/** Half a cent: the range of the server is rounded to the cent, the rent is typed in cents. */
const CENT_TOLERANCE = 0.005;

export function rentPlace(rent: number, min: number, max: number): RentPlace {
  if (rent > max + CENT_TOLERANCE) return 'above';
  if (rent < min - CENT_TOLERANCE) return 'below';
  return 'within';
}

/** The answer the lease already holds: the range computed when it was created, against its rent. */
export interface StoredRentAnswer {
  place: RentPlace;
  min: number;
  max: number;
  /** The data of the agreement are not confirmed: the range is a guide. */
  indicative: boolean;
}

/**
 * Where the rent of a canone concordato lease stands against the range the server computed at its creation (`concordatoAssessment`,
 * A7-12), without asking again. `null` when the lease has no such range or no rent. The word of the server (`rentWithinRange`) wins over
 * a rounding of the cent.
 */
export function storedRentAnswer(assessment: LeaseConcordatoAssessment | null, rent: number): StoredRentAnswer | null {
  if (!assessment || !(rent > 0)) return null;
  const min = assessment.canoneMinMensile;
  const max = assessment.canoneMaxMensile;
  let place = rentPlace(rent, min, max);
  if (assessment.rentWithinRange) place = 'within';
  else if (place === 'within') place = rent >= max ? 'above' : 'below';
  return { place, min, max, indicative: assessment.indicative };
}
