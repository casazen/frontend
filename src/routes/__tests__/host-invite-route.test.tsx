import { isValidElement } from 'react';
import { describe, expect, it } from 'vitest';
import { matchRoutes } from 'react-router-dom';
import { OnboardingGuard } from '@/components/auth/onboarding-guard';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { HostInvitePage } from '@/pages/host-invite-page';
import { appRoutes } from '@/routes';

describe('route /invito-host/:token', () => {
  const matches = matchRoutes(appRoutes, '/invito-host/token-del-link');

  it('Route_InviteLink_ShowsTheInvitePageWithTheTokenAsParam', () => {
    const last = matches?.at(-1);

    expect(last?.params.token).toBe('token-del-link');
    expect(isValidElement(last?.route.element) && last?.route.element.type).toBe(HostInvitePage);
  });

  it('Route_InviteLink_IsOutsideTheOnboardingGuardAndTheProtectedRoute', () => {
    // A new account must reach the page (and accept the invite) before any onboarding redirect, and without a loop.
    const types = (matches ?? []).map((m) => (isValidElement(m.route.element) ? m.route.element.type : null));

    expect(types).not.toContain(OnboardingGuard);
    expect(types).not.toContain(ProtectedRoute);
  });
});
