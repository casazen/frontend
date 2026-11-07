import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { NotificationPreferencesLink } from '../components/notification-preferences-link';
import { ProfilePage } from '../profile-page';

vi.mock('@/components/layout/app-shell', () => ({ AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/layout/page-header', () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ isLoading: false, user: { name: 'Mario Rossi', email: 'mario@example.com', sub: 'auth0|1' } }),
}));
vi.mock('@/hooks/use-user-roles', () => ({ useUserRoles: () => ['PropertyOwner'] }));
vi.mock('@/queries/use-users', () => ({
  useMe: () => ({ data: { role: 'PropertyOwner', rentalType: 'ShortTerm', firstName: 'Mario', lastName: 'Rossi', email: 'mario@example.com' }, isLoading: false }),
}));

describe('the way from the profile to the notification settings (E05/F03/US02)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('NotificationPreferencesLink_Renders_LeadsToTheSettingsOfTheAlerts', () => {
    render(
      <MemoryRouter>
        <NotificationPreferencesLink />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Gestisci le notifiche' })).toHaveAttribute('href', '/app/short-rent/profile/notifications');
    expect(screen.getByText(/Scegli come e quando vuoi essere avvisato/)).toBeInTheDocument();
  });

  it('ProfilePage_Renders_KeepsItsTwoSectionsAndOffersTheLinkToTheNotifications', () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Informazioni profilo')).toBeInTheDocument();
    expect(screen.getByText('Tipo di operatore')).toBeInTheDocument();
    const card = screen.getByTestId('notification-preferences-link');
    expect(within(card).getByRole('link', { name: 'Gestisci le notifiche' })).toHaveAttribute('href', '/app/short-rent/profile/notifications');
  });
});
