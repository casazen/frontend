/**
 * Backend feature flags (`Features:<Name>`), read from `GET /api/public/features` as camelCase keys.
 * Adding a flag: backend `FeatureFlags` + here (key and default), see backend `docs/runbooks/feature-flags.md`.
 */
export type FeatureFlagKey = 'otaPartnerApi' | 'aiSupplierDiscovery' | 'rliProvider' | 'eSignProvider' | 'supplierOnlinePayments' | 'concordatoFacile';

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

/** Used while the flags load and when they cannot be read: every flag off (fail closed). */
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  /** D10: Airbnb / Booking.com partner API in freeze. iCal is not behind this flag. */
  otaPartnerApi: false,
  /**
   * D11: AI supplier discovery in freeze (backend `match-supplier` 404 while off). No UI reads it today: the web AI
   * match flow was unreachable and has been removed (FD-21); gate any new AI supplier UI on this flag.
   */
  aiSupplierDiscovery: false,
  /**
   * LT-01 / D15: RLI filing through a provider, off. The lease page does not read it: it offers the provider only when
   * the RLI checklist says `providerFilingAvailable` (flag on and a configured provider); otherwise manual registration.
   */
  rliProvider: false,
  /**
   * LT-02 / D15: contract signature through an e-signature provider, off (no provider client exists yet). The lease page
   * does not read it: it offers the provider only when `GET /leases/:id/signers` says `providerSigningAvailable` (flag on
   * and a configured provider); otherwise the contract is signed offline (download, sign, upload with the stipula date).
   */
  eSignProvider: false,
  /**
   * SP-02 / D2: payment of a supplier's work inside CasaZen (backend `SupplierOnlinePayments`), off until the product owner turns it on.
   * The page of the earnings ("Incassi", SP-16b) is behind it: its entry is in no menu and its route goes to the home of the area while
   * it is off. The payments account (SP-16c-b) does not read it: it asks the server, whose endpoints answer 404 while the flag is off.
   */
  supplierOnlinePayments: false,
  /**
   * ConcordatoFacile, the partner that prepares a canone concordato contract (backend `ConcordatoFacile`): on in the test environment,
   * off in production until CasaZen confirms the trial run and the privacy framework to ConcordatoFacile. While it is off the card
   * «Parto da zero» of a new canone concordato is disabled («disponibile a breve») and its address shows the question again; «Ho già il
   * contratto e i documenti» does not depend on it. It also sends the page of payment `/app/long-rent/leases/:id/guided-contract` (and
   * its old address `/concordatofacile`) back to the contract (CF-FIX), leaves the block of a draft made for the partner on the sheet of
   * the contract with its button off and the line «not available yet» (CF-FLOW), and makes the upload page opened from the partner's
   * button (`?practice=`) fall back to choosing the contract (the backend answers 404 to the lookup).
   */
  concordatoFacile: false,
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
