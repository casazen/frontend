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

/** An activation of the Active tab. Best reading of the list the backend describes (E09/F01/US01/T03): the Active tab task refines it. */
export interface MarketplaceActiveIntegration {
  kind: MarketplaceEntryKind;
  code: string;
  name: string;
  propertyId: string | null;
  propertyName: string | null;
  status: 'Requested' | 'Pending' | 'Active' | 'ToFix';
  /** The person declared it and the channel manager has not proven it. */
  isDeclared: boolean;
  lastSyncedAt: string | null;
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
