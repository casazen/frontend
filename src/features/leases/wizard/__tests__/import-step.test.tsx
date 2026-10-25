import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import { leasesApi } from '@/api/leases.api';
import { httpError } from '../../__tests__/lease-test-utils';
import { ImportStep } from '../import-step';

vi.mock('@/api/leases.api', () => ({ leasesApi: { importSigned: vi.fn() } }));

/** Where the person is, and what the next screen was told: the declaration of the registration is asked for there. */
function Where() {
  const location = useLocation();
  return <p data-testid="where">{`${location.pathname}${location.search} ${JSON.stringify(location.state)}`}</p>;
}

function renderStep() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/long-rent/leases/lease-1/edit?step=7']}>
        <Routes>
          <Route
            path="/app/long-rent/leases/:id/edit"
            element={
              <>
                <ImportStep leaseId="lease-1" contractType="Libero" flush={() => Promise.resolve(true)} />
                <Where />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ImportStep (LR-06b): the import of a signed contract cannot be taken back', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-24T08:00:00Z'));
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    cleanup();
  });

  it('does not import before the person confirms what follows, imports once, and asks for the registration only after it went through', async () => {
    const pdf = new File(['%PDF-1.4 firmato'], 'contratto-firmato.pdf', { type: 'application/pdf' });
    vi.mocked(leasesApi.importSigned)
      .mockRejectedValueOnce(httpError(409, { code: 'lease_draft_conflict' }))
      .mockResolvedValueOnce({} as never);
    renderStep();

    fireEvent.change(screen.getByTestId('lease-import-file'), { target: { files: [pdf] } });
    fireEvent.change(screen.getByTestId('lease-import-date'), { target: { value: '2026-08-20' } });
    fireEvent.click(screen.getByTestId('lease-registered-yes'));
    fireEvent.click(screen.getByTestId('lease-import-submit'));

    // The consequences are written first, and nothing has gone to the server yet.
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText(/non si può più modificare né eliminare/)).toBeInTheDocument();
    expect(leasesApi.importSigned).not.toHaveBeenCalled();

    // Two taps on «Inserisci il contratto» are one import. The server is busy: nothing was written, the person is told, and the
    // registration is not asked for (the contract is not in).
    const confirm = dialog.getByRole('button', { name: 'Inserisci il contratto' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(await screen.findByTestId('lease-import-error')).toHaveTextContent('Il contratto è occupato o è cambiato altrove');
    expect(leasesApi.importSigned).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('where')).toHaveTextContent('?step=7 null');

    // Again, with the same confirmation: this time it is in, and only then does the next screen open the declaration of the registration.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByTestId('lease-import-submit'));
    const again = within(await screen.findByRole('dialog'));
    fireEvent.click(again.getByRole('button', { name: 'Inserisci il contratto' }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('?step=8 {"declareRegistration":true}'));
    expect(leasesApi.importSigned).toHaveBeenCalledTimes(2);
    expect(leasesApi.importSigned).toHaveBeenLastCalledWith('lease-1', { stipulaDate: '2026-08-20', signedContract: pdf });
  });
});
