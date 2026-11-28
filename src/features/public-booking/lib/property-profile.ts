import type {
  PublicCancellationPolicy,
  PublicFloorPlanLevel,
  PublicLocalizedText,
  PublicPointOfInterest,
  PublicPropertyDetailDto,
} from '@/types';

function wantsEnglish(language: string | undefined): boolean {
  return language?.toLowerCase().startsWith('en') ?? false;
}

export function pickText(text: PublicLocalizedText | string | null | undefined, language: string | undefined): string {
  if (!text) return '';
  if (typeof text === 'string') return text.trim();
  const english = wantsEnglish(language) ? (text.en ?? '').trim() : '';
  return english || (text.it ?? '').trim();
}

export function isItalianFallback(text: PublicLocalizedText | string | null | undefined, language: string | undefined): boolean {
  if (!text || typeof text === 'string') return false;
  return wantsEnglish(language) && !(text.en ?? '').trim() && Boolean((text.it ?? '').trim());
}

export interface PolicyWindow {
  unit: 'day' | 'hour';
  count: number;
}

export function policyWindow(hours: number): PolicyWindow {
  const safe = Math.max(0, Math.round(hours));
  return safe >= 24 && safe % 24 === 0 ? { unit: 'day', count: safe / 24 } : { unit: 'hour', count: safe };
}

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

export type FloorKind = 'ground' | 'upper' | 'below';

export function floorKind(level: number): FloorKind {
  if (level === 0) return 'ground';
  return level > 0 ? 'upper' : 'below';
}

export function shortTime(value: string | null | undefined): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec((value ?? '').trim());
  return match ? `${match[1]}:${match[2]}` : '';
}

export function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

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

export function formatDistance(meters: number, language: string | undefined): string {
  if (!Number.isFinite(meters) || meters < 0) return '';
  if (meters < 1000) return `${meters >= 100 ? Math.round(meters / 10) * 10 : Math.round(meters)} m`;
  return `${new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(meters / 1000)} km`;
}

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

export function usableLevels(property: Pick<PublicPropertyDetailDto, 'floorPlan'>): PublicFloorPlanLevel[] {
  return (property.floorPlan?.levels ?? []).filter((level) => Boolean(level?.id) && typeof level.imageUrl === 'string' && level.imageUrl.trim() !== '');
}

export function propertyHasZone(property: PublicPropertyDetailDto): boolean {
  return Boolean(property.zone) || Boolean(property.near) || usablePoints(property).length > 0;
}
