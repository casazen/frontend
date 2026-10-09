import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ContextBootstrapDto } from '@/api/contexts';
import type { FeatureFlags } from '@/config/feature-flags';
import {
  ROUTE_MANIFEST,
  getVisibleNavEntries,
  type AppContextKey,
  type PermissionPredicate,
} from '@/config/route-manifest';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { useMobileNav } from '../use-mobile-nav';

vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: vi.fn() }));
vi.mock('@/hooks/use-feature-flags', () => ({ useFeatureFlags: vi.fn() }));

/**
 * UI-05 takes the menu button out of the header: on a phone the menu is "Altro" of the bottom bar, and only the bar has it.
 * So a user must never be left with pages in the menus and no bar to open them from, whatever the role: the bar is drawn
 * (`hasBar`) whenever there is a destination or something behind "Altro", and "Altro" is there whenever something is behind it.
 */
const CONTEXTS: AppContextKey[] = ['short-rent', 'long-rent', 'supplier', 'admin'];

const FLAGS_OFF: FeatureFlags = { otaPartnerApi: false, aiSupplierDiscovery: false, rliProvider: false, eSignProvider: false };
const FLAGS_ON: FeatureFlags = { otaPartnerApi: true, aiSupplierDiscovery: true, rliProvider: true, eSignProvider: true };

function permissionsOf(context: AppContextKey): string[] {
  const permissions = new Set<string>(['org.billing.admin']);
  for (const entry of ROUTE_MANIFEST.filter((candidate) => candidate.context === context)) {
    entry.requiredPermissions.forEach((permission) => permissions.add(permission));
  }
  return [...permissions].sort();
}

interface Scenario {
  name: string;
  hasPermission: PermissionPredicate;
  flags: FeatureFlags;
}

/** Everything a role can look like: all the permissions, none, each one taken away, each one alone; with the flags off and on. */
function scenariosFor(context: AppContextKey): Scenario[] {
  const permissions = permissionsOf(context);
  const scenarios: Scenario[] = [];
  for (const [flagsName, flags] of [['flags off', FLAGS_OFF], ['flags on', FLAGS_ON]] as const) {
    scenarios.push({ name: `everything allowed, ${flagsName}`, hasPermission: () => true, flags });
    scenarios.push({ name: `nothing allowed, ${flagsName}`, hasPermission: () => false, flags });
    for (const missing of permissions) {
      scenarios.push({ name: `without ${missing}, ${flagsName}`, hasPermission: (_ctx, permission) => permission !== missing, flags });
      scenarios.push({ name: `only ${missing}, ${flagsName}`, hasPermission: (_ctx, permission) => permission === missing, flags });
    }
  }
  return scenarios;
}

function arrange(context: AppContextKey, scenario: Scenario, areas: AppContextKey[] = [context]) {
  const contexts: ContextBootstrapDto[] = areas.map((contextKey) => ({
    contextKey,
    displayName: contextKey,
    roleKey: contextKey,
    permissions: [],
    defaultRoute: `/app/${contextKey}`,
  }));
  vi.mocked(useWorkspace).mockReturnValue({
    contexts,
    activeContext: context,
    isReady: true,
    setActiveContext: vi.fn(),
    hasPermission: scenario.hasPermission,
    getDefaultRoute: (key) => `/app/${key}`,
  });
  vi.mocked(useFeatureFlags).mockReturnValue({ flags: scenario.flags, isLoading: false });
}

function run(context: AppContextKey) {
  return renderHook(() => useMobileNav(context), {
    wrapper: ({ children }) => <MemoryRouter initialEntries={[`/app/${context}`]}>{children}</MemoryRouter>,
  }).result.current;
}

describe('a phone reaches every page through the bottom bar (UI-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(CONTEXTS)('PhoneReach_%s_WherePagesAreInTheMenusTheBarIsDrawnWithAltro', (context) => {
    const wrong: string[] = [];

    for (const scenario of scenariosFor(context)) {
      arrange(context, scenario);
      const visible = getVisibleNavEntries(context, scenario.hasPermission, scenario.flags);
      const nav = run(context);
      const behindAltro = visible.some((entry) => entry.navBottom === undefined);

      if (visible.length > 0 && !nav.hasBar) wrong.push(`${scenario.name}: pages in the menus and no bar`);
      if (behindAltro && !nav.hasMore) wrong.push(`${scenario.name}: pages behind "Altro" and no "Altro"`);
      if (visible.length === 0 && nav.hasBar) wrong.push(`${scenario.name}: a bar with nothing to open`);
    }

    expect(wrong).toEqual([]);
  });

  it('PhoneReach_UserWithNoDestinationButSeveralAreas_StillHasTheBarToChangeArea', () => {
    arrange('admin', { name: 'nothing', hasPermission: () => false, flags: FLAGS_OFF }, ['admin', 'long-rent']);

    const nav = run('admin');

    expect(nav.bottomEntries).toEqual([]);
    expect(nav.hasMore).toBe(true);
    expect(nav.hasBar).toBe(true);
  });

  it('PhoneReach_UserWithNothingAtAllInASingleArea_HasNoBarToDraw', () => {
    arrange('admin', { name: 'nothing', hasPermission: () => false, flags: FLAGS_OFF });

    const nav = run('admin');

    expect(nav.hasBar).toBe(false);
  });

  it('PhoneReach_FullRole_HasFourDestinationsAndAltro', () => {
    arrange('short-rent', { name: 'all', hasPermission: () => true, flags: FLAGS_OFF });

    const nav = run('short-rent');

    expect(nav.bottomEntries).toHaveLength(4);
    expect(nav.hasBar).toBe(true);
    expect(nav.hasMore).toBe(true);
  });
});
