import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { propertyPreparationApi } from '@/api/property-activation.api';
import i18n from '@/i18n/config';
import { AdminPropertyPreparationPage } from '../admin-property-preparation-page';

vi.mock('@/components/layout/app-shell', () => ({ AppShell: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/components/layout/page-header', () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock('@/api/property-activation.api', () => ({
  propertyActivationApi: { record: vi.fn() },
  propertyPreparationApi: { candidates: vi.fn(), recent: vi.fn(), start: vi.fn() },
}));

describe('AdminPropertyPreparationPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  it('lists existing properties without a file and starts a batch only with selected ready properties', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.mocked(propertyPreparationApi.candidates).mockResolvedValue({
      hasMore: false,
      items: [
        { orgId: 'quokka', organizationName: 'Quokka360', propertyId: 'lario', propertyName: 'Lario Suite Brienno', missingFields: [] },
        { orgId: 'quokka', organizationName: 'Quokka360', propertyId: 'urban', propertyName: 'Urban Residence 06', missingFields: ['location', 'contact.phone'] },
        { orgId: 'quokka', organizationName: 'Quokka360', propertyId: 'florida', propertyName: 'Florida Ascona Room 10', missingFields: ['location'] },
      ],
    });
    vi.mocked(propertyPreparationApi.recent).mockResolvedValue([]);
    vi.mocked(propertyPreparationApi.start).mockResolvedValue({ id: 'batch', rows: [] });

    const { unmount } = render(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={client}><AdminPropertyPreparationPage /></QueryClientProvider>
      </I18nextProvider>,
    );

    const ready = await screen.findByRole('checkbox', { name: /Lario Suite Brienno/ });
    expect(ready).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Urban Residence 06.*coordinate.*telefono/ })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /Florida Ascona Room 10/ })).toBeDisabled();
    const start = screen.getByRole('button', { name: 'Prepara gli immobili selezionati' });
    expect(start).toBeDisabled();
    fireEvent.click(ready);
    fireEvent.click(start);

    await waitFor(() => expect(propertyPreparationApi.start).toHaveBeenCalledWith([{ orgId: 'quokka', propertyId: 'lario' }]));
    unmount();
    client.clear();
  });
});
