import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { leasesApi } from '@/api/leases.api';
import type { LeaseDraft, LeaseDraftFlow, LongRentRules } from '@/types';
import { httpError } from '../../__tests__/lease-test-utils';
import { LeaseWizard } from '../lease-wizard';

vi.mock('@/api/leases.api', () => ({ leasesApi: { saveDraft: vi.fn(), getReview: vi.fn(), confirmReview: vi.fn() } }));

const TENANT_CODE = 'VRDGLI85B02F205A';

const FLOW: LeaseDraftFlow = {
  steps: [
    { step: 1, state: 'Done', needs: [] },
    { step: 2, state: 'Todo', needs: [{ code: 'tenant_missing' }] },
    { step: 3, state: 'Todo', needs: [] },
    { step: 4, state: 'Todo', needs: [] },
    { step: 5, state: 'Todo', needs: [] },
    { step: 6, state: 'Locked', needs: [] },
    { step: 7, state: 'Locked', needs: [] },
    { step: 8, state: 'Locked', needs: [] },
  ],
};

const DRAFT: LeaseDraft = {
  id: 'lease-1',
  version: 4,
  origin: 'Created',
  wizardMaxStep: 3,
  reviewConfirmedAt: null,
  sentForSignatureAt: null,
  updatedAt: '2026-10-24T08:00:00Z',
  values: {
    propertyId: 'prop-1',
    landlords: [{ id: 'landlord-1', firstName: 'Mario', lastName: 'Rossi', fiscalCode: 'RSSMRA80A01H501U', citizenship: 'IT', residence: 'Seveso', contactEmail: null }],
    tenants: [],
  },
  flow: FLOW,
};

const RULES: LongRentRules = {
  termMonths: { Libero: 48, Concordato: 36 },
  renewalMonths: { Libero: 48, Concordato: 24 },
  noticeMonths: 6,
  registrationDays: 30,
  depositMaxRents: 3,
  availableTypes: ['Libero', 'Concordato', 'Transitorio'],
  importedTypes: ['Libero', 'Concordato', 'Transitorio'],
  transitoryTermMonths: { min: 1, max: 18 },
  transitoryDocumentationAfterDays: 30,
  transitoryBandFromInhabitants: 10000,
};

describe('LeaseWizard autosave', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    await i18n.changeLanguage('it');
  });

  it('saves what is typed on the version it was read on, stops at a conflict without overwriting, and keeps nothing in the browser', async () => {
    vi.mocked(leasesApi.saveDraft)
      .mockResolvedValueOnce({ version: 5, flow: FLOW, landlordIds: ['landlord-1'], tenantIds: ['tenant-1'] })
      .mockRejectedValueOnce(httpError(409, { code: 'lease_draft_conflict' }));
    const onReload = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={['/app/long-rent/leases/lease-1/edit?step=2']}>
          <LeaseWizard draft={DRAFT} defaults={null} rules={RULES} onReload={onReload} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const tenant = within(screen.getByTestId('lease-tenants-0'));

    // First change: sent after the pause, on version 4, with the code normalized.
    fireEvent.change(tenant.getByLabelText(/^Nome/), { target: { value: 'Giulia' } });
    fireEvent.change(tenant.getByLabelText(/^Codice fiscale/), { target: { value: TENANT_CODE.toLowerCase() } });
    await waitFor(() => expect(leasesApi.saveDraft).toHaveBeenCalledTimes(1));
    expect(leasesApi.saveDraft).toHaveBeenNthCalledWith(
      1,
      'lease-1',
      expect.objectContaining({
        version: 4,
        step: 2,
        values: expect.objectContaining({
          landlords: [expect.objectContaining({ id: 'landlord-1', fiscalCode: 'RSSMRA80A01H501U' })],
          tenants: [expect.objectContaining({ firstName: 'Giulia', fiscalCode: TENANT_CODE })],
        }),
      }),
    );

    // Second change: made on the version the server answered (5); the server says it is stale and nothing else is written.
    fireEvent.change(tenant.getByLabelText(/^Cognome/), { target: { value: 'Verdi' } });
    await waitFor(() => expect(leasesApi.saveDraft).toHaveBeenCalledTimes(2));
    expect(leasesApi.saveDraft).toHaveBeenNthCalledWith(2, 'lease-1', expect.objectContaining({ version: 5, step: 2 }));
    const reload = await screen.findByTestId('lease-conflict-reload');
    fireEvent.click(reload);
    expect(onReload).toHaveBeenCalled();

    fireEvent.change(tenant.getByLabelText(/^Cognome/), { target: { value: 'Bianchi' } });
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(leasesApi.saveDraft).toHaveBeenCalledTimes(2);

    // The personal data went to the server and nowhere else: no draft in the browser.
    const stored = JSON.stringify({ ...localStorage, ...sessionStorage });
    expect(stored).not.toContain(TENANT_CODE);
    expect(stored).not.toContain('Giulia');
  });
});
