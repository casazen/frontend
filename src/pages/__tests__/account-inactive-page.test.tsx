import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from '@/i18n/config';
import { useAuth } from '@/hooks/use-auth';
import { resolveSupportEmail } from '@/config/support.config';

const support = vi.hoisted(() => ({ email: null as string | null }));

vi.mock('@/hooks/use-auth', () => ({ useAuth: vi.fn() }));
vi.mock('@/config/support.config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/support.config')>();
  return {
    ...actual,
    supportConfig: {
      get email() {
        return support.email;
      },
    },
  };
});

import { AccountInactivePage } from '../account-inactive-page';

const logout = vi.fn();

function mockAuth() {
  vi.mocked(useAuth).mockReturnValue({
    isLoading: false,
    isAuthenticated: true,
    user: { email: 'host@example.com' },
    login: vi.fn(),
    logout,
    logoutToLogin: vi.fn(),
    forceReauth: vi.fn(),
    getAccessToken: vi.fn(),
    refreshAccessToken: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>);
}

describe('AccountInactivePage (PL-03)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    support.email = null;
    mockAuth();
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('AccountInactivePage_Rendered_ExplainsTheDeactivationAndLogsOut', () => {
    render(<AccountInactivePage />);

    expect(screen.getByText(i18n.t('shared.accountInactive.title'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('shared.accountInactive.description'))).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('shared.accountInactive.logout') }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('AccountInactivePage_SupportEmailConfigured_ShowsMailtoLink', () => {
    support.email = 'assistenza@casazen.test';

    render(<AccountInactivePage />);

    const link = screen.getByRole('link', { name: 'assistenza@casazen.test' });
    expect(link).toHaveAttribute('href', 'mailto:assistenza@casazen.test');
    expect(screen.queryByText(i18n.t('shared.accountInactive.supportGeneric'))).not.toBeInTheDocument();
  });

  it('AccountInactivePage_NoSupportEmail_ShowsGenericTextWithoutInventedAddress', () => {
    const { container } = render(<AccountInactivePage />);

    expect(screen.getByText(i18n.t('shared.accountInactive.supportGeneric'))).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(container.textContent).not.toContain('@');
  });

  it('AccountInactivePage_English_UsesEnglishTexts', async () => {
    await i18n.changeLanguage('en');

    render(<AccountInactivePage />);

    expect(screen.getByText('Account deactivated')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });
});

describe('resolveSupportEmail (PL-03)', () => {
  it('resolveSupportEmail_ValidAddress_ReturnsItTrimmed', () => {
    expect(resolveSupportEmail('  help@casazen.test ')).toBe('help@casazen.test');
  });

  it('resolveSupportEmail_MissingOrInvalid_ReturnsNull', () => {
    expect(resolveSupportEmail(undefined)).toBeNull();
    expect(resolveSupportEmail('')).toBeNull();
    expect(resolveSupportEmail('not-an-email')).toBeNull();
    expect(resolveSupportEmail('<script>@x.y')).toBeNull();
  });
});
