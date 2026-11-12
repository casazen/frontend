import { ApiClient } from '@/api/client';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type {
  MarketplaceActiveResponse,
  MarketplaceActivationMapping,
  MarketplaceActivationPlan,
  MarketplaceActivationState,
  MarketplaceCatalogEntry,
  MarketplaceCatalogResponse,
  MarketplaceConnectionKind,
  MarketplaceEntryDetail,
  MarketplaceFunction,
  MarketplaceFunctionList,
  MarketplaceGroupId,
  MarketplaceLanguage,
  MarketplacePartnerActivation,
  MarketplacePartnerBrief,
  MarketplaceRoomChoice,
  StartMarketplaceActivationRequest,
} from '@/types';

const CATALOG_PATH = '/marketplace/catalog';
const ENTRIES_PATH = '/marketplace/entries';
const ACTIVE_PATH = '/marketplace/active';
const ACTIVATIONS_PATH = '/marketplace/activations';
const FUNCTIONS_PATH = '/marketplace/functions';
const PARTNERS_PATH = '/marketplace/partners';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The id of a group as the page spells it (`salesChannels`), whether the backend wrote `salesChannels` or `SalesChannels`. */
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

/**
 * `GET /api/marketplace/entries/{kind}/{code}`: the data of the detail card. A card the organization may not see answers 404, which
 * the caller reads from the error (the card is not available for you).
 */
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

/** `GET /api/marketplace/active`: the integrations that are on (or waiting, or to fix) and the suppliers already used. */
export async function getMarketplaceActive(propertyId: string | undefined): Promise<MarketplaceActiveResponse> {
  const data = await ApiClient.get<MarketplaceActiveResponse | null | undefined>(ACTIVE_PATH, { propertyId });
  if (!isRecord(data) || !Array.isArray(data.integrations) || !Array.isArray(data.providers)) throw new UnexpectedApiResponseError(ACTIVE_PATH);

  return data;
}

/** The address of one activation (`…/{id}` and its steps). The id is what the server wrote, and is encoded all the same. */
const activationPath = (id: string, step = '') => `${ACTIVATIONS_PATH}/${encodeURIComponent(id)}${step}`;

/** An answer that is the state of an activation; anything else (the page of a proxy, say) is a load error, never a state. */
function activationStateOf(data: unknown, path: string): MarketplaceActivationState {
  if (!isRecord(data) || typeof data.activationId !== 'string' || typeof data.status !== 'string') throw new UnexpectedApiResponseError(path);
  return data as unknown as MarketplaceActivationState;
}

/**
 * `GET /api/marketplace/activations/plan`: what the portal asks of the person (`requirements`), whether the property is linked to the channel
 * manager, and the activation that exists already for this property and portal (`activationId`), to resume it. The plan is about one property.
 */
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

/**
 * `POST /api/marketplace/activations`: creates the connection on the channel manager and the activation (Pending). Starting again gives back the
 * activation that exists and creates nothing. `hotelId`, `username` and `password` travel in this one call and are not kept anywhere by CasaZen.
 */
export async function startActivation(request: StartMarketplaceActivationRequest): Promise<MarketplaceActivationState> {
  return activationStateOf(await ApiClient.post<unknown>(ACTIVATIONS_PATH, request), ACTIVATIONS_PATH);
}

/** `GET /api/marketplace/activations/{id}`: the state of the activation, read from the channel manager. */
export async function getActivation(id: string): Promise<MarketplaceActivationState> {
  return activationStateOf(await ApiClient.get<unknown>(activationPath(id)), `${ACTIVATIONS_PATH}/{id}`);
}

/** `POST /api/marketplace/activations/{id}/import`: asks the channel manager to import the rooms, the reservations and the calendar of the channel (it is asynchronous there). */
export async function importActivation(id: string): Promise<MarketplaceActivationState> {
  return activationStateOf(await ApiClient.post<unknown>(activationPath(id, '/import')), `${ACTIVATIONS_PATH}/{id}/import`);
}

/** `GET /api/marketplace/activations/{id}/mapping`: the rooms of the channel with the proposal of CasaZen for each, and the products of the listing. */
export async function getActivationMapping(id: string): Promise<MarketplaceActivationMapping> {
  const path = `${ACTIVATIONS_PATH}/{id}/mapping`;
  const data = await ApiClient.get<unknown>(activationPath(id, '/mapping'));
  if (!isRecord(data) || !Array.isArray(data.channelRooms) || !Array.isArray(data.products)) throw new UnexpectedApiResponseError(path);
  return data as unknown as MarketplaceActivationMapping;
}

/** `PUT /api/marketplace/activations/{id}/mapping`: saves the rooms the person chose. An empty list is a 422 at the server, never «all the rooms». */
export async function saveActivationMapping(id: string, mappings: readonly MarketplaceRoomChoice[]): Promise<MarketplaceActivationState> {
  return activationStateOf(await ApiClient.put<unknown>(activationPath(id, '/mapping'), { mappings }), `${ACTIVATIONS_PATH}/{id}/mapping`);
}

/** `POST /api/marketplace/activations/{id}/activate`: marks the connection connected and verifies it; Active only when the channel manager shows it working. */
export async function activateActivation(id: string): Promise<MarketplaceActivationState> {
  return activationStateOf(await ApiClient.post<unknown>(activationPath(id, '/activate')), `${ACTIVATIONS_PATH}/{id}/activate`);
}

/** The functions of the license of a property in the language of the page (the names and the request guidance come in it). */
function functionListOf(data: unknown, path: string): MarketplaceFunctionList {
  if (!isRecord(data) || !Array.isArray(data.functions)) throw new UnexpectedApiResponseError(path);
  return data as unknown as MarketplaceFunctionList;
}

/** `GET /api/marketplace/functions?propertyId=`: the twelve functions of the license of the property, the plan and the room limit of the last read. Nothing is asked of the channel manager. */
export async function getLicensedFunctions(propertyId: string, language: MarketplaceLanguage): Promise<MarketplaceFunctionList> {
  return functionListOf(await ApiClient.get<unknown>(FUNCTIONS_PATH, { propertyId, lang: language }), FUNCTIONS_PATH);
}

/** `POST /api/marketplace/functions/refresh`: reads the license of the property from the channel manager now and brings the requests in line with it. */
export async function refreshLicensedFunctions(propertyId: string, language: MarketplaceLanguage): Promise<MarketplaceFunctionList> {
  const path = `${FUNCTIONS_PATH}/refresh`;
  return functionListOf(await ApiClient.post<unknown>(`${path}?lang=${language}`, { propertyId }), path);
}

/**
 * `POST /api/marketplace/functions/{moduleCode}/request`: records that the host asked the channel manager for the function (status Requested, declared)
 * until the license shows it. CasaZen asks the channel manager nothing and never writes the license. Asking again gives back the request that exists.
 */
export async function requestLicensedFunction(moduleCode: string, propertyId: string, language: MarketplaceLanguage): Promise<MarketplaceFunction> {
  const path = `${FUNCTIONS_PATH}/{moduleCode}/request`;
  const data = await ApiClient.post<unknown>(`${FUNCTIONS_PATH}/${encodeURIComponent(moduleCode)}/request?lang=${language}`, { propertyId });
  if (!isRecord(data) || typeof data.code !== 'string' || typeof data.status !== 'string') throw new UnexpectedApiResponseError(path);
  return data as unknown as MarketplaceFunction;
}

/**
 * `GET /api/marketplace/partners/{code}/brief`: what the host takes to the partner's site: the checklist of what to choose and what to authorise there
 * and, with a property, the fixed list of its data the partner is likely to ask for. CasaZen sends nothing to the partner.
 */
export async function getPartnerBrief(code: string, propertyId: string | undefined, language: MarketplaceLanguage): Promise<MarketplacePartnerBrief> {
  const path = `${PARTNERS_PATH}/{code}/brief`;
  const data = await ApiClient.get<unknown>(`${PARTNERS_PATH}/${encodeURIComponent(code)}/brief`, { propertyId, lang: language });
  if (!isRecord(data) || typeof data.websiteUrl !== 'string' || !Array.isArray(data.checklist)) throw new UnexpectedApiResponseError(path);
  return { ...(data as unknown as MarketplacePartnerBrief), propertyData: isRecord(data.propertyData) ? (data.propertyData as unknown as MarketplacePartnerBrief['propertyData']) : null };
}

/**
 * `POST /api/marketplace/partners/{code}/declare`: records that the host activated the partner on the partner's own site, on the day it gives
 * (`declaredOn`, `YYYY-MM-DD`, today or earlier in Rome): Active and declared. Declaring again gives back the same activation.
 */
export async function declarePartner(code: string, propertyId: string | undefined, declaredOn: string): Promise<MarketplacePartnerActivation> {
  const path = `${PARTNERS_PATH}/{code}/declare`;
  const data = await ApiClient.post<unknown>(`${PARTNERS_PATH}/${encodeURIComponent(code)}/declare`, { propertyId, declaredOn });
  if (!isRecord(data) || typeof data.activationId !== 'string' || typeof data.status !== 'string') throw new UnexpectedApiResponseError(path);
  return data as unknown as MarketplacePartnerActivation;
}
