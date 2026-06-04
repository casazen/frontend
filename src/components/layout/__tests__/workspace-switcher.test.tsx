import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkspaceSwitcher } from '../workspace-switcher';

vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: vi.fn(),
}));

import { useWorkspace } from '@/hooks/use-workspace';

describe('WorkspaceSwitcher', () => {
  it('renders nothing for single context', () => {
    vi.mocked(useWorkspace).mockReturnValue({
      contexts: [
        { contextKey: 'short-rent', displayName: 'Affitti brevi', roleKey: 'property_owner', permissions: [], defaultRoute: '/app/short-rent' },
      ],
      activeContext: 'short-rent',
      isReady: true,
      setActiveContext: vi.fn(),
      hasPermission: vi.fn(),
      getDefaultRoute: vi.fn(),
    });

    const { container } = render(<WorkspaceSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });

  it('switches context when tab is clicked', () => {
    const setActiveContext = vi.fn();
    vi.mocked(useWorkspace).mockReturnValue({
      contexts: [
        { contextKey: 'short-rent', displayName: 'Affitti brevi', roleKey: 'property_owner', permissions: [], defaultRoute: '/app/short-rent' },
        { contextKey: 'long-rent', displayName: 'Affitti lungo termine', roleKey: 'long_term_landlord', permissions: [], defaultRoute: '/app/long-rent/leases' },
      ],
      activeContext: 'short-rent',
      isReady: true,
      setActiveContext,
      hasPermission: vi.fn(),
      getDefaultRoute: vi.fn(),
    });

    render(<WorkspaceSwitcher />);
    fireEvent.click(screen.getByRole('tab', { name: 'Affitti lungo termine' }));
    expect(setActiveContext).toHaveBeenCalledWith('long-rent');
  });
});
