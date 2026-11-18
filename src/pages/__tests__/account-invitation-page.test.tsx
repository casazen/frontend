import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { AccountInvitationPage } from '../account-invitation-page';

const auth = vi.hoisted(() => ({ kind: 'auth0', isLoading: false, login: vi.fn() }));
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => auth }));

const token = 'ab'.repeat(32);
const fragment = `#organization=org_case123&invitation=inv_ticket123&flow=owner&token=${token}`;

function open(fragment: string) {
  const url = '/attiva-invito' + fragment;
  window.history.replaceState({}, '', url);
  return render(<MemoryRouter initialEntries={[url]}><AccountInvitationPage /></MemoryRouter>);
}

describe('activation from an account invitation email', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    auth.kind = 'auth0';
    auth.login.mockReset();
  });

  it('retries a rejected handoff with the same invitation and blocks a second click while redirecting', async () => {
    auth.login.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    open(fragment);
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('login.handoffFailed'));
    expect(window.location.hash).toBe('');
    const retry = screen.getByRole('button', { name: i18n.t('invitation.retry') });
    fireEvent.click(retry);
    expect(retry).toBeDisabled();
    fireEvent.click(retry);
    expect(auth.login).toHaveBeenCalledTimes(2);
    expect(auth.login.mock.calls[0][0]).toEqual({
      authorizationParams: { organization: 'org_case123', invitation: 'inv_ticket123' },
      returnTo: '/portale-proprietari/invito',
      appState: { ownerInvitation: token },
    });
    expect(auth.login.mock.calls[1]).toEqual(auth.login.mock.calls[0]);
  });

  it.each(['', '#organization=invalid'])('points back to the original email when the fragment is absent or invalid', value => {
    open(value);
    expect(screen.getByText(i18n.t('invitation.unusable.invalid.description'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: i18n.t('invitation.unusable.goToApp') })).toHaveAttribute('href', '/');
    expect(window.location.hash).toBe('');
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('shows a way back when the current build cannot activate accounts', () => {
    auth.kind = 'demo';
    open(fragment);
    expect(screen.getByText(i18n.t('invitation.unavailable.title'))).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/');
    expect(auth.login).not.toHaveBeenCalled();
  });
});
