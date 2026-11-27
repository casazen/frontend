import { currentReturnTo } from '@/lib/auth-return-to';
import type { MarketplaceCardStatus, MarketplaceCatalogGroup, MarketplaceCatalogResponse, MarketplaceGroupId } from '@/types';
import {
  MARKETPLACE_ENTRY_PARAM,
  MARKETPLACE_MINE_PATH,
  MARKETPLACE_PROPERTY_PARAM,
  marketplaceActivationPath,
  marketplaceFunctionRequestPath,
  marketplaceHref,
  marketplacePartnerActivationPath,
} from './marketplace-paths';
import { withReturnTo } from './return-to';

export const CHANNEL_MANAGER_GROUP_IDS: readonly MarketplaceGroupId[] = ['salesChannels', 'connectedTools', 'channelManagerFunctions'];

export function findMarketplaceGroup(catalog: MarketplaceCatalogResponse | undefined, id: MarketplaceGroupId): MarketplaceCatalogGroup | undefined {
  return catalog?.groups.find((group) => group.id === id);
}

export function channelManagerAvailable(catalog: MarketplaceCatalogResponse): boolean {
  return catalog.octorate.enabled && catalog.octorate.connected;
}

export type MarketplaceCardActionKind = 'activate' | 'manage' | 'fix';

export interface MarketplaceCardAction {
  kind: MarketplaceCardActionKind;
  to: string;
}

export function marketplaceWizardPath(kind: string, code: string): string {
  switch (kind.toLowerCase()) {
    case 'licensedfunction':
      return marketplaceFunctionRequestPath(code);
    case 'partner':
      return marketplacePartnerActivationPath(code);
    default:
      return marketplaceActivationPath(kind, code);
  }
}

export function marketplaceReturnTarget(location: { pathname: string; search: string; hash: string }): string {
  const params = new URLSearchParams(location.search);
  if (location.pathname === MARKETPLACE_MINE_PATH && params.has(MARKETPLACE_ENTRY_PARAM)) {
    params.delete(MARKETPLACE_PROPERTY_PARAM);
  }
  params.delete(MARKETPLACE_ENTRY_PARAM);
  const search = params.toString();
  return currentReturnTo({ pathname: location.pathname, search: search ? `?${search}` : '', hash: location.hash });
}

function activationStart(kind: string, code: string, activationType: string | undefined): string {
  switch (activationType) {
    case 'api':
      return marketplaceActivationPath(kind, code);
    case 'licenseRequest':
      return marketplaceFunctionRequestPath(code);
    case 'partnerSite':
      return marketplacePartnerActivationPath(code);
    default:
      return marketplaceWizardPath(kind, code);
  }
}

export function marketplaceAction(
  entry: { kind: string; code: string; status: MarketplaceCardStatus; canActivate: boolean },
  propertyId: string | undefined,
  returnTo: string | null,
  activationType?: string,
): MarketplaceCardAction | null {
  if (entry.status === 'Active' || entry.status === 'Pending') {
    return { kind: 'manage', to: marketplaceHref(MARKETPLACE_MINE_PATH, propertyId) };
  }
  if (!entry.canActivate) return null;

  return {
    kind: entry.status === 'ToFix' ? 'fix' : 'activate',
    to: withReturnTo(marketplaceHref(activationStart(entry.kind, entry.code, activationType), propertyId), returnTo),
  };
}

export function marketplaceEntryValue(entry: { kind: string; code: string }): string {
  return `${entry.kind}:${entry.code}`;
}

const ENTRY_KIND = /^[A-Za-z]{1,32}$/;
const ENTRY_CODE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;

export function parseMarketplaceEntry(value: string | null | undefined): { kind: string; code: string } | null {
  if (!value) return null;
  const separator = value.indexOf(':');
  if (separator < 1) return null;
  const kind = value.slice(0, separator);
  const code = value.slice(separator + 1);
  return ENTRY_KIND.test(kind) && ENTRY_CODE.test(code) ? { kind, code } : null;
}

export function httpsUrlOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

export function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? '');
  return letters.join('').toLocaleUpperCase() || '?';
}
