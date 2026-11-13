/**
 * The marketplace of integrations (E09/F01): the shapes mirror the backend `api/marketplace` endpoints (`MarketplaceCatalogDtos`,
 * `MarketplaceEntryDetailDtos`). Enums travel as member names (a status is `NotActive`, never `not-active`); the ids of the groups are
 * the camelCase words the page builds its texts from (`marketplace.groups.<id>.title`).
 */

/** The five groups of the Scopri page, in the order of MKT-01. */
export type MarketplaceGroupId = 'salesChannels' | 'connectedTools' | 'channelManagerFunctions' | 'homeServices' | 'partners';

/** Where an integration stands for the host: what the status badge of a card says. */
export type MarketplaceCardStatus = 'Active' | 'NotActive' | 'Pending' | 'ToFix';

/** What a card is: a sales channel, a connected tool, a function of the channel manager's license, or an external partner. */
export type MarketplaceEntryKind = 'Channel' | 'Tool' | 'LicensedFunction' | 'Partner';

/** Whether the status of a card is the one of the whole organization or of the property the page is about. */
export type MarketplaceStatusScope = 'Org' | 'Property';

/** Who invoices the cost of an integration. `Unknown` when nobody told. */
export type MarketplaceCostInvoicer = 'Unknown' | 'Partner' | 'CasaZen' | 'ChannelManager';

/** The job of a partner: the order of the Partners group (PO-11). */
export type MarketplacePartnerJob = 'Sell' | 'AccessProperty' | 'Compliance' | 'Cleaning' | 'Prices' | 'Administration';

/** How an integration is activated, which says where the button of a card leads. */
export type MarketplaceActivationType = 'api' | 'licenseRequest' | 'partnerSite';

/** The language of the texts of the catalog: the backend answers in Italian when a text is missing in the other one. */
export type MarketplaceLanguage = 'it' | 'en';

/** What an integration costs. The text is `null` when the cost is not known: it is never replaced by an invented price. */
export interface MarketplaceCost {
  text: string | null;
  invoicedBy: MarketplaceCostInvoicer;
}

/** A card of the catalog. The last four fields are the ones of a partner. */
export interface MarketplaceCatalogEntry {
  kind: MarketplaceEntryKind;
  /** Portal code, license module code or partner code: with the kind it names the entry. */
  code: string;
  name: string;
  logoUrl: string | null;
  /** One line: what the integration is for. */
  benefit: string;
  cost: MarketplaceCost;
  status: MarketplaceCardStatus;
  statusScope: MarketplaceStatusScope;
  canActivate: boolean;
  /** Why it cannot be activated (`octorate_not_connected`, ...); `null` when it can. */
  reason: string | null;
  job?: MarketplacePartnerJob | null;
  websiteUrl?: string | null;
  /** The codes of `GET api/service-categories` the partner works for. */
  serviceCategories?: string[] | null;
  octoratePortalCode?: string | null;
}

export interface MarketplaceCatalogGroup {
  id: MarketplaceGroupId;
  /** True for Home services: the page keeps its own flow (the supplier categories) and the group has no entries. */
  unchangedFlow: boolean;
  entries: MarketplaceCatalogEntry[];
}

/** Whether the channel manager is available for this organization: the first three groups wait for both. */
export interface MarketplaceOctorateState {
  enabled: boolean;
  connected: boolean;
}

/** `GET /api/marketplace/catalog`. */
export interface MarketplaceCatalogResponse {
  octorate: MarketplaceOctorateState;
  groups: MarketplaceCatalogGroup[];
}

export interface MarketplaceRequirement {
  code: string;
  text: string;
}

export interface MarketplaceFaq {
  q: string;
  a: string;
}

/** `GET /api/marketplace/entries/{kind}/{code}`: the data of the detail card (MKT-02). */
export interface MarketplaceEntryDetail {
  kind: MarketplaceEntryKind;
  code: string;
  name: string;
  logoUrl: string | null;
  status: MarketplaceCardStatus;
  /** What it does. */
  whatItDoes: string;
  /** For whom. */
  audience: string;
  activation: {
    type: MarketplaceActivationType;
    requirements: MarketplaceRequirement[];
    /** The last step is done on the panel of the channel manager. */
    needsOctoratePanel: boolean;
  };
  cost: MarketplaceCost;
  /** What data is shared, one plain sentence each. */
  dataShared: string[];
  deactivation: {
    text: string;
    /** True when the person has to do it on the site of the provider. */
    guided: boolean;
  };
  faq: MarketplaceFaq[];
  actions: {
    canActivate: boolean;
    reason: string | null;
  };
}

/** The property an integration of the Active tab is about (`MarketplaceIntegrationPropertyDto`). */
export interface MarketplaceIntegrationProperty {
  id: string;
  name: string;
}

/**
 * An activation of the Active tab (`MarketplaceIntegrationDto`). `status` is the status of a card (a request that waits for the license is `Pending`
 * here); the health rows say `Requested`. `declaredAt` is the day the host gave when it declared the activation (midnight UTC of that day) and
 * `verifiedAt` is when a connection or the license first showed it: «declared by you on …» is said from the first, «verified» only when the second is
 * set. The list carries no id of the activation: the health rows do (channels, tools and functions of the license).
 */
export interface MarketplaceActiveIntegration {
  kind: MarketplaceEntryKind;
  code: string;
  name: string;
  /** `null` for a row of the whole organization (a partner declared for all of it). */
  property: MarketplaceIntegrationProperty | null;
  status: MarketplaceCardStatus;
  /** The person declared it and the channel manager has not proven it. */
  isDeclared: boolean;
  lastSyncedAt: string | null;
  declaredAt: string | null;
  verifiedAt: string | null;
  /** The id of the activation, if the list carries it. It does not today: only the health rows have it, and a partner has no health row. */
  activationId?: string | null;
}

/** A CasaZen supplier the host already asked for a job (the shape of `HostUsedSupplier`, camelCase). */
export interface MarketplaceActiveProvider {
  supplierOrgId: string;
  supplierName: string;
  requestsCount: number;
  openCount: number;
  lastRequestAt: string;
  lastCategory: string;
}

/** `GET /api/marketplace/active`: the integrations that are on and the suppliers already used. */
export interface MarketplaceActiveResponse {
  integrations: MarketplaceActiveIntegration[];
  providers: MarketplaceActiveProvider[];
}

/*
 * The guided activation of an entry (E09/F02, MKT-03): the plan, the connection, the import and the mapping of a channel or a tool through the
 * channel manager's API, the request of a function of its license, and the hand-off to a partner's own site. The shapes mirror
 * `MarketplaceActivationDtos`, `MarketplaceFunctionDtos` and `MarketplacePartnerActivationDtos`. No shape carries a credential: the username
 * and the password of a portal are only in the body of the start, and no answer gives them back.
 */

/** The two kinds that go through the channel manager's API (backend `MarketplaceActivationKind`): the path of the wizard says `channel` or `tool`. */
export type MarketplaceConnectionKind = 'Channel' | 'Tool';

/** Where an activation stands (backend `MarketplaceActivationStatus`); the card shows `Requested` and `Pending` as Pending. */
export type MarketplaceActivationStatus = 'Requested' | 'Pending' | 'Active' | 'ToFix' | 'Deactivated';

/** What a portal asks of the person to be connected (the stable codes of the plan, in the order of the wizard). */
export const MARKETPLACE_ACTIVATION_REQUIREMENTS = ['hotelId', 'credentials', 'panelAccess'] as const;
export type MarketplaceActivationRequirement = (typeof MARKETPLACE_ACTIVATION_REQUIREMENTS)[number];

/**
 * `GET /api/marketplace/activations/plan?kind=&code=&propertyId=`: what the activation of a channel or a tool needs for one property.
 * `propertyLinked` false leads to the connect wizard first; `activationId` is the activation that exists, to resume it; `creatable` false
 * says the portal cannot be connected through the API (the wizard cannot start).
 */
export interface MarketplaceActivationPlan {
  kind: MarketplaceConnectionKind;
  code: string;
  name: string;
  propertyId: string;
  requirements: string[];
  creatable: boolean;
  propertyLinked: boolean;
  activationId: string | null;
  activationStatus: MarketplaceActivationStatus | null;
}

/**
 * Body of `POST /api/marketplace/activations`. `hotelId`, `username` and `password` are sent once, only when the portal asks for them: the
 * channel manager gets them in this one call and CasaZen keeps none of them.
 */
export interface StartMarketplaceActivationRequest {
  kind: MarketplaceConnectionKind;
  code: string;
  propertyId: string;
  hotelId?: string;
  username?: string;
  password?: string;
}

/**
 * Where an activation stands (`GET /api/marketplace/activations/{id}` and the answer of every step). `lastErrorCode` is a code the client
 * turns into simple words; `panelAccessDone` is true once the person gave the access on the channel. No credential, ever.
 */
export interface MarketplaceActivationState {
  activationId: string;
  kind: MarketplaceConnectionKind;
  code: string;
  propertyId: string;
  status: MarketplaceActivationStatus;
  connectionFound: boolean;
  connectionStatus: string | null;
  panelAccessDone: boolean;
  lastSyncedAt: string | null;
  lastErrorCode: string | null;
  connectionLastUpdate: string | null;
}

/** A room of the listing on the channel, with what it is mapped to and the proposal of CasaZen. A room with `manageable` false is shown for information and never mapped. */
export interface MarketplaceChannelRoom {
  channelRoomId: string;
  name: string;
  rateName: string | null;
  manageable: boolean;
  mappedProductId: string | null;
  proposedProductId: string | null;
}

/** A product (room) of the property's listing on the channel manager. */
export interface MarketplaceProduct {
  productId: string;
  name: string | null;
}

/** `GET /api/marketplace/activations/{id}/mapping`: the rooms of the channel and the products of the listing they can be mapped to. */
export interface MarketplaceActivationMapping {
  activationId: string;
  propertyProductId: string | null;
  channelRooms: MarketplaceChannelRoom[];
  products: MarketplaceProduct[];
}

/** One room of the channel the person chose and the product of the listing it is mapped to (`PUT .../mapping` takes a list of them, never an empty one). */
export interface MarketplaceRoomChoice {
  channelRoomId: string;
  productId: string;
}

/** The status of a function of the channel manager's license for a property (backend `MarketplaceFunctionStatus`). */
export type MarketplaceFunctionStatus = 'NotActive' | 'Requested' | 'Active' | 'ToFix';

/**
 * One function of the license for the property, and the answer of `POST /api/marketplace/functions/{moduleCode}/request`. `Requested` is the host
 * asking and the license not showing it yet (`isDeclared`); `requestGuidance` is what to ask the channel manager, in the language asked, with the
 * name of the function and of the property put in (`null` for an `Active` function).
 */
export interface MarketplaceFunction {
  code: string;
  name: string;
  status: MarketplaceFunctionStatus;
  activationId: string | null;
  isDeclared: boolean;
  requestedAt: string | null;
  verifiedAt: string | null;
  lastSyncedAt: string | null;
  lastErrorCode: string | null;
  changeRequestedAt: string | null;
  requestGuidance: string | null;
}

/**
 * `GET /api/marketplace/functions?propertyId=` and `POST /api/marketplace/functions/refresh`: the twelve functions of the license of one property,
 * the plan (`tier`) and the room limit of the last live read (`null` until a read). `noRoomLicense`: the limit read is 0, so no prices and no
 * availability are published.
 */
export interface MarketplaceFunctionList {
  propertyId: string;
  tier: string | null;
  roomsLimit: number | null;
  noRoomLicense: boolean;
  licenseReadAt: string | null;
  functions: MarketplaceFunction[];
}

/** The fields of the property that the brief of a partner carries, and no others: `cinCode` only when the CIN is valid. */
export interface MarketplacePartnerPropertyData {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  cinCode: string | null;
}

/** `GET /api/marketplace/partners/{code}/brief`: what the host takes to the partner's own site. No guest, no booking, no price, no document. */
export interface MarketplacePartnerBrief {
  code: string;
  name: string;
  websiteUrl: string;
  checklist: string[];
  propertyData: MarketplacePartnerPropertyData | null;
}

/**
 * The answer of `POST /api/marketplace/partners/{code}/declare`: `isDeclared` is true while only the host's word backs the activation, and `verifiedAt`
 * is set only when a connection showed it active. `declaredAt` is the day the host gave, as midnight UTC of that day.
 */
export interface MarketplacePartnerActivation {
  activationId: string;
  code: string;
  propertyId: string | null;
  status: MarketplaceActivationStatus;
  isDeclared: boolean;
  declaredAt: string | null;
  verifiedAt: string | null;
}

/*
 * The health of the active integrations and the change of an activation (E09/F03, MKT-04, MKT-05). The shapes mirror `MarketplaceHealthDtos` and
 * `MarketplaceChangeDtos`. No shape carries a credential: the username and the password of a portal are only in the body of the settings change.
 */

/** A problem in simple words: `code` is the stable code a client may translate, `message` is the text in the language asked (never a text of the channel manager's). */
export interface MarketplaceHealthError {
  code: string;
  message: string;
}

/**
 * The quota of the channel manager's API at the last sync of the organization (the same on every row): `used` of `limit` units. `warn` is the server's
 * word: `used` reached `Marketplace:Health:QuotaWarnPercent` of `limit`. `readAt` is when it was read (UTC).
 */
export interface MarketplaceQuota {
  used: number;
  limit: number;
  warn: boolean;
  readAt: string;
}

/** One activation in the health panel: a channel, a tool or a function of the license, for a property. */
export interface MarketplaceHealthItem {
  activationId: string;
  /** `null` for a row of the whole organization. */
  propertyId: string | null;
  propertyName: string | null;
  kind: MarketplaceEntryKind;
  code: string;
  name: string;
  /** `Pending`, `Active`, `ToFix`, or `Requested` (a function that waits for the license). */
  status: MarketplaceActivationStatus;
  /** True while only the host's word backs the status. */
  isDeclared: boolean;
  /** When CasaZen last read the state of it from the channel manager (UTC); `null` until then. */
  lastSyncedAt: string | null;
  error: MarketplaceHealthError | null;
  /** `null` until a sync read the quota. */
  quota: MarketplaceQuota | null;
  /** Set while a change the host asked for waits for the license (UTC). */
  changeRequestedAt: string | null;
}

/**
 * What a read of `GET /api/marketplace/health` came to. `forbidden` (403) and `notFound` (404: the connector is off, or the property is not the caller's) are answers,
 * not errors: neither sends the app to the page of no access, and neither leaves the rows of an older read on the screen.
 */
export type MarketplaceHealthRead =
  | { outcome: 'items'; items: MarketplaceHealthItem[] }
  | { outcome: 'forbidden' }
  | { outcome: 'notFound' };

/**
 * Body of `PATCH /api/marketplace/activations/{id}`: only what the portal asks for, and only the members that are given. `username` and `password` are sent in this one
 * call and are not kept anywhere by CasaZen.
 */
export interface UpdateMarketplaceSettingsRequest {
  hotelId?: string;
  username?: string;
  password?: string;
}

/**
 * The answer of a change, a deactivation or a change request: the activation as it stands now (`MarketplaceActivationChangeDto`). `status` is `Deactivated` after a
 * deactivation; `changeRequestedAt` is set after the change request of a function, until the license answers it. No login detail, ever.
 */
export interface MarketplaceActivationChange {
  activationId: string;
  kind: MarketplaceEntryKind;
  code: string;
  propertyId: string | null;
  status: MarketplaceActivationStatus;
  changeRequestedAt: string | null;
}

/**
 * `GET /api/marketplace/activations/{id}/deactivation-preview`: what a deactivation does, to be read before it is confirmed. `effects` are plain sentences in the language
 * asked with the name put in; `guided` is true for a partner (it is turned off on its own site) and for a function of the license (it is asked of the channel manager).
 */
export interface MarketplaceDeactivationPreview {
  activationId: string;
  kind: MarketplaceEntryKind;
  code: string;
  name: string;
  effects: string[];
  requiresConfirmation: boolean;
  guided: boolean;
}
