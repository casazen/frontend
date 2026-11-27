import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { orgComplianceSenderApi, type OrgComplianceSender } from '@/api/org-compliance-sender.api';
import { OrgSenderPreference } from '../components/org-sender-preference';

vi.mock('@/api/org-compliance-sender.api', () => ({ orgComplianceSenderApi: { get: vi.fn(), set: vi.fn() } }));
const empty: OrgComplianceSender = { sender: null, lastChangedAt: null, delegationAccepted: false, delegationTextVersion: '2026-11-v1', propertyOverrides: 0, autoSendGuestsToOctorate: false };
const manual: OrgComplianceSender = { ...empty, sender: 'Manual', lastChangedAt: '2026-11-17T10:00:00Z' };

function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<I18nextProvider i18n={i18n}><QueryClientProvider client={client}><OrgSenderPreference /></QueryClientProvider></I18nextProvider>);
}
afterEach(cleanup);
beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage('it');
  vi.mocked(orgComplianceSenderApi.get).mockResolvedValue(empty);
});

describe('account sender preference', () => {
  it('explains both methods and saves only after explicit review and confirmation', async () => {
    vi.mocked(orgComplianceSenderApi.set).mockResolvedValue(manual);
    show();
    const option = await screen.findByRole('radio', { name: 'Invio manuale' });
    expect(option).toHaveAccessibleDescription(/Scarichi i file dei soggiorni/);
    expect(screen.getByRole('radio', { name: 'Octorate' })).toHaveAccessibleDescription(/verifica di ogni immobile/);
    expect(screen.getByRole('button', { name: 'Rivedi la scelta' })).toBeDisabled();
    fireEvent.click(option);
    fireEvent.click(screen.getByRole('button', { name: 'Rivedi la scelta' }));
    expect(screen.getByRole('heading', { name: 'Verifica il metodo di invio' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Salva preferenza' })).toBeDisabled();
    expect(orgComplianceSenderApi.set).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox', { name: /Confermo la scelta/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Salva preferenza' }));
    await waitFor(() => expect(orgComplianceSenderApi.set).toHaveBeenCalledWith(
      expect.objectContaining({ sender: 'Manual', confirmed: true, expectedLastChangedAt: null, delegationConsent: false }), expect.anything()));
    await screen.findByRole('button', { name: 'Modifica scelta' });
    expect(screen.getByRole('status')).toHaveTextContent('Invio manuale');
    expect(orgComplianceSenderApi.set).toHaveBeenCalledTimes(1);
  });

  it('shows a compact saved preference, preserves exceptions and can discard edits', async () => {
    vi.mocked(orgComplianceSenderApi.get).mockResolvedValue({ ...manual, propertyOverrides: 2 });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Modifica scelta' }));
    const details = screen.getByText('Credenziali e codici degli immobili').closest('details')!;
    expect(details).not.toHaveAttribute('open');
    expect(details).toHaveTextContent('IdAppartamento');
    fireEvent.click(screen.getByRole('radio', { name: 'Octorate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rivedi la scelta' }));
    expect(screen.getByText(/2 immobili mantengono/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Torna alla scelta' }));
    fireEvent.click(screen.getByRole('button', { name: 'Annulla modifica' }));
    expect(screen.getByRole('status')).toHaveTextContent('Invio manuale');
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(orgComplianceSenderApi.set).not.toHaveBeenCalled();
  });

  it('reviews the actual account-wide transfer setting and requires the current delegation', async () => {
    vi.mocked(orgComplianceSenderApi.get).mockResolvedValue(manual);
    vi.mocked(orgComplianceSenderApi.set).mockResolvedValue({ ...manual, sender: 'ChannelManager', delegationAccepted: true, autoSendGuestsToOctorate: true });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Modifica scelta' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Octorate' }));
    const auto = screen.getByRole('switch');
    expect(auto).toHaveAccessibleDescription(/quando confermi il check-in/);
    expect(auto).not.toBeChecked();
    fireEvent.click(auto);
    fireEvent.click(screen.getByRole('button', { name: 'Rivedi la scelta' }));
    expect(screen.getByText(/Per tutti gli immobili dell’organizzazione/)).toBeVisible();
    fireEvent.click(screen.getByRole('checkbox', { name: /Confermo la scelta/ }));
    const save = screen.getByRole('button', { name: 'Salva preferenza' });
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /Ho letto il testo/ }));
    fireEvent.click(save);
    await waitFor(() => expect(orgComplianceSenderApi.set).toHaveBeenCalledWith({
      sender: 'ChannelManager', confirmed: true, expectedLastChangedAt: manual.lastChangedAt, delegationConsent: true,
      delegationTextVersion: empty.delegationTextVersion, autoSendGuestsToOctorate: true,
    }, expect.anything()));
  });

  it('keeps an unsupported delegation version out of the save and lets the host reconsider', async () => {
    vi.mocked(orgComplianceSenderApi.get).mockResolvedValue({ ...empty, delegationTextVersion: 'unsupported-version' });
    show();
    fireEvent.click(await screen.findByRole('radio', { name: 'Octorate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rivedi la scelta' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Confermo la scelta/ }));
    expect(screen.queryByRole('checkbox', { name: /Ho letto/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salva preferenza' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Torna alla scelta' }));
    expect(screen.getByRole('radio', { name: 'Octorate' })).toBeChecked();
    expect(orgComplianceSenderApi.set).not.toHaveBeenCalled();
  });

  it('recovers a failed read without inventing a default and retries a failed save', async () => {
    vi.mocked(orgComplianceSenderApi.get).mockRejectedValueOnce(new Error('network'));
    vi.mocked(orgComplianceSenderApi.set).mockRejectedValueOnce(new Error('network')).mockResolvedValue(manual);
    show();
    await screen.findByText(/Non riusciamo a leggere la scelta/);
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Invio manuale' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rivedi la scelta' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Confermo la scelta/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Salva preferenza' }));
    await screen.findByText('Scelta non salvata. Riprova.');
    fireEvent.click(screen.getByRole('button', { name: 'Salva preferenza' }));
    await screen.findByRole('button', { name: 'Modifica scelta' });
    expect(orgComplianceSenderApi.set).toHaveBeenCalledTimes(2);
  });
});
