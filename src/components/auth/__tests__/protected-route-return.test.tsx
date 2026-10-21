import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ProtectedRoute } from '../protected-route';

vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ isLoading: false, isAuthenticated: false }) }));
vi.mock('@/hooks/use-user-roles', () => ({ useUserRoles: () => [] }));
vi.mock('@/config/demo.config', () => ({ isDemoMode: false }));

function Location() { const location = useLocation(); return <div data-testid="login-query">{location.search}</div>; }

describe('protected email destination', () => {
  it('passes the complete lease destination to login without accessing the protected page', () => {
    const returnTo = '/app/long-rent/documents/upload?leaseId=0b6f7a3e-5a2d-4c58-9e0a-6c8b0f2e1d11';
    render(<MemoryRouter initialEntries={[returnTo]}><Routes>
      <Route path="/app/long-rent/documents/upload" element={<ProtectedRoute><p>protected upload</p></ProtectedRoute>} />
      <Route path="/login" element={<Location />} />
    </Routes></MemoryRouter>);
    const params = new URLSearchParams(screen.getByTestId('login-query').textContent!);
    expect(params.get('returnTo')).toBe(returnTo);
    expect(screen.queryByText('protected upload')).not.toBeInTheDocument();
  });
});
