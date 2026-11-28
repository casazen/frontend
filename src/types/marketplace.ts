/**
 * The marketplace of integrations (E09/F01): the shapes mirror the backend `api/marketplace` endpoints (`MarketplaceCatalogDtos`,
 * `MarketplaceEntryDetailDtos`). Enums travel as member names (a status is `NotActive`, never `not-active`); the ids of the groups are
 * the camelCase words the page builds its texts from (`marketplace.groups.<id>.title`).
 */

export type MarketplaceGroupId = 'salesChannels' | 'connectedTools' | 'channelManagerFunctions' | 'homeServices' | 'partners';

export type MarketplaceCardStatus = 'Active' | 'NotActive' | 'Pending' | 'ToFix';

export type MarketplaceEntryKind = 'Channel' | 'Tool' | 'LicensedFunction' | 'Partner';

type MarketplaceStatusScope = 'Org' | 'Property';

export type MarketplaceCostInvoicer = 'Unknown' | 'Partner' | 'CasaZen' | 'ChannelManager';

type MarketplacePartnerJob = 'Sell' | 'AccessProperty' | 'Compliance' | 'Cleaning' | 'Prices' | 'Administration';

type MarketplaceActivationType = 'api' | 'licenseRequest' | 'partnerSite';

export type MarketplaceLanguage = 'it' | 'en';

interface MarketplaceCost {
  text: string | null;
  invoicedBy: MarketplaceCostInvoicer;
}

export interface MarketplaceCatalogEntry {
  kind: MarketplaceEntryKind;
  code: string;
  name: string;
  logoUrl: string | null;
  benefit: string;
  cost: MarketplaceCost;
  status: MarketplaceCardStatus;
  statusScope: MarketplaceStatusScope;
  canActivate: boolean;
  reason: string | null;
  job?: MarketplacePartnerJob | null;
  websiteUrl?: string | null;
  serviceCategories?: string[] | null;
  octoratePortalCode?: string | null;
  /**
   * A sales channel that needs nothing from the host but the id of each property on the portal (Booking, Expedia, Agoda, HomeToGo, Holidu...): the
   * connect wizard can create the connection from CasaZen (`connect`), and the last step is the approval of the channel manager on the portal's own site.
   * Absent or `false` for the others (Airbnb authorises with a token, Vrbo is activated by the channel manager's support): they go through its panel.
   */
  connectByPropertyId?: boolean;
  requiresCredentials?: boolean;
}

export interface MarketplaceCatalogGroup {
  id: MarketplaceGroupId;
  unchangedFlow: boolean;
  entries: MarketplaceCatalogEntry[];
}

interface MarketplaceOctorateState {
  enabled: boolean;
  connected: boolean;
}

export interface MarketplaceCatalogResponse {
  octorate: MarketplaceOctorateState;
  groups: MarketplaceCatalogGroup[];
}

interface MarketplaceRequirement {
  code: string;
  text: string;
}

interface MarketplaceFaq {
  q: string;
  a: string;
}

export interface MarketplaceEntryDetail {
  kind: MarketplaceEntryKind;
  code: string;
  name: string;
  logoUrl: string | null;
  status: MarketplaceCardStatus;
  whatItDoes: string;
  audience: string;
  activation: {
    type: MarketplaceActivationType;
    requirements: MarketplaceRequirement[];
    needsOctoratePanel: boolean;
  };
  cost: MarketplaceCost;
  dataShared: string[];
  deactivation: {
    text: string;
    guided: boolean;
  };
  faq: MarketplaceFaq[];
  actions: {
    canActivate: boolean;
    reason: string | null;
  };
}

export interface MarketplaceIntegrationProperty {
  id: string;
  name: string;
}

export interface MarketplaceActiveIntegration {
  kind: MarketplaceEntryKind;
  code: string;
  name: string;
  property: MarketplaceIntegrationProperty | null;
  status: MarketplaceCardStatus;
  isDeclared: boolean;
  lastSyncedAt: string | null;
  declaredAt: string | null;
  verifiedAt: string | null;
  activationId?: string | null;
}

export interface MarketplaceActiveProvider {
  supplierOrgId: string;
  supplierName: string;
  requestsCount: number;
  openCount: number;
  lastRequestAt: string;
  lastCategory: string;
}

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

export type MarketplaceConnectionKind = 'Channel' | 'Tool';

export type MarketplaceActivationStatus = 'Requested' | 'Pending' | 'Active' | 'ToFix' | 'Deactivated';

export const MARKETPLACE_ACTIVATION_REQUIREMENTS = ['hotelId', 'credentials', 'panelAccess'] as const;
export type MarketplaceActivationRequirement = (typeof MARKETPLACE_ACTIVATION_REQUIREMENTS)[number];

export interface MarketplaceActivationPlan {
  verifiedHotelId?: string | null;
  managedByStaff?: boolean;
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

export interface StartMarketplaceActivationRequest {
  kind: MarketplaceConnectionKind;
  code: string;
  propertyId: string;
  hotelId?: string;
  username?: string;
  password?: string;
}

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

export interface MarketplaceChannelRoom {
  channelRoomId: string;
  name: string;
  rateName: string | null;
  manageable: boolean;
  mappedProductId: string | null;
  proposedProductId: string | null;
}

interface MarketplaceProduct {
  productId: string;
  name: string | null;
}

export interface MarketplaceActivationMapping {
  activationId: string;
  propertyProductId: string | null;
  channelRooms: MarketplaceChannelRoom[];
  products: MarketplaceProduct[];
}

export interface MarketplaceRoomChoice {
  channelRoomId: string;
  productId: string;
}

export type MarketplaceFunctionStatus = 'NotActive' | 'Requested' | 'Active' | 'ToFix';

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

export interface MarketplacePartnerBrief {
  code: string;
  name: string;
  websiteUrl: string;
  checklist: string[];
  propertyData: MarketplacePartnerPropertyData | null;
}

export interface MarketplacePartnerActivation {
  activationId: string;
  code: string;
  propertyId: string | null;
  status: MarketplaceActivationStatus;
  isDeclared: boolean;
  declaredAt: string | null;
  verifiedAt: string | null;
}

interface MarketplaceHealthError {
  code: string;
  message: string;
}

export interface MarketplaceQuota {
  used: number;
  limit: number;
  warn: boolean;
  readAt: string;
}

export interface MarketplaceHealthItem {
  activationId: string;
  propertyId: string | null;
  propertyName: string | null;
  kind: MarketplaceEntryKind;
  code: string;
  name: string;
  status: MarketplaceActivationStatus;
  isDeclared: boolean;
  lastSyncedAt: string | null;
  error: MarketplaceHealthError | null;
  quota: MarketplaceQuota | null;
  changeRequestedAt: string | null;
}

export type MarketplaceHealthRead =
  | { outcome: 'items'; items: MarketplaceHealthItem[] }
  | { outcome: 'forbidden' }
  | { outcome: 'notFound' };

export interface UpdateMarketplaceSettingsRequest {
  hotelId?: string;
  username?: string;
  password?: string;
}

export interface MarketplaceActivationChange {
  activationId: string;
  kind: MarketplaceEntryKind;
  code: string;
  propertyId: string | null;
  status: MarketplaceActivationStatus;
  changeRequestedAt: string | null;
}

export interface MarketplaceDeactivationPreview {
  activationId: string;
  kind: MarketplaceEntryKind;
  code: string;
  name: string;
  effects: string[];
  requiresConfirmation: boolean;
  guided: boolean;
}
