import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BottomNav } from '../bottom-nav';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import type { AppContextKey } from '@/config/route-manifest';

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
    expect(screen.getByRole('link', { name: /Cruscotto|Dashboard/i })).toBeInTheDocument();
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
    expect(screen.getByRole('link', { name: /Cruscotto|Dashboard/i })).toBeInTheDocument();
  });

  it('marks bookings tab active on bookings list path', () => {
    renderBottomNav('/app/short-rent/bookings');
    const bookingsTab = screen.getByRole('link', { name: /Prenotazioni/i });
    expect(bookingsTab).toHaveAttribute('aria-current', 'page');
  });

  it('marks Altro active on a page the bar does not list', () => {
    // Incassi is a main entry of the menu but not one of the four destinations of the bar (UI-04a).
    renderBottomNav('/app/short-rent/payments');
    const moreTab = screen.getByRole('button', { name: /Altro/i });
    expect(moreTab).toHaveAttribute('aria-expanded', 'true');
  });
});

// UI-04a: the bar lists the destinations the manifest marks with `navBottom` (at most four) and "Altro" for the rest; the
// bar itself is redrawn by UI-04b.
describe('BottomNav destinations (UI-04a)', () => {
  function arrange(hasPermission: (ctx: string, permission: string) => boolean = () => true) {
    vi.mocked(useWorkspace).mockReturnValue({
      contexts: [],
      activeContext: 'short-rent',
      isReady: true,
      setActiveContext: vi.fn(),
      hasPermission: vi.fn(hasPermission),
      getDefaultRoute: vi.fn(),
    });
  }

  function renderBar(contextKey: AppContextKey, path: string) {
    return render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[path]}>
          <BottomNav contextKey={contextKey} />
        </MemoryRouter>
      </I18nextProvider>,
    );
  }

  const bar = () => screen.getByRole('navigation', { name: 'Navigazione mobile' });
  const labels = () => within(bar()).getAllByRole('link').map((link) => link.textContent);

  beforeEach(() => {
    arrange();
  });

  it('lists four destinations and Altro for short-rent, not every main entry of the menu', () => {
    renderBar('short-rent', '/app/short-rent');

    expect(labels()).toEqual(['Cruscotto', 'Calendario', 'Prenotazioni', 'Immobili']);
    expect(within(bar()).getByRole('button', { name: 'Altro' })).toBeInTheDocument();
    for (const name of ['Sito di prenotazione', 'Marketplace', 'Incassi']) {
      expect(within(bar()).queryByRole('link', { name })).not.toBeInTheDocument();
    }
  });

  it('keeps every area to four destinations at most', () => {
    renderBar('admin', '/app/admin');
    expect(labels()).toEqual(['Cruscotto', 'Utenti', 'Fornitori', 'Processi']);
    cleanup();

    renderBar('supplier', '/app/supplier/dashboard');
    expect(labels()).toEqual(['Dashboard', 'Richieste', 'Disponibilità', 'Vetrina']);
  });

  it('lists only the two destinations long-rent has', () => {
    renderBar('long-rent', '/app/long-rent/leases');

    expect(labels()).toEqual(['Contratti', 'Immobili']);
    expect(within(bar()).getByRole('button', { name: 'Altro' })).toBeInTheDocument();
  });

  it('marks the destination a page hangs from, not Altro', () => {
    // The iCal calendar of the supplier hangs from the availability, which is a destination of the bar.
    renderBar('supplier', '/app/supplier/calendar');

    expect(within(bar()).getByRole('link', { name: 'Disponibilità' })).toHaveAttribute('aria-current', 'page');
    expect(within(bar()).getByRole('button', { name: 'Altro' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('marks Altro for a page that hangs from an entry the bar does not list', () => {
    renderBar('short-rent', '/app/short-rent/alloggiati');

    expect(within(bar()).getByRole('button', { name: 'Altro' })).toHaveAttribute('aria-expanded', 'true');
    for (const link of within(bar()).getAllByRole('link')) {
      expect(link).not.toHaveAttribute('aria-current');
    }
  });

  it('marks the destination on the pages of the entry', () => {
    renderBar('short-rent', '/app/short-rent/properties/p1/pricing');

    expect(within(bar()).getByRole('link', { name: 'Immobili' })).toHaveAttribute('aria-current', 'page');
  });

  it('leaves out a destination the user cannot open', () => {
    arrange((_ctx, permission) => permission !== 'booking.read');
    renderBar('short-rent', '/app/short-rent');

    expect(labels()).toEqual(['Cruscotto', 'Immobili']);
  });

  it('shows no bar when the user has no destination', () => {
    arrange(() => false);
    const { container } = renderBar('admin', '/app/admin');

    expect(container).toBeEmptyDOMElement();
  });
});
