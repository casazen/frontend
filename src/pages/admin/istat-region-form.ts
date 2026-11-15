import { isHttpsAddress } from '@/lib/onboarding-panel';
import {
  ISTAT_GUEST_FIELDS,
  type IstatCoverage,
  type IstatDeadlineKind,
  type IstatGuestField,
  type IstatRegionRule,
  type SaveIstatRegionRequest,
} from '@/types/istat.types';

/** The longest values the table holds (`IstatRegionRule` of the backend): the form stops the staff before the server would. */
export const ISTAT_REGION_LIMITS = { system: 200, url: 500, notes: 1000 } as const;

/** What the staff says about the statistical fields of the guest: not verified (no field is asked), verified and none required, or the ones listed. «All» is not an answer. */
export type FieldsMode = 'toVerify' | 'none' | 'some';

/** The values of the form of one territory, as the fields hold them (text for what is typed). */
export interface RegionFormValues {
  system: string;
  portalUrl: string;
  deadlineKind: IstatDeadlineKind;
  deadlineDay: string;
  fieldsMode: FieldsMode;
  fields: IstatGuestField[];
  coverage: IstatCoverage;
  sourceUrl: string;
  /** The day the staff checked the row against its source (`YYYY-MM-DD`). */
  verifiedAt: string;
  notes: string;
}

/** What is wrong in a field: the key of the text that says it (`istatRegions.errors.*`). */
export type RegionFormErrors = Partial<Record<'portalUrl' | 'deadlineDay' | 'fields' | 'sourceUrl' | 'verifiedAt', string>>;

const isKnownField = (name: string): name is IstatGuestField => (ISTAT_GUEST_FIELDS as readonly string[]).includes(name);

/** The name of a territory as the table shows it: the region, or the autonomous province with its plate code. */
export const territoryName = (rule: Pick<IstatRegionRule, 'regionName' | 'provinceCode'>): string =>
  rule.provinceCode ? `${rule.regionName} (${rule.provinceCode})` : rule.regionName;

/**
 * The form of a row: what the row holds, and today as the day of the check (saving a row says the person read it against its source today; the day can be changed, never into the
 * future). The source starts as the row has it, so a save that does not touch it keeps it.
 */
export function formOf(rule: IstatRegionRule, today: string): RegionFormValues {
  const listed = (rule.requiredGuestFields ?? []).filter(isKnownField);
  return {
    system: rule.system ?? '',
    portalUrl: rule.portalUrl ?? '',
    deadlineKind: rule.deadlineKind,
    deadlineDay: rule.deadlineDay === null ? '' : String(rule.deadlineDay),
    fieldsMode: rule.requiredGuestFields === null ? 'toVerify' : listed.length === 0 ? 'none' : 'some',
    fields: listed,
    coverage: rule.octorateCoverage,
    sourceUrl: rule.sourceUrl,
    verifiedAt: today,
    notes: rule.notes ?? '',
  };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The mistakes of the form: a source that is not an https address (the server refuses it too), a monthly deadline without a day, a list of fields that is empty, a day of the check in the future. */
export function validateRegionForm(values: RegionFormValues, today: string): RegionFormErrors {
  const errors: RegionFormErrors = {};
  const source = values.sourceUrl.trim();
  if (source === '') errors.sourceUrl = 'istatRegions.errors.sourceRequired';
  else if (!isHttpsAddress(source)) errors.sourceUrl = 'istatRegions.errors.sourceHttps';

  const portal = values.portalUrl.trim();
  if (portal !== '' && !isHttpsAddress(portal)) errors.portalUrl = 'istatRegions.errors.portalHttps';

  if (values.deadlineKind === 'Monthly') {
    const day = Number(values.deadlineDay);
    if (values.deadlineDay.trim() === '' || !Number.isInteger(day) || day < 1 || day > 31) errors.deadlineDay = 'istatRegions.errors.dayInvalid';
  }

  if (values.fieldsMode === 'some' && values.fields.length === 0) errors.fields = 'istatRegions.errors.fieldsNeeded';

  if (!DAY.test(values.verifiedAt) || values.verifiedAt > today) errors.verifiedAt = 'istatRegions.errors.verifiedAtInvalid';

  return errors;
}

const orNull = (value: string): string | null => (value.trim() === '' ? null : value.trim());

/**
 * The request that saves the row: the territory names it and every other value is sent every time, because a save REPLACES the row (a value left out would be erased). A deadline that is
 * not monthly has no day; the fields go in the order of the lists; the day of the check is sent as the start of that day, UTC.
 */
export function requestOf(rule: Pick<IstatRegionRule, 'regionIstatCode' | 'provinceCode'>, values: RegionFormValues): SaveIstatRegionRequest {
  const fields = ISTAT_GUEST_FIELDS.filter((name) => values.fields.includes(name));
  return {
    regionIstatCode: rule.regionIstatCode,
    provinceCode: rule.provinceCode,
    system: orNull(values.system),
    portalUrl: orNull(values.portalUrl),
    deadlineKind: values.deadlineKind,
    deadlineDay: values.deadlineKind === 'Monthly' ? Number(values.deadlineDay) : null,
    requiredGuestFields: values.fieldsMode === 'toVerify' ? null : values.fieldsMode === 'none' ? [] : fields,
    octorateCoverage: values.coverage,
    sourceUrl: values.sourceUrl.trim(),
    verifiedAt: `${values.verifiedAt}T00:00:00.000Z`,
    notes: orNull(values.notes),
  };
}
