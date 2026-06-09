import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OrgBadge } from '../org-badge';
import { PlanBadge } from '../plan-badge';
import * as useUsers from '@/queries/use-users';

vi.mock('@/queries/use-users');

const mocked = vi.mocked(useUsers);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('OrgBadge (#202 AC11)', () => {
  it('renders the org name and plan badge when the caller has an org', () => {
    mocked.useCurrentUser.mockReturnValue({
      org: { id: 'o1', name: 'Acme Stays', slug: 'acme-stays', planTier: 'Pro' },
      planTier: 'Pro',
      user: null,
      isLoading: false,
    } as unknown as ReturnType<typeof useUsers.useCurrentUser>);

    render(
      <MemoryRouter>
        <OrgBadge />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('org-badge')).toBeInTheDocument();
    expect(screen.getByText('Acme Stays')).toBeInTheDocument();
    expect(screen.getByTestId('plan-badge')).toHaveTextContent('Pro');
  });

  it('renders nothing while the current user is loading', () => {
    mocked.useCurrentUser.mockReturnValue({
      org: null,
      planTier: null,
      user: null,
      isLoading: true,
    } as unknown as ReturnType<typeof useUsers.useCurrentUser>);

    const { container } = render(<OrgBadge />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the caller has no org yet (pre-backfill safety)', () => {
    mocked.useCurrentUser.mockReturnValue({
      org: null,
      planTier: null,
      user: null,
      isLoading: false,
    } as unknown as ReturnType<typeof useUsers.useCurrentUser>);

    const { container } = render(<OrgBadge />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('PlanBadge (#202 AC11)', () => {
  it('renders the tier label for each plan', () => {
    const { rerender } = render(<PlanBadge planTier="Starter" />);
    expect(screen.getByTestId('plan-badge')).toHaveTextContent('Starter');

    rerender(<PlanBadge planTier="Scale" />);
    expect(screen.getByTestId('plan-badge')).toHaveTextContent('Scale');
  });
});
