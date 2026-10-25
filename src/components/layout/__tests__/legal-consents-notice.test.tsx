import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { ROLES_CLAIM } from '@/lib/auth-roles';
import { LegalConsentsNotice } from '../legal-consents-notice';

const session = vi.hoisted(() => ({
  auth: null as Record<string, unknown> | null,
  profile: null as Record<string, unknown> | null,
}));

vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ user: session.auth }) }));
vi.mock('@/queries/use-users', () => ({ useCurrentUser: () => ({ user: session.profile }) }));

const ADMIN = { [ROLES_CLAIM]: ['Admin'] };
const OWNER = { [ROLES_CLAIM]: ['PropertyOwner'] };
const ORG_WITHOUT_CONSENTS = { orgId: 'org-1', onboardingCompletedAt: '2026-09-01T10:00:00Z', consentsAccepted: false };

/** Draws the notice for the session as it is now; says whether it showed, and takes it away again. */
function isShown(): boolean {
  const view = render(
    <MemoryRouter>
      <LegalConsentsNotice />
    </MemoryRouter>,
  );
  const shown = screen.queryByTestId('legal-consents-notice') !== null;
  view.unmount();
  return shown;
}

describe('LegalConsentsNotice (LR-WIZ-1)', () => {
  beforeEach(async () => {
    session.auth = null;
    session.profile = null;
    await i18n.changeLanguage('it');
  });

  it('is shown only to a platform administrator who has an organization whose current legal documents are not accepted, and leads to the page where they are', () => {
    session.auth = ADMIN;
    session.profile = ORG_WITHOUT_CONSENTS;
    const view = render(
      <MemoryRouter>
        <LegalConsentsNotice />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('legal-consents-notice')).toHaveTextContent('Documenti legali aggiornati: accettali per rivedere i tuoi spazi di lavoro');
    expect(screen.getByRole('link', { name: i18n.t('leaseWizardGuide.adminNotice.action') })).toHaveAttribute('href', '/onboarding');
    view.unmount();

    // Not an administrator: an owner is sent to the consents by the guard, there is nothing to add.
    session.auth = OWNER;
    expect(isShown()).toBe(false);

    // An administrator with no organization of their own: no workspace as an owner is lost.
    session.auth = ADMIN;
    session.profile = { ...ORG_WITHOUT_CONSENTS, orgId: null };
    expect(isShown()).toBe(false);

    // The documents are accepted, or the backend does not say (an older one): nothing to ask.
    for (const consentsAccepted of [true, null, undefined]) {
      session.profile = { ...ORG_WITHOUT_CONSENTS, consentsAccepted };
      expect(isShown()).toBe(false);
    }
  });
});
