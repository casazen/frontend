/**
 * Backend feature flags (`Features:<Name>`), read from `GET /api/public/features` as camelCase keys.
 * Adding a flag: backend `FeatureFlags` + here (key and default), see backend `docs/runbooks/feature-flags.md`.
 */
export type FeatureFlagKey =
  | 'otaPartnerApi'
  | 'octorateConnector'
  | 'octorateOnboarding'
  | 'aiSupplierDiscovery'
  | 'rliProvider'
  | 'eSignProvider'
  | 'supplierOnlinePayments'
  | 'supplierShowcaseBooking'
  | 'concordatoFacile'
  | 'supplierRequestBackups'
  | 'agencyTier'
  | 'crmMarketing'
  | 'complianceTrafficLight'
  | 'messageAssistant';

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

/** Used while the flags load and when they cannot be read: every flag off (fail closed). */
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  /** D10: Airbnb / Booking.com partner API in freeze. iCal is not behind this flag. */
  otaPartnerApi: false,
  /**
   * The channel manager connector (backend `OctorateConnector`, ADR-023, E02/F01), off until the sandbox is validated: on in the test
   * environment only once the callback page is registered with the channel manager, unset in production. While it is off the wizard
   * «Collega i tuoi canali» (`/app/short-rent/integrations/octorate`) does not exist: its address leads to the home of the area, and the
   * backend answers 404 to every endpoint it reads.
   */
  octorateConnector: false,
  /**
   * The activation of CasaZen with Octorate (backend `OctorateOnboarding`, epic E10), off until the product owner turns it on: the plan
   * «Inizia con CasaZen» of eleven parts, the connected path on the home and the next step offered at the end of a wizard, the status
   * of the six flows and the bulk configuration of an agency. While it is off the plan page (`/app/short-rent/onboarding`) does not
   * exist (its address leads to the home of the area), the home and the wizards show nothing of the path, and the backend answers 404 to
   * every endpoint of the epic but the checklist of the activation.
   */
  octorateOnboarding: false,
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
   * SP-09 to SP-12b: booking from the public site of a supplier (backend `SupplierShowcaseBooking`), off until the product owner turns it on.
   * The pages of the booking (`/prenota`), of the check of the e-mail (`/conferma`) and of the customer's own request (`/richiesta`) are
   * behind it: while it is off their addresses lead back to the home of the site.
   */
  supplierShowcaseBooking: false,
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
  /**
   * SP-BKP: a host's request goes to the supplier it chose and, at the same moment, to up to three backup suppliers (backend
   * `SupplierRequestBackups`): off until the product owner turns it on in the test environment. It only decides whether the host is offered
   * the choice (the switch of «Interventi» in the settings and the one of the request); a group that exists is always shown, whatever the
   * flag says, because the server follows it to its end.
   */
  supplierRequestBackups: false,
  /**
   * The agency plan (backend `AgencyTier`, ADR-010): owners' statements, wire transfers to the owners, withholding tax, internal staff
   * activities and trusted suppliers. Off until the product owner turns it on, and even then the backend answers only an org on the
   * Agency plan whose role holds the agency permission. While it is off the pages that read those endpoints («Ritenute d'acconto» and
   * «Bonifici proprietari» of the administration, «Fornitori fidati» of short rents, «Rendiconti» and «Attività» of the staff console)
   * are in no menu and their addresses lead to the home of the area: before, they were shown to everyone and their first
   * read answered 403, which sent the whole app to the no-access page.
   */
  agencyTier: false,
  /**
   * The CRM and marketing module (backend `CrmMarketing`, E07): the guest profiles, the segments, the campaigns, the automations and their
   * menu entries, off until the product owner turns it on. While it is off the entry «CRM Ospiti» of «Altro» and the pages that hang from it
   * are in no menu and their addresses lead to the home of the area. The pages the e-mails link to (the consent, the confirmation, the
   * unsubscribe and the welcome pages) are never behind it: an e-mail already sent must keep working.
   */
  crmMarketing: false,
  /**
   * The compliance traffic light (backend `ComplianceTrafficLight`, E03/F02/US01/T03): a light for each obligation, and the coverage report of the
   * proofs of a period (`GET /api/compliance/report` and its export, which answer 404 while it is off). Off until the product owner turns it on. The
   * page of the proofs (`/app/short-rent/alloggiati/reports`) offers its summary («Riepilogo») only while it is on: off, it is the archive of the proofs
   * alone, which does not depend on it.
   */
  complianceTrafficLight: false,
  /**
   * The assistant of the guests' messages (backend `MessageAssistant`, E05/F05, NF-66, NF-67, PO-08, PO-09), off until the product owner turns it on: what a guest
   * writes is personal data and the AI provider is an external sub-processor, so the privacy notice and the processing agreement of PO-09 come first. While it is
   * off the draft panel of the conversation and the page of its settings (`/app/short-rent/settings/assistant`, in «Altro») do not exist: the address leads to the
   * home of the area, nothing asks the server and the backend answers 404 to every endpoint of the assistant. Even with the flag on, an organization is served only
   * after it switches its own assistant on in its rules, and a draft is never sent without the host's approval.
   */
  messageAssistant: false,
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
