import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { leasesApi } from '@/api/leases.api';
import type { LeaseDraft, LeaseDraftFlow, LeaseReading, LongRentRules } from '@/types';
import { LeaseWizard } from '../lease-wizard';

vi.mock('@/api/leases.api', () => ({ leasesApi: { saveDraft: vi.fn(), getReview: vi.fn(), confirmReview: vi.fn() } }));

/** An imported contract on the step of the parties: the steps of the model and of the review do not apply to it. */
const FLOW: LeaseDraftFlow = {
  steps: [
    { step: 1, state: 'Done', needs: [] },
    { step: 2, state: 'Todo', needs: [{ code: 'tenant_missing' }] },
    { step: 3, state: 'Todo', needs: [] },
    { step: 4, state: 'Todo', needs: [] },
    { step: 5, state: 'NotApplicable', needs: [] },
    { step: 6, state: 'NotApplicable', needs: [] },
    { step: 7, state: 'Locked', needs: [] },
    { step: 8, state: 'Locked', needs: [] },
  ],
};

const DRAFT: LeaseDraft = {
  id: 'lease-1',
  version: 4,
  origin: 'Imported',
  wizardMaxStep: 2,
  reviewConfirmedAt: null,
  sentForSignatureAt: null,
  updatedAt: '2026-10-25T08:00:00Z',
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

/** The contract is being read. */
const READING_ON: LeaseReading = {
  state: 'Reading',
  documents: [{ id: 'doc-1', fileName: 'contratto.pdf', status: 'Processing', error: null }],
  fields: [],
  stipulaDate: null,
  contractDocumentId: 'doc-1',
};

/** The contract is read: it gave the rent (the server wrote it in the draft; the form here does not have it yet). */
const READING_DONE: LeaseReading = {
  ...READING_ON,
  state: 'Done',
  documents: [{ id: 'doc-1', fileName: 'contratto.pdf', status: 'Completed', error: null }],
  fields: [{ field: 'monthlyRent', partyId: null, role: null, state: 'Read', confidence: 90, derived: false }],
};

describe('LeaseWizard — the reading of the contract ends while the person fills the data in (NL-DOCS-FU8)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sessionStorage.clear();
    await i18n.changeLanguage('it');
    vi.mocked(leasesApi.saveDraft).mockResolvedValue({ version: 5, flow: FLOW, landlordIds: ['landlord-1'], tenantIds: ['tenant-1'] });
  });

  /** The wizard on the parties, with the reading as it is now; the same client for every render, so a new render keeps the wizard. */
  function renderWizard(client: QueryClient, reading: LeaseReading, onReload = vi.fn()) {
    const wizard = (current: LeaseReading) => (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/app/long-rent/leases/lease-1/edit?step=2']}>
          <LeaseWizard draft={DRAFT} defaults={null} rules={RULES} onReload={onReload} reading={current} />
        </MemoryRouter>
      </QueryClientProvider>
    );
    const view = render(wizard(reading));
    return { onReload, change: (next: LeaseReading) => view.rerender(wizard(next)) };
  }

  it('does not erase what was written: it says the contract is read, and shows the values only when asked, after saving what was typed', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { onReload, change } = renderWizard(client, READING_ON);
    expect(screen.getByTestId('lease-reading-ongoing')).toBeInTheDocument();
    const tenant = within(screen.getByTestId('lease-tenants-0'));
    fireEvent.change(tenant.getByLabelText(/^Nome/), { target: { value: 'Giulia' } });

    change(READING_DONE);

    // Said and not done: what was written is where it was, the draft was not read again under the person's hands, and the note «abbiamo
    // compilato i dati» (which would not be true yet) is not there.
    expect(await screen.findByTestId('lease-reading-arrived')).toHaveTextContent(i18n.t('leaseRound.reading.arrived'));
    expect(tenant.getByLabelText(/^Nome/)).toHaveValue('Giulia');
    expect(onReload).not.toHaveBeenCalled();
    expect(screen.queryByTestId('lease-reading-done')).not.toBeInTheDocument();
    expect(screen.queryByTestId('lease-reading-ongoing')).not.toBeInTheDocument();

    // On request: what is waiting is saved first, on the version this draft has here, and then the draft is read again.
    fireEvent.click(screen.getByTestId('lease-reading-show'));
    await waitFor(() => expect(onReload).toHaveBeenCalledTimes(1));
    expect(leasesApi.saveDraft).toHaveBeenCalledWith(
      'lease-1',
      expect.objectContaining({ version: 4, step: 2, values: expect.objectContaining({ tenants: [expect.objectContaining({ firstName: 'Giulia' })] }) }),
    );
  });

  it('shows the values read from the start, with no notice, when the wizard opens after the reading ended', () => {
    renderWizard(new QueryClient({ defaultOptions: { queries: { retry: false } } }), READING_DONE);

    expect(screen.queryByTestId('lease-reading-arrived')).not.toBeInTheDocument();
    expect(screen.getByTestId('lease-reading-done')).toHaveTextContent(i18n.t('leaseWizard.documents.read.banner'));
  });
});
