import { ApiClient } from '@/api/client';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type {
  MarketplaceActiveResponse,
  MarketplaceCatalogEntry,
  MarketplaceCatalogResponse,
  MarketplaceEntryDetail,
  MarketplaceGroupId,
  MarketplaceLanguage,
} from '@/types';

const CATALOG_PATH = '/marketplace/catalog';
const ENTRIES_PATH = '/marketplace/entries';
const ACTIVE_PATH = '/marketplace/active';

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
