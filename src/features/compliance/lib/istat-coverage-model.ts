import { isHttpsAddress } from '@/lib/onboarding-panel';
import type { PropertyIstatCoverage } from '@/types/istat.types';

/**
 * What the notice of the ISTAT coverage says about the channel manager (E21/F01/US02/T01, NF-44, NF-52, CHK-05 point 3): it sends the regional ISTAT communication of the region,
 * it does not, or it is «da verificare». Only a row the staff verified gives the first two: everything else is the third, and it is never shown as a yes.
 */
export type CoverageShown = 'covered' | 'notCovered' | 'toVerify';

type CoverageFields = Pick<PropertyIstatCoverage, 'regionKnown' | 'coverage' | 'nextStep' | 'verifiedAt'>;

/** A row the staff checked against its source: the territory is known and the answer holds the day it was checked. */
export function isVerified(coverage: Pick<PropertyIstatCoverage, 'regionKnown' | 'verifiedAt'>): boolean {
  return coverage.regionKnown === true && typeof coverage.verifiedAt === 'string' && coverage.verifiedAt !== '';
}

/**
 * «Covered» or «not covered» only when the server says so, the row is verified and the next step it gives is the one that goes with the word (`ConnectInPanel` for a region the channel
 * manager covers, `ManualPortal` for one it does not). Any other combination, a word this version does not know, a missing value, a row without its verification date or a territory
 * the table does not know is «da verificare»: a state that is not checked is never shown as a state that is.
 */
export function coverageShown(coverage: CoverageFields): CoverageShown {
  if (!isVerified(coverage)) return 'toVerify';
  if (coverage.coverage === 'Covered' && coverage.nextStep === 'ConnectInPanel') return 'covered';
  if (coverage.coverage === 'NotCovered' && coverage.nextStep === 'ManualPortal') return 'notCovered';
  return 'toVerify';
}

/** How the notice names the region and the portal of its system: the system is never guessed, so a region without one says so. */
export type RegionShown = { kind: 'named'; region: string; system: string } | { kind: 'noSystem'; region: string } | { kind: 'unknown' };

const textOf = (value: string | null | undefined): string => (typeof value === 'string' ? value.trim() : '');

export function regionShown(coverage: Pick<PropertyIstatCoverage, 'regionKnown' | 'regionName' | 'system'>): RegionShown {
  const region = textOf(coverage.regionName);
  if (coverage.regionKnown !== true || region === '') return { kind: 'unknown' };
  const system = textOf(coverage.system);
  return system === '' ? { kind: 'noSystem', region } : { kind: 'named', region, system };
}

/** The deadline in plain words: a day of the following month, every day, or «da verificare». A monthly deadline without a day of the month is not a deadline: it is never guessed. */
export type DeadlineShown = { kind: 'monthly'; day: number } | { kind: 'daily' } | { kind: 'toVerify' };

export function deadlineShown(coverage: Pick<PropertyIstatCoverage, 'deadlineKind' | 'deadlineDay'>): DeadlineShown {
  const day = coverage.deadlineDay;
  if (coverage.deadlineKind === 'Monthly' && typeof day === 'number' && Number.isInteger(day) && day >= 1 && day <= 31) return { kind: 'monthly', day };
  if (coverage.deadlineKind === 'Daily') return { kind: 'daily' };
  return { kind: 'toVerify' };
}

/** The one action of the notice: the guided step of the panel, the portal of the region, or the request to support. */
export type NoticeAction = 'panelStep' | 'portalGuide' | 'support';

/** The address of the portal of the region as the notice may link it: https only, whatever the answer says (a value of the table is data, never a link to trust). */
export function portalAddress(coverage: Pick<PropertyIstatCoverage, 'portalUrl'>): string | null {
  return isHttpsAddress(coverage.portalUrl) ? coverage.portalUrl : null;
}

/**
 * What the host does next, one action for each case: connect the ISTAT in the panel where the channel manager covers the region, the guide of the regional portal where it does not (with
 * the address the staff configured), and the request to support for everything that is not verified. A region the channel manager does not cover whose portal has no address in the
 * table has no guide to open: the host is led to support, never to an address nobody gave.
 */
export function noticeActionOf(shown: CoverageShown, coverage: Pick<PropertyIstatCoverage, 'portalUrl'>): NoticeAction {
  if (shown === 'covered') return 'panelStep';
  if (shown === 'notCovered' && portalAddress(coverage) !== null) return 'portalGuide';
  return 'support';
}
