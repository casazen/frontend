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
  | 'marketingGuestInterestAi'
  | 'guestPortal'
  | 'guestPortalSupplierServices'
  | 'complianceTrafficLight'
  | 'guestRegistrationRegimes'
  | 'messageAssistant'
  | 'fiscalDocumentIssuance'
  | 'octorateDocumentImport'
  | 'ownerInvoicing'
  | 'accountantPackage'
  | 'sdiSubmission'
  | 'taxReportingExports'
  | 'routines'
  | 'purgeDocumentsAfterReceipt'
  | 'portalChatCheckInLink'
  | 'guestContactInfo'
  | 'touristTaxOnlinePayment'
  | 'checkInIdentityVerification'
  | 'scheduledMessages'
  | 'whiteLabelHost'
  | 'auth0HostSync'
  | 'siteEmbed';

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
  marketingGuestInterestAi: false,
  guestPortal: false,
  guestPortalSupplierServices: false,
  /**
   * The compliance traffic light (backend `ComplianceTrafficLight`, E03/F02/US01/T03): a light for each obligation, and the coverage report of the
   * proofs of a period (`GET /api/compliance/report` and its export, which answer 404 while it is off). Off until the product owner turns it on. The
   * page of the proofs (`/app/short-rent/alloggiati/reports`) offers its summary («Riepilogo») only while it is on: off, it is the archive of the proofs
   * alone, which does not depend on it.
   */
  complianceTrafficLight: false,
  /**
   * The regimes of the registration of the guests (backend `GuestRegistrationRegimes`, E29/F02/US01/T01, NF-125, decisions D5 and D12), off until the product owner has read what the catalog says of
   * each canton and on in the test environment only: what Italy and each of the 26 cantons ask, how sure the sources are, what CasaZen does for it and the host's own answer where the sources do not
   * settle it (`GET` and `PUT api/properties/{id}/guest-registration`, which answer 404 while it is off). It decides what a property in Switzerland shows: with it on the card «Notifica degli ospiti
   * nel tuo cantone» is in the tab «Documenti e adempimenti» (it carries the field of the structure number of Ticino and what is still missing), in the step «Notifica degli ospiti» of the activation of the
   * property and in the last step of «Aggiungi immobile», and the general guidance «Registrazione in Svizzera» is no longer drawn. While it is off nothing changes: that guidance is what a Swiss property shows
   * and nothing asks the server. What a property lacks to be notified (its municipality, in Ticino its structure number) and the part «Notifica degli ospiti» of the plan «Inizia con CasaZen» do not depend on it.
   */
  guestRegistrationRegimes: false,
  /**
   * The assistant of the guests' messages (backend `MessageAssistant`, E05/F05, NF-66, NF-67, PO-08, PO-09), off until the product owner turns it on: what a guest
   * writes is personal data and the AI provider is an external sub-processor, so the privacy notice and the processing agreement of PO-09 come first. While it is
   * off the draft panel of the conversation and the page of its settings (`/app/short-rent/settings/assistant`, in «Altro») do not exist: the address leads to the
   * home of the area, nothing asks the server and the backend answers 404 to every endpoint of the assistant. Even with the flag on, an organization is served only
   * after it switches its own assistant on in its rules, and a draft is never sent without the host's approval.
   */
  messageAssistant: false,
  /**
   * The issuance of fiscal documents by CasaZen (backend `FiscalDocumentIssuance`, E06/F02/US02/T02, NF-82, FIS-02, PO-05), off until the accountant has approved the rules of the
   * documents. The backend gates only the issuance (the draft, the issue, the credit note, the discard) and the choice of the mode «CasaZen emette» of the issuer setting; the reading of the
   * documents is not behind it. With `octorateDocumentImport` it decides whether the page of the fiscal documents (`/app/short-rent/fiscal/documents`) exists: while both are off the tab,
   * the card of the fiscal page and the link of the payment ledger are not there and the address leads to the home of the area.
   */
  fiscalDocumentIssuance: false,
  /**
   * The import of the documents the channel manager issued (backend `OctorateDocumentImport`, E06/F03/US02/T01, NF-84, FIS-04, D19), off until the documents list is proven on a structure
   * with the invoice module. It gates the import job and `GET api/fiscal/documents/{id}/octorate-pdf` (404 while it is off, as while `octorateConnector` is). With `fiscalDocumentIssuance` it
   * decides whether the page of the fiscal documents exists, and on its own whether an imported document has a PDF button.
   */
  octorateDocumentImport: false,
  /**
   * The invoices of the property manager to the owners (backend `OwnerInvoicing`, E14/F01/US01/T01, NF-114, D9, D15), off until the accountant confirms the ⚖ choices (R4, I10, I11) and on in the test environment
   * only. While it is off the panel «Fattura del PM» of the statement and the page «Fatture ai proprietari» (`/app/account/owner-invoices`) do not exist: the panel is not drawn, nothing
   * asks the server, the page has no entry in the menu and its address leads to the home of the area. The backend answers 404 to every endpoint of the invoices while it is off.
   * The same flag decides who holds the accounts of the portals (`PUT api/billing-setup/channels`, `api/billing-setup/channel-account-holders`, which answer 404 while it is off, and the section
   * `channels` of the billing setup then shows no values): the step «Commissioni dei canali» of the wizard «Fatturazione» keeps the account holders out and says that they are not available
   * yet; the commission rules of the portals do not depend on it.
   */
  ownerInvoicing: false,
  /**
   * The package of the accountant and the summary of the agency (backend `AccountantPackage`, E15/F01/US01/T01, NF-101, NF-115), off until the product owner turns it on in the test environment.
   * While it is off the page «Commercialista» (`/app/short-rent/accountant`, a tab of Incassi next to Report) does not exist: the tab is not there, its address leads to the home of the area,
   * nothing asks the server and the backend answers 404 to both endpoints of the package. The optional step «Commercialista» of the wizard «Fatturazione» (the address of the accountant, the monthly
   * send and the test send, E15/F02/US02/T01) is behind it too: off, the wizard has no such step and does not read the settings of the send.
   */
  accountantPackage: false,
  /**
   * The sending of the Italian electronic invoices to the SDI through the channel CasaZen has (backend `SdiSubmission`, E17/F01/US02, E17/F03/US01/T02, NF-116, NF-86, D13, D15), off until the product owner turns it on in the test
   * environment together with the credentials of the channel. While it is off nothing changes: the SDI panel of the detail of a document (the state, «Invia», «Dichiara inviato a mano», the reason of a rejection and the guided
   * correction) and the step «Invio allo SDI» of the wizard «Fatturazione» do not exist, and the backend answers 404 to the submission, the declaration and the correction. The state of a document towards the SDI
   * is still the one the list always showed. The self-billed invoices (TD17) do not depend on it, except for the correction of one the SDI rejected («Correggi e rimanda») and the closing of its replacement draft («Chiudi come non più dovuta»): they are behind `fiscalDocumentIssuance`.
   */
  sdiSubmission: false,
  /**
   * The Italian tax exports and checks of the property manager as withholding agent (backend `TaxReportingExports`, E18/F01/US02, E18/F01/US03, NF-117, D15), off until the product owner turns it on in the test environment
   * and the accountant has confirmed the ⚖ choices I6, I7, I8 and T2. While it is off nothing changes: the exports of the Certificazione Unica (CSV, Excel, the draft «prospetto» of each owner), of the 770 and of the
   * communication of the short-let contracts, the section of the stays of a company tenant with its decision (and the button «Decidi» of that «Da fare»), the number of apartments an owner lets outside the agency with the
   * warning «impresa presunta» on the owner's financial page, and the withholding and the CU of the year in the owner portal are not drawn, nothing asks the server and the backend answers 404 to every one of those endpoints
   * (the owner portal answers its empty summary). The export of the F24 data of a month is not behind it (the backend does not gate it), and the payout dialog does not read it: the facts of a payout are always the ledger's.
   */
  taxReportingExports: false,
  /**
   * The automation routines of the host (backend `Routines`, E01/F04, NF-21, DEB-06, ADR-022), off until the product owner turns it on in the test environment: the routines page
   * (`/app/short-rent/automations`, a tab of «Impostazioni») and its entry. While it is off the tab is not there, the address leads to the home of the area, nothing asks the server
   * and the backend answers 404 to every endpoint of `api/routines`, which no routine runs behind. Even with the flag on, only the actions the server lists as available can be
   * switched on (`GET api/routines/actions`): the others can only run in test mode.
   */
  routines: false,
  /**
   * The deletion of the photos of the guests' documents once an archived Alloggiati receipt covers their stay (backend `PurgeDocumentsAfterReceipt`, E20/F02/US01/T02, NF-121, decision O4), off until
   * the product owner turns it on in the test environment: the deletion cannot be undone, so it is switched on in production only after the test has shown it. It decides nothing about the receipt
   * itself: this client only reads it to tell the host, before saving a receipt and after, that the photos of the documents of the stays it covers will be deleted. The data of the guests are never
   * touched by it. While it is off nothing changes: the dialog of the receipt says nothing about a deletion.
   */
  purgeDocumentsAfterReceipt: false,
  /**
   * The check-in link of a stay from a portal that has no e-mail address goes to the guest in the reservation chat of the portal (backend `PortalChatCheckInLink`, E23/F01, NF-122,
   * decision O10), off until the product owner turns it on in the test environment: the chat of the channel manager needs a permission that is not given everywhere yet. Like the backend, it
   * works only while `octorateConnector` is on too: the delivery runs only then (`CheckInLinkDeliveryService`), and what the server records with the connector off is not for a screen. While it
   * is off (or the connector is, or `guestContactInfo` too) the guest panel of a booking shows nothing of the delivery of the link, nothing asks the server for it, and the check-in link
   * stays what it was: an e-mail, or a link the host copies. With the connector and the flag on the panel says where the link stands (sent, waiting for the chat, waiting for the conversation,
   * failed) and offers «Copia link».
   */
  portalChatCheckInLink: false,
  /**
   * The e-mail address of a portal guest is read from the channel manager, once, for the check-in link only (backend `GuestContactInfo`, E23/F01, NF-122), off until the static IP addresses
   * are registered. It has no screen of its own: it decides, with `portalChatCheckInLink` and while `octorateConnector` is on (the backend asks it too), whether the guest panel of a booking
   * reads the delivery of the check-in link and says that the link waits for the registration of the IP addresses.
   */
  guestContactInfo: false,
  /**
   * The tourist tax paid online in the guest check-in (backend `TouristTaxOnlinePayment`, E25/F01, NF-119, decision O12), off until the product owner turns it on in the test
   * environment. It decides whether the guest page asks for the tax of the stay (`GET api/public/checkin/{token}/tourist-tax`) and may show the step «Tassa di soggiorno»; the backend
   * adds that a guest pays only where the organization turned its own setting on and its account takes payments (409 otherwise: the page then has no such step). While it is off the guest page
   * is the page it always was, nothing asks the server about the tax, and the backend answers 404 to its endpoints and sends no `collection` block to the host (the tax step of the host
   * wizard then shows no state of the collection).
   */
  touristTaxOnlinePayment: false,
  /**
   * The identity verification of the guest check-in (backend `CheckInIdentityVerification`, E03/F04, E22, NF-24, NF-50), off until the product owner turns it on in the test environment. The guest
   * page does not read it (it follows what the check-in link says, `identityVerification`); it decides what the host sees: the card «Verifica dell'identità» of the organization settings, the
   * video call of the verification queue (and the new words next to it) and the QR of the door in the property QR page. The page of the door (`/checkin/porta/:doorToken`) exists only while it is on.
   * While it is off nothing changes: the settings page, the queue and the QR page are the ones they always were, nothing asks the server, and the backend answers 404 to every call of the identification.
   */
  checkInIdentityVerification: false,
  /**
   * The scheduled messages of the routines (backend `ScheduledMessages`, E05/F07, NF-71, MSG-11, ADR-022), off until the product owner confirms the send window and the retry times and on in the
   * test environment only: it turns the routine action `MessageToGuest` into real sending. It decides what the host sees on the page of a booking: the section «Messaggi programmati» of the tab
   * Soggiorno (the timeline of what the routines will send, with «Modifica», «Salta» and «Invia ora») and the live update of the page when a message is held back. While it is off nothing is drawn,
   * nothing asks the server, and the backend answers 404 to the three endpoints of the messages and plans nothing. It works on the routines, so the backend needs `routines` on too: with the routines
   * closed nothing is planned or sent, whatever this flag says, and the section then tells that nothing is scheduled and has no link to the page of the routines.
   */
  scheduledMessages: false,
  /**
   * The agency's own domain as a whole site (backend `WhiteLabelHost`, E40, NF-140, NF-142, NF-143), off until the product owner turns it on in the test environment. Besides the booking site, the domain of an
   * agency then serves the guest check-in page and the owner portal with the agency's logo and colours, and the guest area accepts the last four digits of the phone as a second proof. Which of those a domain serves
   * is decided for each host by `resolve-host` (`surfaces`, `ownerLoginReady`), which says «on» only with this flag on, an allowed plan, a verified domain and the setting of the agency: the routes of a host read that
   * answer, never this flag. The screens that belong to no host read it: the choice of the proof in the form of «Le mie prenotazioni» (`/book/:orgSlug/my-bookings`, on the CasaZen domain and on a host). While it is
   * off nothing changes: a host serves the booking site and the pages it served before, the form asks for the code and the e-mail only, and the backend answers 404 to what it gates.
   */
  whiteLabelHost: false,
  /**
   * The registration of the agency domains with the sign-in service (backend `Auth0HostSync`, E40/F01/US02, NF-141), off until the product owner supplies credentials that may change the application (they are the owner's
   * to give). No screen of this client reads it: whether the owners of an agency can sign in on its domain is the `ownerLoginReady` of `resolve-host`, which the backend sets when the registration is done, by this
   * sync or by hand. The key exists so that every flag the server publishes is typed here, and for the pages of the backoffice that tell the agency where its domain stands.
   */
  auth0HostSync: false,
  /**
   * The embeddable booking widgets (backend `SiteEmbed`, E40/F01/US01/T01, E41, NF-144, NF-145), off until the product owner turns it on in the test environment. It decides whether the pages
   * under `/embed/<org>/…` of the CasaZen domain answer: while it is off they say «This widget is not available», nothing asks the server for the org and the backend reports `embedEnabled` false on
   * the agency domains. On an agency's own domain the pages follow `embedEnabled` of `resolve-host` instead (the plan of the agency decides there). Nothing else changes while it is off.
   */
  siteEmbed: false,
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

/**
 * The flags a page waits for: one, or a list of which at least ONE must be on (a page that serves two sources, each behind a flag of its own, exists while either of them does).
 * A list with no flag in it is never on: a page nobody can turn on is hidden, not shown.
 */
export type FeatureFlagRule = FeatureFlagKey | readonly FeatureFlagKey[];

/** No rule is no limit; otherwise the rule is met when its flag, or any flag of its list, is on. */
export function isFeatureRuleEnabled(flags: Partial<FeatureFlags> | undefined, rule: FeatureFlagRule | undefined): boolean {
  if (rule === undefined) return true;
  return typeof rule === 'string' ? isFeatureEnabled(flags, rule) : rule.some((key) => isFeatureEnabled(flags, key));
}
