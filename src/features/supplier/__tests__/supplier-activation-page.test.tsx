import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { ActivationStatus, ActivationStep, SupplierProfile } from '@/types/supplier';
import { SupplierActivationPage } from '../supplier-activation-page';

const api = vi.hoisted(() => ({
  fetchSupplierActivation: vi.fn(),
  fetchSupplierProfile: vi.fn(),
  updateSupplierProfile: vi.fn(),
  saveSupplierActivationStep: vi.fn(),
  completeSupplierActivation: vi.fn(),
  acceptSupplierTos: vi.fn(),
}));

vi.mock('@/services/supplier-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/supplier-api')>()),
  ...api,
}));

// SU-04: the comune field reads the status of the official list; these tests are about the wizard, so it is "not imported".
vi.mock('@/queries/use-comuni', () => ({
  useComuneDatasetStatus: () => ({ data: { datasetAvailable: false }, isLoading: false, isError: false }),
  useComuneSearch: () => ({ data: undefined, isLoading: false, isError: false }),
  useComune: () => ({ data: undefined, isLoading: false, isError: false }),
}));

vi.mock('@/queries/use-service-categories', () => ({
  useServiceCategories: () => ({ data: [] }),
}));

vi.mock('@/features/service-requests/components/service-category-picker', () => ({
  ServiceCategoryPicker: () => null,
}));

const PROFILE: SupplierProfile = {
  orgId: 'org-1',
  status: 'Pending',
  legalName: 'Pulizie Roma Srl',
  phone: '+39 06 123456',
  email: 'info@pulizie.test',
  categories: [],
  comuni: [],
  bio: null,
  photoUrls: [],
  tosAcceptedAt: null,
};

const TOS_VERSION = '2026-10-v1';

function steps(overrides: Partial<Record<ActivationStep['id'], Partial<ActivationStep>>> = {}): ActivationStep[] {
  const base: ActivationStep[] = [
    { id: 'identity', status: 'completed', blocker: null, required: true },
    { id: 'services', status: 'pending', blocker: 'categories_missing', required: true },
    { id: 'showcase', status: 'pending', blocker: null, required: false },
    { id: 'profile', status: 'pending', blocker: 'bio_missing', required: true },
    { id: 'terms', status: 'pending', blocker: 'tos_not_accepted', required: true },
  ];
  return base.map((step) => ({ ...step, ...overrides[step.id] }));
}

function activation(overrides: Partial<ActivationStatus> = {}): ActivationStatus {
  return {
    status: 'Pending',
    currentStep: 2,
    steps: steps(),
    tos: { currentVersion: TOS_VERSION, acceptedVersion: null, acceptedAt: null, reacceptanceRequired: false, blocksActions: false },
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/app/supplier/activation']}>
          <Routes>
            <Route path="/app/supplier/activation" element={<SupplierActivationPage />} />
            <Route path="/app/supplier/dashboard" element={<div data-testid="dashboard" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe('SupplierActivationPage: wizard persisted by the server (SU-05, A4-09)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    api.fetchSupplierProfile.mockResolvedValue(PROFILE);
    api.fetchSupplierActivation.mockResolvedValue(activation());
    api.updateSupplierProfile.mockResolvedValue(PROFILE);
    api.saveSupplierActivationStep.mockResolvedValue(undefined);
    api.completeSupplierActivation.mockResolvedValue({ status: 'Active' });
    api.acceptSupplierTos.mockResolvedValue(undefined);
    await i18n.changeLanguage('it');
  });

  it('opens at the step the server remembers, not at the first one', async () => {
    api.fetchSupplierActivation.mockResolvedValue(activation({ currentStep: 4 }));
    renderPage();

    expect(await screen.findByLabelText('Descrizione')).toBeInTheDocument();
    expect(screen.getByTestId('supplier-activation-step-of')).toHaveTextContent('Passo 4 di 5');
  });

  it('saves the step on the server when the supplier moves to another one', async () => {
    renderPage();

    fireEvent.click(await screen.findByTestId('supplier-activation-nav-profile'));

    await waitFor(() => expect(api.saveSupplierActivationStep.mock.calls[0]?.[0]).toBe(4));
    expect(await screen.findByLabelText('Descrizione')).toBeInTheDocument();
  });

  it('saves the description and moves on to step 5, remembering it', async () => {
    api.fetchSupplierActivation.mockResolvedValue(activation({ currentStep: 4 }));
    renderPage();

    fireEvent.change(await screen.findByLabelText('Descrizione'), { target: { value: 'Pulizie professionali a Roma' } });
    fireEvent.click(screen.getByRole('button', { name: /Salva e continua/ }));

    await waitFor(() => expect(api.updateSupplierProfile.mock.calls[0]?.[0]).toEqual({ bio: 'Pulizie professionali a Roma' }));
    await waitFor(() => expect(api.saveSupplierActivationStep.mock.calls[0]?.[0]).toBe(5));
    expect(await screen.findByTestId('supplier-activation-summary')).toBeInTheDocument();
  });

  it('lists what is still missing on the last step and keeps "Attiva profilo" disabled even with the Terms accepted', async () => {
    api.fetchSupplierActivation.mockResolvedValue(activation({ currentStep: 5 }));
    renderPage();

    expect(await screen.findByTestId('supplier-activation-blocker-categories_missing')).toHaveTextContent(
      'Almeno una categoria di servizio',
    );
    expect(screen.getByTestId('supplier-activation-blocker-bio_missing')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Accetto i Termini di Servizio di CasaZen/));

    expect(screen.getByRole('button', { name: 'Attiva profilo' })).toBeDisabled();
    expect(api.completeSupplierActivation).not.toHaveBeenCalled();
  });

  it('activates with the Terms version it showed once every requirement is met', async () => {
    api.fetchSupplierActivation.mockResolvedValue(
      activation({
        currentStep: 5,
        steps: steps({
          services: { status: 'completed', blocker: null },
          profile: { status: 'completed', blocker: null },
        }),
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByLabelText(/versione 2026-10-v1/));
    fireEvent.click(screen.getByRole('button', { name: 'Attiva profilo' }));

    await waitFor(() => expect(api.completeSupplierActivation).toHaveBeenCalledWith(true, TOS_VERSION));
    expect(await screen.findByTestId('dashboard')).toBeInTheDocument();
  });

  it('links the published Terms of Service from the acceptance checkbox, in a new tab', async () => {
    api.fetchSupplierActivation.mockResolvedValue(activation({ currentStep: 5 }));
    renderPage();

    const link = await screen.findByTestId('supplier-tos-read');
    expect(link).toHaveAttribute('href', '/legale/termini');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(link).toHaveTextContent('Leggi i Termini di Servizio');
  });

  it('shows the same acceptance in English, naming the version', async () => {
    await i18n.changeLanguage('en');
    api.fetchSupplierActivation.mockResolvedValue(activation({ currentStep: 5 }));
    renderPage();

    expect(await screen.findByLabelText(/I accept the CasaZen Terms of Service \(version 2026-10-v1\)/)).toBeInTheDocument();
    expect(screen.getByTestId('supplier-tos-read')).toHaveTextContent('Read the Terms of Service');
  });

  it('says it could not load, with a retry, when the activation request fails (never an endless spinner)', async () => {
    api.fetchSupplierActivation.mockRejectedValueOnce(new Error('boom'));
    renderPage();

    expect(await screen.findByTestId('supplier-activation-error')).toHaveTextContent('Impossibile caricare l\'attivazione del profilo.');

    api.fetchSupplierActivation.mockResolvedValue(activation());
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByTestId('supplier-activation-page')).toBeInTheDocument();
  });

  it('asks an active supplier that accepted an older version to accept the current one, and records it', async () => {
    api.fetchSupplierActivation.mockResolvedValue(
      activation({
        status: 'Active',
        tos: { currentVersion: TOS_VERSION, acceptedVersion: '2025-01-v1', acceptedAt: '2025-02-01T10:00:00Z', reacceptanceRequired: true, blocksActions: true },
      }),
    );
    renderPage();

    expect(await screen.findByTestId('supplier-tos-reacceptance')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accetta e continua' })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Accetto i Termini di Servizio di CasaZen/));
    fireEvent.click(screen.getByRole('button', { name: 'Accetta e continua' }));

    await waitFor(() => expect(api.acceptSupplierTos.mock.calls[0]?.[0]).toBe(TOS_VERSION));
    expect(await screen.findByTestId('dashboard')).toBeInTheDocument();
  });

  it('sends an active supplier with the current Terms straight to the dashboard', async () => {
    api.fetchSupplierActivation.mockResolvedValue(activation({ status: 'Active' }));
    renderPage();

    expect(await screen.findByTestId('dashboard')).toBeInTheDocument();
  });

  it('tells a suspended supplier it cannot activate itself instead of showing the wizard', async () => {
    api.fetchSupplierActivation.mockResolvedValue(activation({ status: 'Suspended' }));
    renderPage();

    expect(await screen.findByTestId('supplier-activation-suspended')).toBeInTheDocument();
    expect(screen.queryByTestId('supplier-activation-page')).not.toBeInTheDocument();
  });
});
