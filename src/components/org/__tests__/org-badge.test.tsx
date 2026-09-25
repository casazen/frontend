import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { WorkspaceContext, type WorkspaceContextValue } from '@/contexts/workspace-context';
import type { AppContextKey } from '@/config/route-manifest';
import { OrgBadge } from '../org-badge';
import { PlanBadge } from '../plan-badge';
import * as useUsers from '@/queries/use-users';

vi.mock('@/queries/use-users');

const mocked = vi.mocked(useUsers);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mockOrg(planTier: 'Starter' | 'Pro' | 'Scale' = 'Pro') {
  mocked.useCurrentUser.mockReturnValue({
    org: { id: 'o1', name: 'Acme Stays', slug: 'acme-stays', planTier },
    planTier,
    user: null,
    isLoading: false,
  } as unknown as ReturnType<typeof useUsers.useCurrentUser>);
}

function workspace(contextKeys: AppContextKey[]): WorkspaceContextValue {
  return {
    contexts: contextKeys.map((contextKey) => ({
      contextKey,
      displayName: contextKey,
      roleKey: contextKey,
      permissions: [],
      defaultRoute: `/app/${contextKey}`,
    })),
    activeContext: contextKeys[0] ?? null,
    isReady: true,
    setActiveContext: vi.fn(),
    hasPermission: vi.fn().mockReturnValue(true),
    getDefaultRoute: vi.fn(),
  };
}

/** The badge as the header of the shell at `path` draws it, for a user working in `contexts`. */
function renderInShell(path: string, contexts: AppContextKey[]) {
  return render(
    <WorkspaceContext.Provider value={workspace(contexts)}>
      <MemoryRouter initialEntries={[path]}>
        <OrgBadge />
      </MemoryRouter>
    </WorkspaceContext.Provider>,
  );
}

describe('OrgBadge (#202 AC11)', () => {
  it('renders the org name and plan badge when the caller has an org', () => {
    mockOrg('Pro');

    renderInShell('/app/short-rent', ['short-rent']);

    expect(screen.getByTestId('org-badge')).toBeInTheDocument();
    expect(screen.getByText('Acme Stays')).toBeInTheDocument();
    expect(screen.getByTestId('plan-badge')).toHaveTextContent(i18n.t('plan.tier.Pro'));
  });

  it('renders nothing while the current user is loading', () => {
    mocked.useCurrentUser.mockReturnValue({
      org: null,
      planTier: null,
      user: null,
      isLoading: true,
    } as unknown as ReturnType<typeof useUsers.useCurrentUser>);

    const { container } = renderInShell('/app/short-rent', ['short-rent']);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the caller has no org yet (pre-backfill safety)', () => {
    mocked.useCurrentUser.mockReturnValue({
      org: null,
      planTier: null,
      user: null,
      isLoading: false,
    } as unknown as ReturnType<typeof useUsers.useCurrentUser>);

    const { container } = renderInShell('/app/short-rent', ['short-rent']);
    expect(container).toBeEmptyDOMElement();
  });
});

// PL-16 (A1-36): the badge opens the plan page of the shell it is drawn in, never always the short-rent one.
describe('OrgBadge plan link per shell', () => {
  it('OrgBadge_InTheLongRentShell_LinksToTheLongRentPlanPage', () => {
    mockOrg();

    renderInShell('/app/long-rent/leases', ['long-rent']);

    expect(screen.getByTestId('org-badge')).toHaveAttribute('href', '/app/long-rent/settings/plan');
  });

  it('OrgBadge_InTheShortRentShell_LinksToTheShortRentPlanPage', () => {
    mockOrg();

    renderInShell('/app/short-rent/properties', ['short-rent', 'long-rent']);

    expect(screen.getByTestId('org-badge')).toHaveAttribute('href', '/app/short-rent/settings/plan');
  });

  it('OrgBadge_InTheAdminShell_LinksToThePlanPageOfTheUsersRentalContext', () => {
    mockOrg();

    renderInShell('/app/admin/users', ['admin', 'long-rent']);

    expect(screen.getByTestId('org-badge')).toHaveAttribute('href', '/app/long-rent/settings/plan');
  });

  it('OrgBadge_UserWithoutRentalContext_ShowsThePlanWithoutALink', () => {
    mockOrg();

    renderInShell('/app/admin', ['admin']);

    const badge = screen.getByTestId('org-badge');
    expect(badge.tagName).not.toBe('A');
    expect(badge).not.toHaveAttribute('href');
    expect(screen.getByTestId('plan-badge')).toHaveTextContent(i18n.t('plan.tier.Pro'));
  });

  it('OrgBadge_Tier_IsTheTranslatedLabelNotTheRawValue', () => {
    mockOrg('Scale');
    const original = i18n.t('plan.tier.Scale');
    i18n.addResource(i18n.language, 'translation', 'plan.tier.Scale', 'Scale (tradotto)');
    try {
      renderInShell('/app/long-rent/leases', ['long-rent']);

      expect(screen.getByTestId('plan-badge')).toHaveTextContent('Scale (tradotto)');
    } finally {
      i18n.addResource(i18n.language, 'translation', 'plan.tier.Scale', original);
    }
  });
});

describe('PlanBadge (#202 AC11)', () => {
  it('renders the tier label for each plan', () => {
    const { rerender } = render(<PlanBadge planTier="Starter" />);
    expect(screen.getByTestId('plan-badge')).toHaveTextContent(i18n.t('plan.tier.Starter'));

    rerender(<PlanBadge planTier="Scale" />);
    expect(screen.getByTestId('plan-badge')).toHaveTextContent(i18n.t('plan.tier.Scale'));
  });
});
