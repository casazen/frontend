import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, AxiosHeaders } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { OrgsApi } from '@/api/orgs.api';
import * as userQueries from '@/queries/use-users';
import type { Entitlement, PlanCatalogEntry } from '@/types';
import { PlanSettingsPage } from '../plan-settings-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/orgs.api', () => ({
  OrgsApi: { getPlans: vi.fn(), getMyEntitlement: vi.fn(), updateMyPlan: vi.fn() },
}));
vi.mock('@/queries/use-users', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/queries/use-users')>();
  return { ...actual, useCurrentUser: vi.fn(), useEntitlement: vi.fn(), usePlans: vi.fn() };
});
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));

// The page reads only these fields: partial objects are cast to the full hook results.
type CurrentUserResult = ReturnType<typeof userQueries.useCurrentUser>;
type EntitlementResult = ReturnType<typeof userQueries.useEntitlement>;
type PlansResult = ReturnType<typeof userQueries.usePlans>;

const plans: PlanCatalogEntry[] = [
  { tier: 'Starter', displayName: 'Starter', maxProperties: 3, description: 'Starter plan' },
  { tier: 'Pro', displayName: 'Pro', maxProperties: 50, description: 'Pro plan' },
  { tier: 'Scale', displayName: 'Scale', maxProperties: -1, description: 'Scale plan' },
];

const entitlement: Entitlement = {
  orgId: 'org-1',
  planTier: 'Starter',
  limits: { maxProperties: 3 },
  usage: { properties: 1 },
  canAddProperty: true,
};

function problemError(status: number, code: string): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data: { status, code, detail: 'Server detail' },
  });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(
        QueryClientProvider,
        { client },
        createElement(MemoryRouter, null, createElement(PlanSettingsPage)),
      ),
    ),
  );
}

describe('PlanSettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userQueries.useCurrentUser).mockReturnValue({
      user: { onboardingCompletedAt: '2026-01-01T00:00:00Z', orgId: 'org-1' },
      org: { id: 'org-1', name: 'Casa Test', slug: 'casa-test', planTier: 'Starter' },
      planTier: 'Starter',
    } as unknown as CurrentUserResult);
    vi.mocked(userQueries.useEntitlement).mockReturnValue({ data: entitlement } as unknown as EntitlementResult);
    vi.mocked(userQueries.usePlans).mockReturnValue({ data: plans, isLoading: false } as unknown as PlansResult);
  });

  it('handleSelect_UpgradeWithoutSubscription_ShowsSubscriptionRequiredAndKeepsCurrentPlan', async () => {
    vi.mocked(OrgsApi.updateMyPlan).mockRejectedValue(problemError(403, 'subscription_required'));
    renderPage();

    const proCard = screen.getByTestId('plan-card-Pro');
    fireEvent.click(within(proCard).getByRole('button'));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(i18n.t('apiErrors.codes.subscriptionRequired')),
    );
    expect(OrgsApi.updateMyPlan).toHaveBeenCalledWith('Pro');
    expect(toast.success).not.toHaveBeenCalled();
    // Still on Starter; the Pro button is usable again (no stuck selection or spinner).
    expect(within(screen.getByTestId('plan-card-Starter')).getByRole('button')).toHaveTextContent(
      i18n.t('plan.currentPlan'),
    );
    await waitFor(() =>
      expect(within(screen.getByTestId('plan-card-Pro')).getByRole('button')).toHaveTextContent(
        i18n.t('settings.switchToPlan'),
      ),
    );
    expect(within(screen.getByTestId('plan-card-Pro')).getByRole('button')).toBeEnabled();
  });
});
