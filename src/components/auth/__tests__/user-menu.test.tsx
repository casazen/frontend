import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import { UserMenu } from '../user-menu';

vi.mock('@/hooks/use-auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: vi.fn() }));

function mockUser(user: { name?: string; email?: string } | undefined) {
  vi.mocked(useAuth).mockReturnValue({ user, logout: vi.fn() } as unknown as ReturnType<typeof useAuth>);
}

function renderMenu() {
  return render(
    <MemoryRouter>
      <UserMenu />
    </MemoryRouter>,
  );
}

describe('UserMenu trigger (UI-03, a11y)', () => {
  beforeEach(async () => {
    vi.mocked(useWorkspace).mockReturnValue({ activeContext: 'short-rent' } as unknown as ReturnType<typeof useWorkspace>);
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('UserMenuTrigger_UserWithName_HasAnAccessibleNameThatSaysWhoseMenuItIs', () => {
    mockUser({ name: 'Mario Rossi', email: 'mario@example.com' });
    renderMenu();

    const trigger = screen.getByRole('button', { name: 'Menu utente: Mario Rossi' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('UserMenuTrigger_UserWithoutName_UsesTheEmailAddress', () => {
    mockUser({ email: 'mario@example.com' });
    renderMenu();

    expect(screen.getByRole('button', { name: 'Menu utente: mario@example.com' })).toBeInTheDocument();
  });

  it('UserMenuTrigger_UserWithNeitherNameNorEmail_StillHasAName', () => {
    mockUser({});
    renderMenu();

    expect(screen.getByRole('button', { name: 'Menu utente' })).toBeInTheDocument();
  });

  it('UserMenuTrigger_EnglishUi_HasAnEnglishName', async () => {
    await i18n.changeLanguage('en');
    mockUser({ name: 'Mario Rossi' });
    renderMenu();

    expect(screen.getByRole('button', { name: 'User menu: Mario Rossi' })).toBeInTheDocument();
  });

  it('UserMenuTrigger_Rendered_ShowsAFocusRingAndIsAtLeast44PixelsWide', () => {
    mockUser({ name: 'Mario Rossi' });
    renderMenu();

    const trigger = screen.getByRole('button', { name: /Menu utente/ });
    // `focus:outline-none` alone, as before, left the keyboard user without any sign of where the focus is.
    expect(trigger).toHaveClass('focus-visible:ring-2', 'focus-visible:ring-ring');
    expect(trigger).toHaveClass('min-h-11', 'min-w-11');
  });

  it('UserMenuTrigger_NoUser_RendersNothing', () => {
    mockUser(undefined);
    const { container } = renderMenu();

    expect(container).toBeEmptyDOMElement();
  });
});
