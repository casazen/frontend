import type {
  PublicCancellationPolicy,
  PublicFloorPlanLevel,
  PublicLocalizedText,
  PublicPointOfInterest,
  PublicPropertyDetailDto,
} from '@/types';

/**
 * Small pure helpers of the property page of the booking site (DB-04a): which language a text of the host is shown in, how the hours
 * of a cancellation policy are said, and the shape of the floor and of the times. No React here, no network, nothing to mock.
 */

/** The language of the visitor is English (`en`, `en-GB`...); anything else reads the Italian texts of the host. */
function wantsEnglish(language: string | undefined): boolean {
  return language?.toLowerCase().startsWith('en') ?? false;
}

/**
 * A text of the host in the language of the visitor, else in Italian (nothing is translated for them, DB-D8). A plain string is a
 * text the server already chose a language for. Empty text, `null` and `undefined` give an empty string, so a caller tests the result.
 */
export function pickText(text: PublicLocalizedText | string | null | undefined, language: string | undefined): string {
  if (!text) return '';
  if (typeof text === 'string') return text.trim();
  const english = wantsEnglish(language) ? (text.en ?? '').trim() : '';
  return english || (text.it ?? '').trim();
}

/** True when the visitor reads English and this text is only in Italian: the page says it once, it does not translate. */
export function isItalianFallback(text: PublicLocalizedText | string | null | undefined, language: string | undefined): boolean {
  if (!text || typeof text === 'string') return false;
  return wantsEnglish(language) && !(text.en ?? '').trim() && Boolean((text.it ?? '').trim());
}

/** How long before the check-in a window of the cancellation policy ends: whole days when the hours are, else hours. */
export interface PolicyWindow {
  unit: 'day' | 'hour';
  count: number;
}

export function policyWindow(hours: number): PolicyWindow {
  const safe = Math.max(0, Math.round(hours));
  return safe >= 24 && safe % 24 === 0 ? { unit: 'day', count: safe / 24 } : { unit: 'hour', count: safe };
}

/** What a policy gives back, as the stages a page lists: the full refund, the share, nothing. A stage the policy does not have is left out. */
export interface PolicyStages {
  full: PolicyWindow | null;
  partial: { window: PolicyWindow; percent: number } | null;
}

export function policyStages(policy: PublicCancellationPolicy): PolicyStages {
  const full = policy.fullRefundHours !== null ? policyWindow(policy.fullRefundHours) : null;
  const partial =
    policy.partialRefundHours !== null && policy.partialRefundPercent !== null && policy.partialRefundPercent > 0
      ? { window: policyWindow(policy.partialRefundHours), percent: Math.round(policy.partialRefundPercent * 100) / 100 }
      : null;
  return { full, partial };
}

/** The floor of a house as two parts (a value and a noun): `0` is the ground floor, below it is below ground. */
export type FloorKind = 'ground' | 'upper' | 'below';

export function floorKind(level: number): FloorKind {
  if (level === 0) return 'ground';
  return level > 0 ? 'upper' : 'below';
}

/** `HH:mm` of a time that may come with seconds (`15:00:00`); empty when it is not a time. */
export function shortTime(value: string | null | undefined): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec((value ?? '').trim());
  return match ? `${match[1]}:${match[2]}` : '';
}

/** A positive finite number, or null: a missing or malformed number is left out, never shown as "NaN" or "0". */
export function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** Whether the host gave the house anything to say in «Da sapere»: the page puts the section in the bar only then. */
export function propertyHasRules(property: PublicPropertyDetailDto): boolean {
  const filled = (text: unknown) => (typeof text === 'string' ? text.trim() !== '' : Boolean(text));
  return (
    [
      property.checkInFrom,
      property.checkInTo,
      property.checkOutBy,
      property.checkInMethod,
      property.petsPolicy,
      property.smokingPolicy,
      property.partiesPolicy,
      property.houseRules,
      property.rulesNote,
      property.cancellationPolicy,
      property.cancellationPolicySummary,
    ].some(filled) ||
    Boolean(property.quietHoursFrom && property.quietHoursTo) ||
    typeof property.childrenWelcome === 'boolean' ||
    (property.safetyNotes ?? []).length > 0
  );
}

/** A distance in metres the way a person says it: «400 m», «1,2 km». */
export function formatDistance(meters: number, language: string | undefined): string {
  if (!Number.isFinite(meters) || meters < 0) return '';
  if (meters < 1000) return `${meters >= 100 ? Math.round(meters / 10) * 10 : Math.round(meters)} m`;
  return `${new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(meters / 1000)} km`;
}

/** The points of interest the page can list: a name, a way to get there and a time. Anything else is left out. */
export function usablePoints(property: Pick<PublicPropertyDetailDto, 'pointsOfInterest'>): PublicPointOfInterest[] {
  return (property.pointsOfInterest ?? []).filter(
    (poi) =>
      Boolean(poi?.id) &&
      (poi.mode === 'walk' || poi.mode === 'car') &&
      Number.isFinite(poi.minutes) &&
      poi.minutes >= 0 &&
      Number.isFinite(poi.bearingDeg) &&
      Number.isFinite(poi.distanceM),
  );
}

/** The levels of the floor plan that have an image to show. */
export function usableLevels(property: Pick<PublicPropertyDetailDto, 'floorPlan'>): PublicFloorPlanLevel[] {
  return (property.floorPlan?.levels ?? []).filter((level) => Boolean(level?.id) && typeof level.imageUrl === 'string' && level.imageUrl.trim() !== '');
}

/** Whether the page has a «Zona» to show: the host said where the house is or what is near, or gave places with their times. */
export function propertyHasZone(property: PublicPropertyDetailDto): boolean {
  return Boolean(property.zone) || Boolean(property.near) || usablePoints(property).length > 0;
}
