import { useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { useCommercialProfile } from '@/hooks/use-commercial-profile';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { commercialPartAllowed } from './commercial-access';
import { planResumeHref } from './plan-resume';

const PARAM = 'planPart';
const INVENTORY_PARTS = ['octorateConnection', 'properties', 'channels', 'listings'] as const;
type InventoryPart = (typeof INVENTORY_PARTS)[number];

function isInventoryPart(value: unknown): value is InventoryPart {
  return INVENTORY_PARTS.some(part => part === value);
}

export function inventoryPlanPart(params: URLSearchParams): InventoryPart | null {
  const value = params.get(PARAM);
  return isInventoryPart(value) ? value : null;
}

/** Only inventory destinations that provide a way back receive the originating part. */
export function withPlanPart(to: string, part: unknown): string {
  if (!isInventoryPart(part)) return to;
  const [pathname, search] = to.split('?');
  if (!/^\/app\/short-rent\/(?:integrations\/octorate|channels|properties\/create|properties\/[^/]+\/edit)$/.test(pathname)) return to;
  const params = new URLSearchParams(search);
  params.set(PARAM, part);
  return `${pathname}?${params}`;
}

/** A return always points to a known section of this app's plan. A regular inventory visit keeps its original destination. */
export function usePlanReturn() {
  const [params] = useSearchParams();
  const part = inventoryPlanPart(params);
  const { flags } = useFeatureFlags();
  const workspace = useContext(WorkspaceContext);
  const profile = useCommercialProfile();
  return part && flags.octorateOnboarding && workspace?.hasPermission('short-rent', 'property.read') && commercialPartAllowed(profile, part)
    ? planResumeHref(part) : null;
}

/** The OAuth provider uses a fixed callback address. Carry only the originating part through that same-tab round trip. */
export function connectReturnScope(userId: string | undefined, orgId: string | undefined): string | null {
  return userId && orgId ? `casazen:octorate-plan-return:${encodeURIComponent(userId)}:${encodeURIComponent(orgId)}` : null;
}

export function rememberConnectReturn(scope: string | null, part: InventoryPart | null): void {
  if (!scope) return;
  try {
    if (part) sessionStorage.setItem(scope, JSON.stringify({ part, expiresAt: Date.now() + 60 * 60 * 1000 }));
    else sessionStorage.removeItem(scope);
  } catch { /* Storage-disabled browsers still return to the connection wizard. */ }
}

export function takeConnectReturn(scope: string | null): InventoryPart | null {
  if (!scope) return null;
  try {
    const raw = sessionStorage.getItem(scope);
    sessionStorage.removeItem(scope);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    return isInventoryPart(saved?.part) && Number.isFinite(saved.expiresAt) && saved.expiresAt > Date.now() ? saved.part : null;
  } catch { return null; }
}
