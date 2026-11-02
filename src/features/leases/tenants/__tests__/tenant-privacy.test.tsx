import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { saveBlobAs } from '@/lib/file-download';
import type { TenantErasureResult, TenantRow } from '@/types';
import { renderAt } from '../../__tests__/lease-test-utils';
import { TenantPrivacySection } from '../tenant-privacy';

// LR-09: the two things on the sheet of a person that touch their personal data. The erasure cannot be taken back, so nothing is
// asked of the server until the confirmation that says, lease by lease, what it does; the copy of their data is saved under a name
// that carries no name. Real calls to the API client over a mocked HTTP client.
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/lib/file-download', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/file-download')>()),
  saveBlobAs: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const get = vi.mocked(axios.get);
const post = vi.mocked(axios.post);

const TENANT: TenantRow = {
  id: 'tenant-1',
  firstName: 'Giulia',
  lastName: 'Verdi',
  citizenship: 'Eu',
  contactEmailMasked: 'g***@example.com',
  isFormer: false,
  leases: [
    { leaseId: 'lease-1', propertyId: 'property-1', propertyName: 'Casa Trastevere', stage: 'Active', monthlyRent: 950, currentTermEndDate: '2030-09-30T00:00:00Z' },
  ],
  punctuality: { onTime: 3, total: 4 },
};

const RESULT: TenantErasureResult = {
  leases: [{ leaseId: 'lease-1', propertyName: 'Casa Trastevere', status: 'Scheduled', anonymizationFrom: '2030-10-01T00:00:00Z', partiesKept: 0 }],
};

function renderSection(onErased = vi.fn()) {
  renderAt('/sheet', '/sheet', <TenantPrivacySection tenant={TENANT} onErased={onErased} />);
  return onErased;
}

describe('the privacy of a tenant on their sheet (LR-09)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('erasure_AskedThenConfirmed_RequestsOnlyAfterTheConfirmation', async () => {
    post.mockResolvedValue({ data: RESULT });
    const onErased = renderSection();

    fireEvent.click(screen.getByTestId('tenant-erasure-action'));
    const dialog = await screen.findByRole('dialog');

    // The window says what it does, naming the lease that holds the data back, and nothing has been asked of the server.
    expect(within(dialog).getByTestId('confirmation-consequences')).toHaveTextContent('Casa Trastevere');
    expect(post).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Chiedi la cancellazione' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][0]).toBe('/long-rent/tenants/tenant-1/erasure-request');
    await waitFor(() => expect(onErased).toHaveBeenCalledWith(RESULT));
  });

  it('erasure_Cancelled_NothingIsRequested', async () => {
    const onErased = renderSection();

    fireEvent.click(screen.getByTestId('tenant-erasure-action'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annulla' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(post).not.toHaveBeenCalled();
    expect(onErased).not.toHaveBeenCalled();
  });

  it('export_Clicked_SavesTheFileUnderANeutralName', async () => {
    const file = new Blob(['{}'], { type: 'application/json' });
    get.mockResolvedValue({ data: file });
    renderSection();

    fireEvent.click(screen.getByTestId('tenant-export'));

    await waitFor(() => expect(saveBlobAs).toHaveBeenCalledTimes(1));
    expect(get.mock.calls[0][0]).toBe('/long-rent/tenants/tenant-1/export');
    expect(get.mock.calls[0][1]).toMatchObject({ responseType: 'blob' });
    // The name of the file says nothing of the person.
    expect(vi.mocked(saveBlobAs).mock.calls[0][1]).toBe('dati-personali.json');
  });
});
