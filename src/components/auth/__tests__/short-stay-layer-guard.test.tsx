import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ShortStayLayerGuard } from '../short-stay-layer-guard';

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/hooks/use-app-layer-context', () => ({
  useAppLayerContext: vi.fn(),
}));

import { useAuth } from '@/hooks/use-auth';
import { useAppLayerContext } from '@/hooks/use-app-layer-context';

function renderGuard(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<ShortStayLayerGuard />}>
          <Route path="/" element={<div>Short-stay content</div>} />
          <Route path="/bookings" element={<div>Bookings</div>} />
        </Route>
        <Route path="/leases" element={<div>Leases</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ShortStayLayerGuard', () => {
  it('redirects long-term-only users to /leases', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { roles: ['LongTermLandlord'] },
    } as ReturnType<typeof useAuth>);
    vi.mocked(useAppLayerContext).mockReturnValue({
      activeLayer: 'long-term',
      effectiveLayer: 'long-term',
      canSwitchLayer: false,
      setLayer: vi.fn(),
      getDefaultHomePath: () => '/leases',
    });

    renderGuard('/');
    expect(screen.getByText('Leases')).toBeInTheDocument();
  });

  it('redirects dual-role users in long-term layer to /leases', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { roles: ['PropertyOwner', 'LongTermLandlord'] },
    } as ReturnType<typeof useAuth>);
    vi.mocked(useAppLayerContext).mockReturnValue({
      activeLayer: 'long-term',
      effectiveLayer: 'long-term',
      canSwitchLayer: true,
      setLayer: vi.fn(),
      getDefaultHomePath: () => '/leases',
    });

    renderGuard('/bookings');
    expect(screen.getByText('Leases')).toBeInTheDocument();
  });

  it('allows dual-role users in short-stay layer', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { roles: ['PropertyOwner', 'LongTermLandlord'] },
    } as ReturnType<typeof useAuth>);
    vi.mocked(useAppLayerContext).mockReturnValue({
      activeLayer: 'short-stay',
      effectiveLayer: 'short-stay',
      canSwitchLayer: true,
      setLayer: vi.fn(),
      getDefaultHomePath: () => '/',
    });

    renderGuard('/');
    expect(screen.getByText('Short-stay content')).toBeInTheDocument();
  });

  it('allows property-owner-only users', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { roles: ['PropertyOwner'] },
    } as ReturnType<typeof useAuth>);
    vi.mocked(useAppLayerContext).mockReturnValue({
      activeLayer: 'short-stay',
      effectiveLayer: 'short-stay',
      canSwitchLayer: false,
      setLayer: vi.fn(),
      getDefaultHomePath: () => '/',
    });

    renderGuard('/');
    expect(screen.getByText('Short-stay content')).toBeInTheDocument();
  });
});
