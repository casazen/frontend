import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BottomNav } from '../bottom-nav';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';

vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: vi.fn(),
}));

vi.mock('@/store/ui-store', () => ({
  useUiStore: vi.fn((selector) => {
    const state = {
      sidebarOpen: false,
      toggleSidebar: vi.fn(),
      setSidebarOpen: vi.fn(),
    };
    return selector(state);
  }),
}));

import { useWorkspace } from '@/hooks/use-workspace';

function renderBottomNav(path = '/app/short-rent') {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[path]}>
        <BottomNav contextKey="short-rent" />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('BottomNav', () => {
  beforeEach(() => {
    vi.mocked(useWorkspace).mockReturnValue({
      contexts: [],
      activeContext: 'short-rent',
      isReady: true,
      setActiveContext: vi.fn(),
      hasPermission: vi.fn().mockReturnValue(true),
      getDefaultRoute: vi.fn(),
    });
  });

  it('renders primary tabs for short-rent', () => {
    renderBottomNav();
    expect(screen.getByRole('link', { name: /Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Prenotazioni/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Immobili/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Altro/i })).toBeInTheDocument();
  });

  it('hides Immobili tab when property.read permission is missing', () => {
    vi.mocked(useWorkspace).mockReturnValue({
      contexts: [],
      activeContext: 'short-rent',
      isReady: true,
      setActiveContext: vi.fn(),
      hasPermission: vi.fn((_ctx, permission) => permission !== 'property.read'),
      getDefaultRoute: vi.fn(),
    });

    renderBottomNav();
    expect(screen.queryByRole('link', { name: /Immobili/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Dashboard/i })).toBeInTheDocument();
  });

  it('marks bookings tab active on bookings list path', () => {
    renderBottomNav('/app/short-rent/bookings');
    const bookingsTab = screen.getByRole('link', { name: /Prenotazioni/i });
    expect(bookingsTab).toHaveAttribute('aria-current', 'page');
  });

  it('marks Altro active on secondary route', () => {
    renderBottomNav('/app/short-rent/payments');
    const moreTab = screen.getByRole('button', { name: /Altro/i });
    expect(moreTab).toHaveAttribute('aria-expanded', 'true');
  });
});
