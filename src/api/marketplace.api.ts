import { ApiClient } from '@/api/client';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import axios from '@/lib/axios';
import type {
  MarketplaceActiveResponse,
  MarketplaceActivationChange,
  MarketplaceActivationMapping,
  MarketplaceActivationPlan,
  MarketplaceActivationState,
  MarketplaceCatalogEntry,
  MarketplaceCatalogResponse,
  MarketplaceConnectionKind,
  MarketplaceDeactivationPreview,
  MarketplaceEntryDetail,
  MarketplaceFunction,
  MarketplaceFunctionList,
  MarketplaceGroupId,
  MarketplaceHealthItem,
  MarketplaceHealthRead,
  MarketplaceLanguage,
  MarketplacePartnerActivation,
  MarketplacePartnerBrief,
  MarketplaceQuota,
  MarketplaceRoomChoice,
  StartMarketplaceActivationRequest,
  UpdateMarketplaceSettingsRequest,
} from '@/types';

const CATALOG_PATH = '/marketplace/catalog';
const ENTRIES_PATH = '/marketplace/entries';
const ACTIVE_PATH = '/marketplace/active';
const HEALTH_PATH = '/marketplace/health';
const ACTIVATIONS_PATH = '/marketplace/activations';
const FUNCTIONS_PATH = '/marketplace/functions';
const PARTNERS_PATH = '/marketplace/partners';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function groupIdOf(value: unknown): MarketplaceGroupId {
  const id = typeof value === 'string' ? value : '';
  return (id.charAt(0).toLowerCase() + id.slice(1)) as MarketplaceGroupId;
}

/**
 * `GET /api/marketplace/catalog`: the five groups of the Scopri page with the status of each card for the property (all the
 * properties of the caller's scope without one). The texts come in `language`, Italian where a text is missing in the other one.
 * An answer that is not a catalog (the page of a proxy, say) is a load error, never an empty marketplace.
 */
export async function getMarketplaceCatalog(propertyId: string | undefined, language: MarketplaceLanguage): Promise<MarketplaceCatalogResponse> {
  const data = await ApiClient.get<unknown>(CATALOG_PATH, { propertyId, lang: language });
  if (!isRecord(data) || !isRecord(data.octorate) || !Array.isArray(data.groups)) throw new UnexpectedApiResponseError(CATALOG_PATH);

  return {
    octorate: { enabled: data.octorate.enabled === true, connected: data.octorate.connected === true },
    groups: data.groups.filter(isRecord).map((group) => ({
      id: groupIdOf(group.id),
      unchangedFlow: group.unchangedFlow === true,
      entries: Array.isArray(group.entries) ? (group.entries as MarketplaceCatalogEntry[]) : [],
    })),
  };
}

export async function getMarketplaceEntry(
  kind: string,
  code: string,
  propertyId: string | undefined,
  language: MarketplaceLanguage,
): Promise<MarketplaceEntryDetail> {
  const path = `${ENTRIES_PATH}/${encodeURIComponent(kind)}/${encodeURIComponent(code)}`;
  const data = await ApiClient.get<MarketplaceEntryDetail | null | undefined>(path, { propertyId, lang: language });
  if (!isRecord(data) || !isRecord(data.activation) || !isRecord(data.actions) || !isRecord(data.cost)) {
    throw new UnexpectedApiResponseError(`${ENTRIES_PATH}/{kind}/{code}`);
  }

  return {
    ...data,
    activation: { ...data.activation, requirements: data.activation.requirements ?? [] },
    dataShared: data.dataShared ?? [],
    faq: data.faq ?? [],
  };
}

function activeIntegrationOf(row: unknown): MarketplaceActiveResponse['integrations'][number] {
  if (!isRecord(row) || typeof row.kind !== 'string' || typeof row.code !== 'string' || typeof row.name !== 'string' || typeof row.status !== 'string') {
    throw new UnexpectedApiResponseError(ACTIVE_PATH);
  }

  const property = isRecord(row.property) && typeof row.property.id === 'string' ? { id: row.property.id, name: typeof row.property.name === 'string' ? row.property.name : '' } : null;
  return {
    ...(row as unknown as MarketplaceActiveResponse['integrations'][number]),
    property,
    isDeclared: row.isDeclared === true,
    lastSyncedAt: typeof row.lastSyncedAt === 'string' ? row.lastSyncedAt : null,
    declaredAt: typeof row.declaredAt === 'string' ? row.declaredAt : null,
    verifiedAt: typeof row.verifiedAt === 'string' ? row.verifiedAt : null,
  };
}

export async function getMarketplaceActive(propertyId: string | undefined, language: MarketplaceLanguage): Promise<MarketplaceActiveResponse> {
  const data = await ApiClient.get<unknown>(ACTIVE_PATH, { propertyId, lang: language });
  if (!isRecord(data) || !Array.isArray(data.integrations) || !Array.isArray(data.providers)) throw new UnexpectedApiResponseError(ACTIVE_PATH);

  return { integrations: data.integrations.map(activeIntegrationOf), providers: data.providers as MarketplaceActiveResponse['providers'] };
}

function healthItemOf(row: unknown): MarketplaceHealthItem {
  if (
    !isRecord(row) ||
    typeof row.activationId !== 'string' ||
    typeof row.kind !== 'string' ||
    typeof row.code !== 'string' ||
    typeof row.name !== 'string' ||
    typeof row.status !== 'string'
  ) {
    throw new UnexpectedApiResponseError(HEALTH_PATH);
  }

  const error = row.error;
  const problem = isRecord(error) ? { code: typeof error.code === 'string' ? error.code : '', message: typeof error.message === 'string' ? error.message : '' } : null;
  const quota = row.quota;
  const quotaRead: MarketplaceQuota | null =
    isRecord(quota) && typeof quota.used === 'number' && typeof quota.limit === 'number' && typeof quota.readAt === 'string'
      ? { used: quota.used, limit: quota.limit, warn: quota.warn === true, readAt: quota.readAt }
      : null;

  return {
    ...(row as unknown as MarketplaceHealthItem),
    propertyId: typeof row.propertyId === 'string' ? row.propertyId : null,
    propertyName: typeof row.propertyName === 'string' ? row.propertyName : null,
    isDeclared: row.isDeclared === true,
    lastSyncedAt: typeof row.lastSyncedAt === 'string' ? row.lastSyncedAt : null,
    error: problem,
    quota: quotaRead,
    changeRequestedAt: typeof row.changeRequestedAt === 'string' ? row.changeRequestedAt : null,
  };
}

/**
 * `GET /api/marketplace/health` (needs `ota.read` and the connector): one row for each channel, tool or function of the license of the caller's properties that is not turned
 * off, with its status, last sync, problem and the quota of the last sync. A read of CasaZen's own rows: nothing is asked of the channel manager. A 403 and a 404 (the connector is
 * off, or the property is not the caller's) are answers of this read, not errors of the app: a 403 does not send the person to the page of no access, and neither leaves the rows
 * of an older read behind (the query keeps the last data of a read that failed, never of one that answered).
 */
export async function getMarketplaceHealth(propertyId: string | undefined, language: MarketplaceLanguage): Promise<MarketplaceHealthRead> {
  const response = await axios.get<unknown>(HEALTH_PATH, {
    params: { propertyId, lang: language },
    validateStatus: (status) => (status >= 200 && status < 300) || status === 403 || status === 404,
  });
  if (response.status === 403) return { outcome: 'forbidden' };
  if (response.status === 404) return { outcome: 'notFound' };

  const data = response.data;
  if (!isRecord(data) || !Array.isArray(data.items)) throw new UnexpectedApiResponseError(HEALTH_PATH);
  return { outcome: 'items', items: data.items.map(healthItemOf) };
}

const activationPath = (id: string, step = '') => `${ACTIVATIONS_PATH}/${encodeURIComponent(id)}${step}`;

function activationStateOf(data: unknown, path: string): MarketplaceActivationState {
  if (!isRecord(data) || typeof data.activationId !== 'string' || typeof data.status !== 'string') throw new UnexpectedApiResponseError(path);
  return data as unknown as MarketplaceActivationState;
}

export async function getActivationPlan(kind: MarketplaceConnectionKind, code: string, propertyId: string): Promise<MarketplaceActivationPlan> {
  const path = `${ACTIVATIONS_PATH}/plan`;
  const data = await ApiClient.get<unknown>(path, { kind, code, propertyId });
  if (!isRecord(data) || !Array.isArray(data.requirements) || typeof data.propertyLinked !== 'boolean') throw new UnexpectedApiResponseError(path);

  return {
    ...(data as unknown as MarketplaceActivationPlan),
    requirements: data.requirements.filter((requirement): requirement is string => typeof requirement === 'string'),
    activationId: typeof data.activationId === 'string' ? data.activationId : null,
    activationStatus: typeof data.activationStatus === 'string' ? (data.activationStatus as MarketplaceActivationPlan['activationStatus']) : null,
  };
}

export async function startActivation(request: StartMarketplaceActivationRequest): Promise<MarketplaceActivationState> {
  return activationStateOf(await ApiClient.post<unknown>(ACTIVATIONS_PATH, request), ACTIVATIONS_PATH);
}

export async function getActivation(id: string): Promise<MarketplaceActivationState> {
  return activationStateOf(await ApiClient.get<unknown>(activationPath(id)), `${ACTIVATIONS_PATH}/{id}`);
}

export async function importActivation(id: string): Promise<MarketplaceActivationState> {
  return activationStateOf(await ApiClient.post<unknown>(activationPath(id, '/import')), `${ACTIVATIONS_PATH}/{id}/import`);
}

export async function getActivationMapping(id: string): Promise<MarketplaceActivationMapping> {
  const path = `${ACTIVATIONS_PATH}/{id}/mapping`;
  const data = await ApiClient.get<unknown>(activationPath(id, '/mapping'));
  if (!isRecord(data) || !Array.isArray(data.channelRooms) || !Array.isArray(data.products)) throw new UnexpectedApiResponseError(path);
  return data as unknown as MarketplaceActivationMapping;
}

export async function saveActivationMapping(id: string, mappings: readonly MarketplaceRoomChoice[]): Promise<MarketplaceActivationState> {
  return activationStateOf(await ApiClient.put<unknown>(activationPath(id, '/mapping'), { mappings }), `${ACTIVATIONS_PATH}/{id}/mapping`);
}

export async function activateActivation(id: string): Promise<MarketplaceActivationState> {
  return activationStateOf(await ApiClient.post<unknown>(activationPath(id, '/activate')), `${ACTIVATIONS_PATH}/{id}/activate`);
}

function functionListOf(data: unknown, path: string): MarketplaceFunctionList {
  if (!isRecord(data) || !Array.isArray(data.functions)) throw new UnexpectedApiResponseError(path);
  return data as unknown as MarketplaceFunctionList;
}

export async function getLicensedFunctions(propertyId: string, language: MarketplaceLanguage): Promise<MarketplaceFunctionList> {
  return functionListOf(await ApiClient.get<unknown>(FUNCTIONS_PATH, { propertyId, lang: language }), FUNCTIONS_PATH);
}

export async function refreshLicensedFunctions(propertyId: string, language: MarketplaceLanguage): Promise<MarketplaceFunctionList> {
  const path = `${FUNCTIONS_PATH}/refresh`;
  return functionListOf(await ApiClient.post<unknown>(`${path}?lang=${language}`, { propertyId }), path);
}

export async function requestLicensedFunction(moduleCode: string, propertyId: string, language: MarketplaceLanguage): Promise<MarketplaceFunction> {
  const path = `${FUNCTIONS_PATH}/{moduleCode}/request`;
  const data = await ApiClient.post<unknown>(`${FUNCTIONS_PATH}/${encodeURIComponent(moduleCode)}/request?lang=${language}`, { propertyId });
  if (!isRecord(data) || typeof data.code !== 'string' || typeof data.status !== 'string') throw new UnexpectedApiResponseError(path);
  return data as unknown as MarketplaceFunction;
}

export async function getPartnerBrief(code: string, propertyId: string | undefined, language: MarketplaceLanguage): Promise<MarketplacePartnerBrief> {
  const path = `${PARTNERS_PATH}/{code}/brief`;
  const data = await ApiClient.get<unknown>(`${PARTNERS_PATH}/${encodeURIComponent(code)}/brief`, { propertyId, lang: language });
  if (!isRecord(data) || typeof data.websiteUrl !== 'string' || !Array.isArray(data.checklist)) throw new UnexpectedApiResponseError(path);
  return { ...(data as unknown as MarketplacePartnerBrief), propertyData: isRecord(data.propertyData) ? (data.propertyData as unknown as MarketplacePartnerBrief['propertyData']) : null };
}

export async function declarePartner(code: string, propertyId: string | undefined, declaredOn: string): Promise<MarketplacePartnerActivation> {
  const path = `${PARTNERS_PATH}/{code}/declare`;
  const data = await ApiClient.post<unknown>(`${PARTNERS_PATH}/${encodeURIComponent(code)}/declare`, { propertyId, declaredOn });
  if (!isRecord(data) || typeof data.activationId !== 'string' || typeof data.status !== 'string') throw new UnexpectedApiResponseError(path);
  return data as unknown as MarketplacePartnerActivation;
}

function activationChangeOf(data: unknown, path: string): MarketplaceActivationChange {
  if (!isRecord(data) || typeof data.activationId !== 'string' || typeof data.status !== 'string') throw new UnexpectedApiResponseError(path);

  return {
    ...(data as unknown as MarketplaceActivationChange),
    propertyId: typeof data.propertyId === 'string' ? data.propertyId : null,
    changeRequestedAt: typeof data.changeRequestedAt === 'string' ? data.changeRequestedAt : null,
  };
}

export async function updateActivationSettings(id: string, settings: UpdateMarketplaceSettingsRequest): Promise<MarketplaceActivationChange> {
  return activationChangeOf(await ApiClient.patch<unknown>(activationPath(id), settings), `${ACTIVATIONS_PATH}/{id}`);
}

export async function getDeactivationPreview(id: string, language: MarketplaceLanguage): Promise<MarketplaceDeactivationPreview> {
  const path = `${ACTIVATIONS_PATH}/{id}/deactivation-preview`;
  const data = await ApiClient.get<unknown>(activationPath(id, '/deactivation-preview'), { lang: language });
  if (!isRecord(data) || typeof data.activationId !== 'string' || !Array.isArray(data.effects)) throw new UnexpectedApiResponseError(path);

  const effects = data.effects.filter((effect): effect is string => typeof effect === 'string' && effect.trim() !== '');
  if (effects.length === 0 || effects.length !== data.effects.length) throw new UnexpectedApiResponseError(path);

  return {
    ...(data as unknown as MarketplaceDeactivationPreview),
    effects,
    name: typeof data.name === 'string' ? data.name : '',
    requiresConfirmation: data.requiresConfirmation !== false,
    guided: data.guided === true,
  };
}

/**
 * `POST /api/marketplace/activations/{id}/deactivate` with `confirmed: true`: a channel or a tool has its connection deleted on the channel manager and becomes `Deactivated`; for a
 * partner the host says it turned it off on the partner's site. The answer is the activation as it stands: only `Deactivated` is a deactivation. A function of the license is never
 * deactivated by CasaZen (422 `marketplace_change_not_supported`: ask for a change). 502: the channel manager or the channel failed and nothing was changed.
 */
export async function deactivateActivation(id: string): Promise<MarketplaceActivationChange> {
  return activationChangeOf(await ApiClient.post<unknown>(activationPath(id, '/deactivate'), { confirmed: true }), `${ACTIVATIONS_PATH}/{id}/deactivate`);
}

export async function requestFunctionChange(id: string): Promise<MarketplaceActivationChange> {
  return activationChangeOf(await ApiClient.post<unknown>(activationPath(id, '/change-request'), {}), `${ACTIVATIONS_PATH}/{id}/change-request`);
}
