import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import * as compliance from '@/features/compliance/use-compliance';
import * as properties from '@/queries/use-properties';
import * as cin from '@/queries/use-cin';
import type { ComplianceActivationResult } from '@/types/compliance.types';
import { PropertyActivationWizard } from '../activation-wizard';

vi.mock('@/features/compliance/use-compliance', () => ({
  useComplianceActivation: vi.fn(),
  useCompleteComplianceActivation: vi.fn(),
}));
vi.mock('@/queries/use-properties', () => ({
  useProperty: vi.fn(),
  usePropertyDetail: vi.fn(),
  useUpdateProperty: vi.fn(),
}));
vi.mock('@/queries/use-cin', () => ({ useUpdatePropertyCin: vi.fn() }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/shared/breadcrumb', () => ({ Breadcrumb: () => null }));
vi.mock('@/features/properties/components/document-upload-dialog', () => ({ DocumentUploadDialog: () => null }));
vi.mock('@/features/properties/components/ical-settings', () => ({ IcalSettings: () => null }));
vi.mock('@/features/compliance/components/safety-checklist-form', () => ({
  SafetyChecklistForm: ({ propertyId }: { propertyId: string }) =>
    createElement('p', { 'data-testid': 'safety-checklist-form' }, propertyId),
}));
vi.mock('@/features/properties/components/property-form', () => ({
  PropertyForm: ({ onSubmit }: { onSubmit: (data: object) => void }) =>
    createElement('button', { type: 'button', onClick: () => onSubmit({}) }, 'save-base-data'),
}));

// The wizard reads only these fields: partial objects are cast to the full hook results.
type Hook<T extends (...args: never[]) => unknown> = ReturnType<T>;

const activation: ComplianceActivationResult = {
  complianceStatus: 'Pending',
  steps: [
    { id: 'base-data', label: 'Dati base proprietà', status: 'complete', blocker: true },
    {
      id: 'cin',
      label: 'Codice CIN',
      status: 'complete',
      blocker: true,
      linkUrl: 'https://www.ministeroturismo.gov.it/banca-dati-strutture-ricettive/',
    },
    { id: 'documents', label: 'Documenti richiesti', status: 'complete', blocker: true },
    { id: 'safety', label: 'Checklist sicurezza', status: 'complete', blocker: true },
    {
      id: 'tourist-tax',
      label: 'Imposta di soggiorno',
      status: 'warning',
      blocker: false,
      message: 'Server message not shown twice',
      touristTax: { city: 'Palermo', rate: null, publicPageSlug: 'palermo' },
    },
    { id: 'ical', label: 'Sincronizzazione calendario', status: 'warning', blocker: false },
  ],
};

const completeActivation = vi.fn();

function renderWizard() {
  return render(
    <MemoryRouter initialEntries={['/app/short-rent/properties/prop-1/compliance/activation']}>
      <Routes>
        <Route path="/app/short-rent/properties/:id/compliance/activation" element={<PropertyActivationWizard />} />
        <Route path="/app/short-rent/properties/:id" element={<p>property-detail</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PropertyActivationWizard', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    const refetch = vi.fn().mockResolvedValue({});
    vi.mocked(compliance.useComplianceActivation).mockReturnValue({
      data: activation,
      isLoading: false,
      refetch,
    } as unknown as Hook<typeof compliance.useComplianceActivation>);
    completeActivation.mockResolvedValue({ complianceStatus: 'Active', incompleteBlockers: [] });
    vi.mocked(compliance.useCompleteComplianceActivation).mockReturnValue({
      mutateAsync: completeActivation,
      isPending: false,
    } as unknown as Hook<typeof compliance.useCompleteComplianceActivation>);
    vi.mocked(properties.useProperty).mockReturnValue({
      data: { id: 'prop-1', name: 'Casa Palermo', city: 'Palermo', cinCode: 'IT082053C2ABCDEFGH' },
      isLoading: false,
    } as unknown as Hook<typeof properties.useProperty>);
    vi.mocked(properties.usePropertyDetail).mockReturnValue({
      data: { documents: [] },
    } as unknown as Hook<typeof properties.usePropertyDetail>);
    vi.mocked(properties.useUpdateProperty).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    } as unknown as Hook<typeof properties.useUpdateProperty>);
    vi.mocked(cin.useUpdatePropertyCin).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    } as unknown as Hook<typeof cin.useUpdatePropertyCin>);
  });

  it('touristTaxStep_ComuneWithoutRate_ShowsWarningAndPublicPageAndDoesNotBlockCompletion', async () => {
    renderWizard();

    fireEvent.click(screen.getByRole('button', { name: 'save-base-data' }));
    const cinGuidance = await screen.findByRole('link', { name: /Come ottenere il codice CIN/ });
    expect(cinGuidance).toHaveAttribute('href', 'https://www.ministeroturismo.gov.it/banca-dati-strutture-ricettive/');

    fireEvent.click(screen.getByRole('button', { name: /Salva e continua/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Continua/ }));
    // Safety step: the D.L. 145/2023 checklist form of the property (CO-07).
    expect(await screen.findByTestId('safety-checklist-form')).toHaveTextContent('prop-1');
    fireEvent.click(await screen.findByRole('button', { name: /Continua/ }));

    const warning = await screen.findByTestId('activation-tourist-tax-missing');
    expect(warning).toHaveTextContent('Il comune di Palermo non ha ancora una tariffa in CasaZen.');
    expect(screen.getByRole('link', { name: /Guida all'imposta di soggiorno a Palermo/ })).toHaveAttribute(
      'href',
      '/p/tassa-soggiorno/palermo',
    );
    expect(document.querySelector('a[href*="/admin/"]')).toBeNull();
    expect(screen.queryByText('Server message not shown twice')).not.toBeInTheDocument();
    expect(screen.getByTestId('activation-complete-button')).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /Continua/ }));
    fireEvent.click(await screen.findByLabelText(/Confermo che l'immobile soddisfa/));
    fireEvent.click(screen.getByTestId('activation-complete-button'));

    // The safety checklist is saved in its own step: completing never sends (and overwrites) it.
    await waitFor(() => expect(completeActivation).toHaveBeenCalledWith({ tosAccepted: true }));
    expect(await screen.findByText('property-detail')).toBeInTheDocument();
  });

  it('cinStep_NoGuidanceUrl_RendersNoHardcodedLink', async () => {
    vi.mocked(compliance.useComplianceActivation).mockReturnValue({
      data: {
        ...activation,
        steps: activation.steps.map((s) => (s.id === 'cin' ? { ...s, linkUrl: null } : s)),
      },
      isLoading: false,
      refetch: vi.fn().mockResolvedValue({}),
    } as unknown as Hook<typeof compliance.useComplianceActivation>);
    renderWizard();

    fireEvent.click(screen.getByRole('button', { name: 'save-base-data' }));

    expect(await screen.findByTestId('activation-cin-input')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Come ottenere il codice CIN/ })).not.toBeInTheDocument();
    expect(document.querySelector('a[href*="casazen.app"]')).toBeNull();
  });
});
