import { currentReturnTo } from '@/lib/auth-return-to';
import type { MarketplaceCardStatus, MarketplaceCatalogGroup, MarketplaceCatalogResponse, MarketplaceGroupId } from '@/types';
import {
  MARKETPLACE_ENTRY_PARAM,
  MARKETPLACE_MINE_PATH,
  marketplaceActivationPath,
  marketplaceFunctionRequestPath,
  marketplaceHref,
  marketplacePartnerActivationPath,
} from './marketplace-paths';
import { withReturnTo } from './return-to';

/** The groups that wait for the channel manager, in the order of MKT-01: without it they say so and lead to the page where it is connected. */
export const CHANNEL_MANAGER_GROUP_IDS: readonly MarketplaceGroupId[] = ['salesChannels', 'connectedTools', 'channelManagerFunctions'];

/** The group of a catalog, whatever the catalog says about the others. */
export function findMarketplaceGroup(catalog: MarketplaceCatalogResponse | undefined, id: MarketplaceGroupId): MarketplaceCatalogGroup | undefined {
  return catalog?.groups.find((group) => group.id === id);
}

/** The groups that wait for the channel manager have something to show only when it is available and connected. */
export function channelManagerAvailable(catalog: MarketplaceCatalogResponse): boolean {
  return catalog.octorate.enabled && catalog.octorate.connected;
}

/** What a card does: the one action it offers. */
export type MarketplaceCardActionKind = 'activate' | 'manage' | 'fix';

export interface MarketplaceCardAction {
  kind: MarketplaceCardActionKind;
  to: string;
}

/** Where the guided flow of an entry starts, by what the entry is: a channel or a tool, a function of the license, a partner. */
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

/**
 * `location` as the address a wizard should bring the person back to: the page they are on, without the detail card that may be open
 * on it (they come back to the list, not to a drawer).
 */
export function marketplaceReturnTarget(location: { pathname: string; search: string; hash: string }): string {
  const params = new URLSearchParams(location.search);
  params.delete(MARKETPLACE_ENTRY_PARAM);
  const search = params.toString();
  return currentReturnTo({ pathname: location.pathname, search: search ? `?${search}` : '', hash: location.hash });
}

/**
 * Where the guided flow of an entry starts, by how it is activated (the detail card knows: `api`, `licenseRequest`, `partnerSite`); an
 * activation type this page does not know falls back to what the entry is.
 */
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

/**
 * What the person can do with an integration that has this status: manage it, or start its wizard (to activate it, or to fix it). The
 * card of the page knows the kind of the entry; the detail card also knows the activation type, which then says where the wizard is.
 */
export function marketplaceAction(
  entry: { kind: string; code: string; status: MarketplaceCardStatus; canActivate: boolean },
  propertyId: string | undefined,
  returnTo: string | null,
  activationType?: string,
): MarketplaceCardAction | null {
  // On, or waiting for the channel manager: it is seen and managed in the Active tab. A second request would only duplicate it.
  if (entry.status === 'Active' || entry.status === 'Pending') {
    return { kind: 'manage', to: marketplaceHref(MARKETPLACE_MINE_PATH, propertyId) };
  }
  // The server says when a wizard cannot start (`reason`): there is no button then, and the page says why.
  if (!entry.canActivate) return null;

  return {
    kind: entry.status === 'ToFix' ? 'fix' : 'activate',
    to: withReturnTo(marketplaceHref(activationStart(entry.kind, entry.code, activationType), propertyId), returnTo),
  };
}

/** The value of the `entry` parameter that names an entry: `Channel:AIRBNB`. */
export function marketplaceEntryValue(entry: { kind: string; code: string }): string {
  return `${entry.kind}:${entry.code}`;
}

/** What the address can name: a kind is a word, a code is letters, digits, `_`, `-` and `.`. Nothing that could carry a path or a query. */
const ENTRY_KIND = /^[A-Za-z]{1,32}$/;
const ENTRY_CODE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;

/**
 * The entry that `?entry=<kind>:<code>` names, or `null` for anything else: the parameter is typed, pasted and shared, and the kind and
 * the code end up in the path of a request (`GET /api/marketplace/entries/{kind}/{code}`).
 */
export function parseMarketplaceEntry(value: string | null | undefined): { kind: string; code: string } | null {
  if (!value) return null;
  const separator = value.indexOf(':');
  if (separator < 1) return null;
  const kind = value.slice(0, separator);
  const code = value.slice(separator + 1);
  return ENTRY_KIND.test(kind) && ENTRY_CODE.test(code) ? { kind, code } : null;
}

/** `value` when it is an absolute `https` address, else `null`: the logos and the sites come from the catalog, which an administrator fills. */
export function httpsUrlOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

/** The first letters of the first two words of a name: what a card shows when it has no logo. */
export function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? '');
  return letters.join('').toLocaleUpperCase() || '?';
}
