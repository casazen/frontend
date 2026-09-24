/**
 * Backend feature flags (`Features:<Name>`), read from `GET /api/public/features` as camelCase keys.
 * Adding a flag: backend `FeatureFlags` + here (key and default), see backend `docs/runbooks/feature-flags.md`.
 */
export type FeatureFlagKey = 'otaPartnerApi';

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

/** Used while the flags load and when they cannot be read: every flag off (fail closed). */
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  /** D10: Airbnb / Booking.com partner API in freeze. iCal is not behind this flag. */
  otaPartnerApi: false,
};

/** Known flags from the API response; anything but `true` is off. */
export function parseFeatureFlags(data: unknown): FeatureFlags {
  const source = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  const flags = { ...DEFAULT_FEATURE_FLAGS };
  for (const key of Object.keys(DEFAULT_FEATURE_FLAGS) as FeatureFlagKey[]) {
    flags[key] = source[key] === true;
  }
  return flags;
}

/** A missing flag set (no provider, not loaded) means off. */
export function isFeatureEnabled(flags: Partial<FeatureFlags> | undefined, key: FeatureFlagKey): boolean {
  return flags?.[key] === true;
}
