import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { orgComplianceSenderApi, type OrgComplianceSender } from '@/api/org-compliance-sender.api';
import { OrgSenderPreference } from '../components/org-sender-preference';

vi.mock('@/api/org-compliance-sender.api', () => ({ orgComplianceSenderApi: { get: vi.fn(), set: vi.fn() } }));
const empty: OrgComplianceSender = { sender: null, lastChangedAt: null, delegationAccepted: false, delegationTextVersion: '2026-11-v1', propertyOverrides: 0, autoSendGuestsToOctorate: false };
function show() {
  return render(<I18nextProvider i18n={i18n}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><OrgSenderPreference /></QueryClientProvider></I18nextProvider>);
}
afterEach(cleanup);
beforeEach(async () => { vi.clearAllMocks(); await i18n.changeLanguage('it'); vi.mocked(orgComplianceSenderApi.get).mockResolvedValue(empty); });
describe('account sender preference', () => {
  it('requires explicit confirmation before saving a choice for the account', async () => {
    vi.mocked(orgComplianceSenderApi.set).mockResolvedValue({ ...empty, sender: 'Manual', lastChangedAt: '2026-11-17T10:00:00Z' });
    show();
    await screen.findByRole('heading', { name: 'Chi invia i dati degli ospiti?' });
    fireEvent.click(screen.getByRole('radio', { name: /Invio io sui portali/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continua: riepilogo' }));
    expect(screen.getByRole('button', { name: 'Salva per il mio account' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /Confermo questa scelta/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Salva per il mio account' }));
    await waitFor(() => expect(orgComplianceSenderApi.set).toHaveBeenCalledWith(expect.objectContaining({ sender: 'Manual', confirmed: true, expectedLastChangedAt: null, delegationConsent: false }), expect.anything()));
    expect(await screen.findByRole('status')).toHaveTextContent('Preferenza salvata');
    expect(orgComplianceSenderApi.set).toHaveBeenCalledTimes(1);
  });
  it('explains separate apartment identifiers and keeps overrides without claiming operational activation', async () => {
    vi.mocked(orgComplianceSenderApi.get).mockResolvedValue({ ...empty, sender: 'Manual', propertyOverrides: 2 });
    show();
    await screen.findByRole('button', { name: 'Modifica scelta' });
    expect(screen.getByText(/Ogni appartamento mantiene il proprio identificativo/)).toHaveTextContent('IdAppartamento');
    fireEvent.click(screen.getByRole('button', { name: 'Modifica scelta' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continua: riepilogo' }));
    expect(screen.getByText(/2 immobili mantengono/)).toBeInTheDocument();
    expect(screen.getByText(/Non attiva servizi esterni/)).toBeInTheDocument();
    expect(orgComplianceSenderApi.set).not.toHaveBeenCalled();
  });
  it('requires delegation for the channel manager and keeps guest auto-send an explicit account choice', async () => {
    show();
    await screen.findByRole('heading', { name: 'Chi invia i dati degli ospiti?' });
    fireEvent.click(screen.getByRole('radio', { name: /Il mio channel manager/ }));
    const auto = screen.getByRole('switch');
    expect(auto).not.toBeChecked();
    fireEvent.click(auto);
    fireEvent.click(screen.getByRole('button', { name: 'Continua: riepilogo' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Confermo questa scelta/ }));
    expect(screen.getByRole('button', { name: 'Salva per il mio account' })).toBeDisabled();
    expect(orgComplianceSenderApi.set).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox', { name: /Ho letto il testo/ }));
    expect(screen.getByRole('button', { name: 'Salva per il mio account' })).toBeEnabled();
  });
  it('keeps a failed read distinct from an unsaved default', async () => {
    vi.mocked(orgComplianceSenderApi.get).mockRejectedValue(new Error('network'));
    show();
    expect(await screen.findByText(/Non riusciamo a leggere la scelta/)).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });
});
