import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { AppContextKey } from '@/config/route-manifest';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import { UserMenu } from '../user-menu';

vi.mock('@/hooks/use-auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: vi.fn() }));

/** Where the router is, so that the test sees where "Profilo" leads. */
function Address() {
  const { pathname } = useLocation();
  return <p data-testid="address">{pathname}</p>;
}

function renderMenu(activeContext: AppContextKey | null) {
  vi.mocked(useAuth).mockReturnValue({
    user: { name: 'Mario Rossi', email: 'mario@example.com' },
    logout: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>);
  vi.mocked(useWorkspace).mockReturnValue({ activeContext } as unknown as ReturnType<typeof useWorkspace>);
  render(
    <MemoryRouter initialEntries={['/start']}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <UserMenu />
              <Address />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

async function chooseProfile() {
  // The menu opens from the keyboard: Radix opens it on pointer-down otherwise, which jsdom cannot send.
  fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
  fireEvent.click(await screen.findByRole('menuitem', { name: i18n.t('shared.userMenu.profile') }));
}

describe('UserMenu profile link (UI-00)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it.each([
    ['short-rent', '/app/short-rent/profile'],
    ['long-rent', '/app/long-rent/profile'],
    ['admin', '/app/admin/profile'],
    ['supplier', '/app/supplier/profile'],
  ] as const)('UserMenuProfile_ActiveArea_%s_OpensThePathOfThatArea', async (area, path) => {
    renderMenu(area);

    await chooseProfile();

    expect(screen.getByTestId('address')).toHaveTextContent(path);
  });

  it('UserMenuProfile_NoActiveArea_OpensTheShortRentProfile', async () => {
    renderMenu(null);

    await chooseProfile();

    expect(screen.getByTestId('address')).toHaveTextContent('/app/short-rent/profile');
  });
});
