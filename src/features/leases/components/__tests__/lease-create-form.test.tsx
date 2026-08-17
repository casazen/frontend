import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { LeaseCreateForm } from '../lease-create-form';

vi.mock('@/queries/use-properties', () => ({
  useProperties: () => ({
    data: [{ id: 'prop-1', name: 'Il Parco', city: 'Seveso' }],
  }),
}));

vi.mock('@/api/properties.api', () => ({
  propertiesApi: {
    getDocuments: vi.fn().mockResolvedValue([{ documentType: 'Ape' }]),
  },
}));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock);

function renderForm(onSubmit = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <LeaseCreateForm onSubmit={onSubmit} />
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

describe('LeaseCreateForm canone concordato', () => {
  beforeEach(() => {
    void i18n.changeLanguage('it');
  });

  it('shows the calculator when CanoneConcordato is selected with a property', async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText(i18n.t('leases.form.propertyLabel')), {
      target: { value: 'prop-1' },
    });
    fireEvent.change(screen.getByLabelText(i18n.t('leases.form.fiscalRegimeLabel')), {
      target: { value: 'CanoneConcordato' },
    });

    expect(await screen.findByText(i18n.t('leases.canoneConcordato.title'))).toBeInTheDocument();
  });
});
