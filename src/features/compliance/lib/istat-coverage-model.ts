import { isHttpsAddress } from '@/lib/onboarding-panel';
import type { PropertyIstatCoverage } from '@/types/istat.types';

/**
 * What the notice of the ISTAT coverage says about the channel manager (E21/F01/US02/T01, NF-44, NF-52, CHK-05 point 3): it sends the regional ISTAT communication of the region,
 * it does not, or it is «da verificare». Only a row the staff verified gives the first two: everything else is the third, and it is never shown as a yes.
 */
export type CoverageShown = 'covered' | 'notCovered' | 'toVerify';

type CoverageFields = Pick<PropertyIstatCoverage, 'regionKnown' | 'coverage' | 'nextStep' | 'verifiedAt'>;

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

/** What the notice shows: the coverage of the region, or that the ISTAT of the property does not go through the channel manager at all. */
export type NoticeShown = CoverageShown | 'otherSender';

/**
 * What the notice says (`coverageShown`), unless the ISTAT of the property is not sent by the channel manager (the host sends it, or CasaZen is the sender): then it says that it does not go
 * through the channel manager, and never «lo invia il tuo channel manager» of a property whose sending does not pass through it. `senderOpen` is the first step of the wizard, where the sender
 * is still to be chosen: there the notice tells what the channel manager does in the region, whoever sends today. A sender this version does not know is «da verificare».
 */
export function noticeShown(coverage: CoverageFields & Pick<PropertyIstatCoverage, 'istatSender'>, senderOpen = false): NoticeShown {
  if (senderOpen || coverage.istatSender === 'ChannelManager') return coverageShown(coverage);
  if (coverage.istatSender === 'Manual' || coverage.istatSender === 'CasaZen') return 'otherSender';
  return 'toVerify';
}

/**
 * Whether the fixed sentences of the screens (the sender «si occupa anche dell'ISTAT», the green point of the end of the wizard, the row «Attivo» of the panel of the property) may say that the
 * ISTAT is taken care of: only when the table says the channel manager sends it (`coverageShown` is «covered»), and, where the sender in force is what the sentence is about
 * (`channelManagerSends`), only when that sender is the channel manager. A property outside Italy has no regional flow to say anything of.
 */
export function istatTakenCareOf(coverage: CoverageFields & Pick<PropertyIstatCoverage, 'applies' | 'istatSender'>, channelManagerSends = false): boolean {
  if (coverage.applies !== true || coverageShown(coverage) !== 'covered') return false;
  return !channelManagerSends || coverage.istatSender === 'ChannelManager';
}

export type RegionShown = { kind: 'named'; region: string; system: string } | { kind: 'noSystem'; region: string } | { kind: 'unknown' };

const textOf = (value: string | null | undefined): string => (typeof value === 'string' ? value.trim() : '');

export function regionShown(coverage: Pick<PropertyIstatCoverage, 'regionKnown' | 'regionName' | 'system'>): RegionShown {
  const region = textOf(coverage.regionName);
  if (coverage.regionKnown !== true || region === '') return { kind: 'unknown' };
  const system = textOf(coverage.system);
  return system === '' ? { kind: 'noSystem', region } : { kind: 'named', region, system };
}

export type DeadlineShown = { kind: 'monthly'; day: number } | { kind: 'daily' } | { kind: 'toVerify' };

export function deadlineShown(coverage: Pick<PropertyIstatCoverage, 'deadlineKind' | 'deadlineDay'>): DeadlineShown {
  const day = coverage.deadlineDay;
  if (coverage.deadlineKind === 'Monthly' && typeof day === 'number' && Number.isInteger(day) && day >= 1 && day <= 31) return { kind: 'monthly', day };
  if (coverage.deadlineKind === 'Daily') return { kind: 'daily' };
  return { kind: 'toVerify' };
}

export type NoticeAction = 'panelStep' | 'portalGuide' | 'support' | 'none';

export function portalAddress(coverage: Pick<PropertyIstatCoverage, 'portalUrl'>): string | null {
  return isHttpsAddress(coverage.portalUrl) ? coverage.portalUrl : null;
}

/**
 * What the host does next, one action for each case: connect the ISTAT in the panel where the channel manager covers the region, the guide of the regional portal where it does not (with
 * the address the staff configured), and the request to support for everything that is not verified. A region the channel manager does not cover whose portal has no address in the
 * table has no guide to open: the host is led to support, never to an address nobody gave. Where the sending does not go through the channel manager the guide of the portal is the only
 * action (the request to support is about linking the channel manager).
 */
export function noticeActionOf(shown: NoticeShown, coverage: Pick<PropertyIstatCoverage, 'portalUrl'>): NoticeAction {
  if (shown === 'covered') return 'panelStep';
  if (shown === 'otherSender') return portalAddress(coverage) !== null ? 'portalGuide' : 'none';
  if (shown === 'notCovered' && portalAddress(coverage) !== null) return 'portalGuide';
  return 'support';
}
