import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { AdminApi } from '@/api/admin.api';
import { OrgsApi } from '@/api/orgs.api';
import type { PlanCatalogEntry, UserSummary } from '@/types';
import { ChangeOrgPlanDialog } from '../components/change-org-plan-dialog';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/admin.api', () => ({ AdminApi: { updateOrgPlan: vi.fn() } }));
vi.mock('@/api/orgs.api', () => ({ OrgsApi: { getPlans: vi.fn(), getMyEntitlement: vi.fn() } }));

const plans: PlanCatalogEntry[] = [
  { tier: 'Starter', displayName: 'Starter', maxProperties: 3, description: 'Starter' },
  { tier: 'Pro', displayName: 'Pro', maxProperties: 50, description: 'Pro' },
  { tier: 'Scale', displayName: 'Scale', maxProperties: -1, description: 'Scale' },
];

const owner: UserSummary = {
  id: 'auth0|owner',
  email: 'owner@example.com',
  firstName: 'Mario',
  lastName: 'Rossi',
  role: 'PropertyOwner',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  orgId: 'org-1',
  orgName: 'Casa Test',
  planTier: 'Pro',
};

function conflict(code: string): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, {
    status: 409,
    statusText: '',
    headers: {},
    config,
    data: { status: 409, code },
  });
}

function renderDialog(onOpenChange = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ChangeOrgPlanDialog user={owner} open onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  );
  return onOpenChange;
}

describe('ChangeOrgPlanDialog (FD-18)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    vi.mocked(OrgsApi.getPlans).mockResolvedValue(plans);
  });

  it('handleSelect_ManagedByStripe_ShowsMessageAndKeepsTheDialogOpenWithoutUnhandledRejection', async () => {
    vi.mocked(AdminApi.updateOrgPlan).mockRejectedValue(conflict('managed_by_stripe'));
    const onOpenChange = renderDialog();

    const scale = within(await screen.findByTestId('plan-card-Scale')).getByRole('button');
    fireEvent.click(scale);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('apiErrors.codes.managedByStripe')));
    expect(AdminApi.updateOrgPlan).toHaveBeenCalledWith('org-1', 'Scale');
    expect(onOpenChange).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(within(screen.getByTestId('plan-card-Scale')).getByRole('button')).toHaveTextContent(
        i18n.t('admin.users.planDialog.actionLabel'),
      ),
    );
    expect(within(screen.getByTestId('plan-card-Scale')).getByRole('button')).toBeEnabled();
  });

  it('handleSelect_Success_ClosesTheDialog', async () => {
    vi.mocked(AdminApi.updateOrgPlan).mockResolvedValue({
      orgId: 'org-1',
      planTier: 'Starter',
      limits: { maxProperties: 3 },
      usage: { properties: 0 },
      canAddProperty: true,
    });
    const onOpenChange = renderDialog();

    fireEvent.click(within(await screen.findByTestId('plan-card-Starter')).getByRole('button'));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(toast.success).toHaveBeenCalledWith(i18n.t('toast.orgPlanUpdated'));
  });
});
