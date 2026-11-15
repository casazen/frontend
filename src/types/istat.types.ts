import type { ComplianceSenderType } from './checkin-wizard.types';

/**
 * The ISTAT region table and the coverage of a property (backend `IstatRegionDtos`, E21/F01/US01/T01, decision O6, NF-44, NF-52). The enums are written as their member names.
 * A value the staff has not verified is `Unknown` («da verificare») or `null`: it is never read as a yes.
 */

/** Whether the channel manager sends the regional ISTAT communication of a region. `Unknown` is the default of every row until the staff verifies it. */
export type IstatCoverage = 'Unknown' | 'Covered' | 'NotCovered';

export const ISTAT_COVERAGES: readonly IstatCoverage[] = ['Unknown', 'Covered', 'NotCovered'];

/** How often the portal of a region wants the movement. Only `Monthly` carries a day (of the following month). */
export type IstatDeadlineKind = 'Unknown' | 'Daily' | 'Monthly';

export const ISTAT_DEADLINE_KINDS: readonly IstatDeadlineKind[] = ['Unknown', 'Daily', 'Monthly'];

/** What the host does next, as the server works it out from the coverage. */
export type IstatNextStep = 'ConnectInPanel' | 'ManualPortal' | 'AskSupport';

/** The statistical fields of the guest a region can require: the three of the lists of the backend. */
export const ISTAT_GUEST_FIELDS = ['TourismType', 'TravelWay', 'EducationLevel'] as const;
export type IstatGuestField = (typeof ISTAT_GUEST_FIELDS)[number];

/**
 * One row of the table as the platform staff reads it (`GET /admin/istat-regions`). A region has a row of its own; Trentino-Alto Adige has the rows of its two autonomous provinces
 * (`provinceCode` `BZ` and `TN`). `requiredGuestFields`: `null` = not verified (no field is asked), a list, possibly empty, once it is. `octorateCoverage` is the name of the field on the wire.
 */
export interface IstatRegionRule {
  id: string;
  regionIstatCode: string;
  provinceCode: string | null;
  regionName: string;
  system: string | null;
  portalUrl: string | null;
  deadlineKind: IstatDeadlineKind;
  deadlineDay: number | null;
  requiredGuestFields: string[] | null;
  octorateCoverage: IstatCoverage;
  sourceUrl: string;
  verifiedAt: string | null;
  notes: string | null;
  updatedAt: string;
}

/**
 * What the staff saves for a territory (`PUT /admin/istat-regions`): the territory names the row and the rest REPLACES what it holds, so every value is sent every time (a field left
 * out would erase it). `sourceUrl` is required and https; `verifiedAt` is the day the row was checked against it (an instant, UTC).
 */
export interface SaveIstatRegionRequest {
  regionIstatCode: string;
  provinceCode: string | null;
  system: string | null;
  portalUrl: string | null;
  deadlineKind: IstatDeadlineKind;
  deadlineDay: number | null;
  requiredGuestFields: IstatGuestField[] | null;
  octorateCoverage: IstatCoverage;
  sourceUrl: string;
  verifiedAt: string;
  notes: string | null;
}

/**
 * The ISTAT communication of a property as the table says it (`GET /properties/{id}/istat-coverage`, behind the flag `octorateOnboarding`). `applies` is false outside Italy (no region, no
 * next step). `coverage` is `Covered` only for a row the staff verified, and `nextStep` follows it. No personal data, no secret.
 */
export interface PropertyIstatCoverage {
  propertyId: string;
  applies: boolean;
  regionKnown: boolean;
  regionIstatCode: string | null;
  provinceCode: string | null;
  regionName: string | null;
  system: string | null;
  portalUrl: string | null;
  deadlineKind: IstatDeadlineKind;
  deadlineDay: number | null;
  requiredGuestFields: string[];
  requiredGuestFieldsKnown: boolean;
  coverage: IstatCoverage;
  istatSender: ComplianceSenderType;
  nextStep: IstatNextStep | null;
  assistContext: string | null;
  sourceUrl: string | null;
  verifiedAt: string | null;
}
