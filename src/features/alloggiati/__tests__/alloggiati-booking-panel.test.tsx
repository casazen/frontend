import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import i18n from '@/i18n/config';
import type { AlloggiatiStatusDto, AlloggiatiWebStatus } from '@/types/alloggiati.types';
import { AlloggiatiBookingPanel } from '../components/alloggiati-booking-panel';

const current = vi.hoisted(() => ({ status: undefined as AlloggiatiStatusDto | undefined }));

vi.mock('@/queries/use-alloggiati', () => ({
  useAlloggiatiStatus: () => ({ data: current.status, isLoading: false, isError: false, refetch: vi.fn() }),
  useMarkAlloggiatiSentManually: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ hasPermission: () => true }) }));
vi.mock('../components/alloggiati-guest-summary', () => ({ AlloggiatiGuestSummary: () => null }));

function statusOf(status: AlloggiatiWebStatus): AlloggiatiStatusDto {
  return {
    bookingId: 'b1',
    status,
    confirmationNumber: null,
    errorCode: null,
    reportedAt: null,
    deadlineAt: '2026-10-11T08:00:00Z',
    isShortStay: false,
    hoursUntilDeadline: 5,
    isOverdue: false,
    dataComplete: false,
  };
}

function renderPanel() {
  return render(createElement(AlloggiatiBookingPanel, { bookingId: 'b1', checkInDate: '2026-10-10T00:00:00Z' }));
}

beforeAll(async () => {
  await i18n.changeLanguage('it');
});

beforeEach(() => {
  current.status = undefined;
});

describe('AlloggiatiBookingPanel: a stay that owes no communication', () => {
  it('panel_NoShow_SaysNothingIsDueAndShowsNoDeadlineNorMarkAsSent', () => {
    current.status = statusOf('NotDue');
    renderPanel();

    // The state the API gives a no-show has its own words, never the raw key of a missing text.
    expect(screen.getByTestId('alloggiati-status-badge')).toHaveTextContent('Non dovuta');
    expect(document.body).not.toHaveTextContent('alloggiati.statusLabel');
    expect(screen.getByTestId('booking-alloggiati-not-due')).toHaveTextContent('nessuna comunicazione alla Questura');
    // No term to meet, nothing to declare as sent, no complaint about data that nobody has to send.
    expect(screen.queryByTestId('booking-alloggiati-deadline')).not.toBeInTheDocument();
    expect(screen.queryByTestId('alloggiati-resend-button')).not.toBeInTheDocument();
    expect(screen.queryByText('Dati ospite incompleti')).not.toBeInTheDocument();
  });

  it('panel_ToSendManually_StillShowsTheDeadlineAndTheWayToDeclareTheSending', () => {
    current.status = statusOf('DaInviareManualmente');
    renderPanel();

    expect(screen.getByTestId('booking-alloggiati-deadline')).toBeInTheDocument();
    expect(screen.getByTestId('alloggiati-resend-button')).toBeInTheDocument();
    expect(screen.queryByTestId('booking-alloggiati-not-due')).not.toBeInTheDocument();
  });
});
