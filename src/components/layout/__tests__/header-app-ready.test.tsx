import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { useWorkspace } from '@/hooks/use-workspace';
import { Header } from '../header';

vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: vi.fn() }));
// The parts of the header that read the user and the organisation are not under test.
vi.mock('@/components/auth/user-menu', () => ({ UserMenu: () => <div data-testid="user-menu" /> }));
vi.mock('@/components/org/org-badge', () => ({ OrgBadge: () => <div data-testid="org-badge" /> }));

function renderHeader(isReady: boolean) {
  vi.mocked(useWorkspace).mockReturnValue({ isReady } as unknown as ReturnType<typeof useWorkspace>);
  render(<Header />);
}

// The e2e logins (e2e/auth.setup.ts, e2e/helpers/auth.ts) wait for this id instead of for the title of a page, so that
// renaming a page ("Cruscotto" -> "Oggi") does not break them. Every shell shows the header, so it is the same in all areas.
describe('Header carries the app-ready test id (UI-00)', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('Header_WorkspaceReady_IsTheAppReadyElement', () => {
    renderHeader(true);

    expect(screen.getByTestId('app-ready')).toBe(screen.getByRole('banner'));
  });

  it('Header_WorkspaceStillLoading_IsNotAppReadyYet', () => {
    renderHeader(false);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.queryByTestId('app-ready')).not.toBeInTheDocument();
  });

  it('Header_WorkspaceReady_StillHasItsUsualParts', () => {
    renderHeader(true);

    // The language is no longer a switch of the header (UI-05): it is a row of the menu of the profile, which is the user menu.
    expect(screen.getByTestId('org-badge')).toBeInTheDocument();
    expect(screen.getByTestId('user-menu')).toBeInTheDocument();
  });
});
