import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { ServiceRequest } from '@/types/service-request';
import type { HostPermissions } from '../intervention-model';
import { InterventionNow } from '../intervention-now';
import type { InterventionSteps } from '../use-intervention-actions';

const steps: InterventionSteps = {
  remind: vi.fn(),
  acceptProposal: vi.fn(),
  rejectProposal: vi.fn(),
  confirmAmount: vi.fn(),
  markPaid: vi.fn(),
  pay: vi.fn(),
  cancel: vi.fn(),
};

const MANAGER: HostPermissions = { canManage: true, canRequest: true };
const COLLABORATOR: HostPermissions = { canManage: false, canRequest: true };

const BASE: ServiceRequest = {
  id: 'sr-1',
  orgId: 'org-1',
  propertyId: 'prop-1',
  propertyName: 'Casa del Lago',
  supplierOrgId: 'sup-1',
  supplierName: 'Idraulica Rossi',
  category: 'plumbing',
  urgency: 'Normal',
  status: 'Completato',
  chargeToGuest: false,
  createdAt: '2026-10-20T08:00:00Z',
  updatedAt: '2026-10-22T08:00:00Z',
  price: { amountCents: 12000, basis: 'final' },
  hostAction: { kind: 'pay' },
  availableActions: ['pay', 'cancel'],
};

function renderBlock(request: ServiceRequest, permissions: HostPermissions) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <InterventionNow request={request} steps={steps} busy={false} permissions={permissions} />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('InterventionNow (SR-08)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  it('InterventionNow_PayFromTheServer_OffersThePaymentToWhoMayManage', () => {
    renderBlock(BASE, MANAGER);

    expect(screen.getByTestId('intervention-next-step')).toHaveAttribute('data-action', 'pay');
    fireEvent.click(screen.getByRole('button', { name: /^Paga/ }));
    expect(steps.pay).toHaveBeenCalledWith(BASE);
  });

  it('InterventionNow_PayWithoutPropertyWrite_ShowsNoPaymentButtonOnlyTheWayBackToTheList', () => {
    renderBlock(BASE, COLLABORATOR);

    expect(screen.queryByRole('button', { name: /^Paga/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tutti gli interventi' })).toHaveAttribute('href', '/app/short-rent/interventions');
  });

  it('InterventionNow_PaidOutsideCasaZen_IsMarkedPaidByWhoMayRequest', () => {
    const request = { ...BASE, hostAction: { kind: 'markPaid' }, paymentMode: 'Manual' };
    renderBlock(request, COLLABORATOR);

    fireEvent.click(screen.getByRole('button', { name: 'Segna come pagato' }));
    // The window that asks first (the flag cannot be undone) belongs to the steps, not to the block.
    expect(steps.markPaid).toHaveBeenCalledWith(request);
  });

  it('InterventionNow_FinishedJobWithAmountAboveTheQuote_AsksToConfirmItBeforeAnyPayment', () => {
    const request: ServiceRequest = {
      ...BASE,
      hostAction: { kind: 'confirmFinalAmount' },
      price: { amountCents: 18000, quotedAmountCents: 12000, finalAmountCents: 18000, basis: 'final' },
    };
    renderBlock(request, MANAGER);

    expect(screen.queryByRole('button', { name: /^Paga/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Conferma/ }));
    expect(steps.confirmAmount).toHaveBeenCalledWith(request);
  });
});
