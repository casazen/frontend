import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import type { ServiceRequest } from '@/types/service-request';
import { CancelInterventionDialog } from '../cancel-intervention-dialog';

const api = vi.hoisted(() => ({ cancelServiceRequest: vi.fn() }));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/service-requests.api', () => api);

const REQUEST: ServiceRequest = {
  id: 'sr-1',
  orgId: 'org-1',
  propertyId: 'prop-1',
  supplierOrgId: 'sup-1',
  supplierName: 'Idraulica Rossi',
  category: 'plumbing',
  urgency: 'Normal',
  status: 'PresoInCarico',
  chargeToGuest: false,
  createdAt: '2026-10-20T08:00:00Z',
  updatedAt: '2026-10-22T08:00:00Z',
};

function renderDialog(onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <CancelInterventionDialog request={REQUEST} onClose={onClose} />
      </QueryClientProvider>
    </I18nextProvider>,
  );
  return onClose;
}

describe('CancelInterventionDialog (SR-08, decisions D6 and D31)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    api.cancelServiceRequest.mockResolvedValue({ ...REQUEST, status: 'Annullato' });
    await i18n.changeLanguage('it');
  });

  it('CancelInterventionDialog_Opened_SaysThatCancellingIsAlwaysFreeAndTheSupplierIsTold', () => {
    renderDialog();

    const consequences = screen.getByTestId('intervention-cancel-consequences');
    expect(consequences).toHaveTextContent('sempre gratuito');
    expect(consequences).toHaveTextContent('Idraulica Rossi riceve subito un avviso con il motivo che scrivi.');
  });

  it('CancelInterventionDialog_NoReason_CannotBeConfirmedAndTheReasonHasALimit', () => {
    renderDialog();

    expect(screen.getByTestId('intervention-cancel-confirm')).toBeDisabled();
    fireEvent.change(screen.getByTestId('intervention-cancel-reason'), { target: { value: '   ' } });
    expect(screen.getByTestId('intervention-cancel-confirm')).toBeDisabled();
    expect(screen.getByTestId('intervention-cancel-reason')).toHaveAttribute('maxlength', '500');
  });

  it('CancelInterventionDialog_ReasonGiven_CancelsWithTheReasonTheSupplierReads', async () => {
    const onClose = renderDialog();

    fireEvent.change(screen.getByTestId('intervention-cancel-reason'), { target: { value: '  Non serve più  ' } });
    fireEvent.click(screen.getByTestId('intervention-cancel-confirm'));

    await waitFor(() => expect(api.cancelServiceRequest).toHaveBeenCalledWith('sr-1', 'Non serve più'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
