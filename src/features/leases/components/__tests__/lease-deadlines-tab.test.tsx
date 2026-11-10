import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LeaseDetail } from '@/types';
import { LeaseDeadlinesTab } from '../lease-deadlines-tab';

const mocks = vi.hoisted(() => ({
  checklist: undefined as undefined | { providerFilingAvailable: boolean; tosVersion: string; attestationText: string },
  mutateAsync: vi.fn(),
}));
vi.mock('@/queries/use-leases', () => ({
  useRliChecklist: () => ({ data: mocks.checklist }),
  useTriggerRegistration: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
}));
vi.mock('../lease-dates', () => ({ LeaseDates: () => null }));
vi.mock('../rli-checklist', () => ({ RliChecklist: () => null }));
vi.mock('../questura-communication-panel', () => ({ QuesturaCommunicationPanel: () => null }));
vi.mock('../registration-status-panel', () => ({
  RegistrationStatusPanel: ({ onSubmitToProvider }: { onSubmitToProvider: () => void }) => <button onClick={onSubmitToProvider}>Open</button>,
}));
vi.mock('../delega-capture-dialog', () => ({
  DelegaCaptureDialog: ({ open, onOpenChange, onConfirm }: {
    open: boolean; onOpenChange: (open: boolean) => void;
    onConfirm: (payload: { tosVersion: string; attestationAccepted: boolean }) => Promise<void>;
  }) => open ? <div role="dialog">
    <button onClick={() => onOpenChange(false)}>Close</button>
    <button onClick={() => void onConfirm({ tosVersion: 'v1', attestationAccepted: true })}>Confirm</button>
  </div> : null,
}));

const lease = { id: 'lease-1', status: 'Signed' } as LeaseDetail;
function Content() {
  const location = useLocation();
  return <><LeaseDeadlinesTab lease={lease} showQuestura={false} /><output>{location.search}</output></>;
}
function App({ query = '?registrationCheckout=success&tab=deadlines' }: { query?: string }) {
  return <MemoryRouter initialEntries={[`/lease${query}`]}><Content /></MemoryRouter>;
}

describe('checkout return dialog', () => {
  beforeEach(() => {
    mocks.checklist = { providerFilingAvailable: true, tosVersion: 'v1', attestationText: '' };
    mocks.mutateAsync.mockReset().mockResolvedValue(undefined);
  });

  it('waits for provider availability and consumes only the checkout parameter on close', () => {
    mocks.checklist = undefined;
    const view = render(<App />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    mocks.checklist = { providerFilingAvailable: true, tosVersion: 'v1', attestationText: '' };
    view.rerender(<App />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('?tab=deadlines');
    fireEvent.click(screen.getByText('Open'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes and clears the checkout return after confirmation', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Confirm'));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mocks.mutateAsync).toHaveBeenCalledWith({ id: 'lease-1', tosVersion: 'v1', attestationAccepted: true });
    expect(screen.getByRole('status')).toHaveTextContent('?tab=deadlines');
  });

  it('does not auto-open for a canceled checkout', () => {
    render(<App query="?registrationCheckout=cancel" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
