import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { WorkspaceSwitcher } from '../workspace-switcher';
import i18n from '@/i18n/config';

vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: vi.fn(),
}));

import { useWorkspace } from '@/hooks/use-workspace';

function renderSwitcher() {
  return render(
    <I18nextProvider i18n={i18n}>
      <WorkspaceSwitcher />
    </I18nextProvider>,
  );
}

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

    const { container } = renderSwitcher();
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

    renderSwitcher();
    fireEvent.click(screen.getByRole('tab', { name: 'Affitti lungo termine' }));
    expect(setActiveContext).toHaveBeenCalledWith('long-rent');
  });

  it('shows icon tabs with tooltip title from display name', () => {
    vi.mocked(useWorkspace).mockReturnValue({
      contexts: [
        { contextKey: 'short-rent', displayName: 'Affitti brevi', roleKey: 'property_owner', permissions: [], defaultRoute: '/app/short-rent' },
        { contextKey: 'long-rent', displayName: 'Affitti lungo termine', roleKey: 'long_term_landlord', permissions: [], defaultRoute: '/app/long-rent/leases' },
      ],
      activeContext: 'short-rent',
      isReady: true,
      setActiveContext: vi.fn(),
      hasPermission: vi.fn(),
      getDefaultRoute: vi.fn(),
    });

    renderSwitcher();
    const longTermTab = screen.getByRole('tab', { name: 'Affitti lungo termine' });
    expect(longTermTab).toHaveAttribute('title', 'Affitti lungo termine');
  });
});
