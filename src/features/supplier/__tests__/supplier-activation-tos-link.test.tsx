import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { SupplierProfile } from '@/types/supplier';
import { SupplierActivationPage } from '../supplier-activation-page';

const supplier = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  completeActivation: vi.fn(),
}));

vi.mock('@/queries/use-supplier', () => ({
  useSupplierActivation: () => ({ data: { status: 'Pending' }, isLoading: false }),
  useSupplierProfile: () => ({
    data: { categories: [], comuni: [], tosAcceptedAt: null } as unknown as SupplierProfile,
    isLoading: false,
  }),
  useUpdateSupplierProfile: () => ({ mutateAsync: supplier.updateProfile }),
  useCompleteSupplierActivation: () => ({ mutateAsync: supplier.completeActivation }),
  useSetIcalFeed: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/queries/use-service-categories', () => ({
  useServiceCategories: () => ({ data: [] }),
}));

vi.mock('@/features/service-requests/components/service-category-picker', () => ({
  ServiceCategoryPicker: () => null,
}));

function renderPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <SupplierActivationPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('SupplierActivationPage: the Terms of Service the supplier accepts (LEGAL-TEXTS)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    supplier.updateProfile.mockResolvedValue(undefined);
    await i18n.changeLanguage('it');
  });

  it('links the published Terms of Service from the acceptance checkbox, in a new tab', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: new RegExp(i18n.t('supplier.continueToCalendar')) }));

    const link = await screen.findByTestId('supplier-tos-read');
    expect(link).toHaveAttribute('href', '/legale/termini');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(link).toHaveTextContent('Leggi i Termini di Servizio');
    // The label names the Terms of Service (no longer a "supplier terms" document that nobody can read).
    expect(screen.getByLabelText(/Accetto i Termini di Servizio di CasaZen/)).toBeInTheDocument();
  });

  it('shows the same link in English', async () => {
    await i18n.changeLanguage('en');
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: new RegExp(i18n.t('supplier.continueToCalendar')) }));

    await waitFor(() => expect(screen.getByTestId('supplier-tos-read')).toHaveTextContent('Read the Terms of Service'));
    expect(screen.getByLabelText(/I accept the CasaZen Terms of Service/)).toBeInTheDocument();
  });
});
