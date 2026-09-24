import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { ServiceRequestForm } from '../service-request-form';

const { createServiceRequest } = vi.hoisted(() => ({
  createServiceRequest: vi.fn(),
}));

// Real TanStack mutation around a mocked network call: the form's hook behaves as in the app.
vi.mock('@/queries/use-service-requests', async () => {
  const { useMutation } = await import('@tanstack/react-query');
  return {
    useCreateServiceRequest: () => useMutation({ mutationFn: createServiceRequest }),
  };
});

function renderForm(props: Partial<React.ComponentProps<typeof ServiceRequestForm>> = {}) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ServiceRequestForm
          propertyId="prop-1"
          supplierOrgId="sup-chosen"
          open
          onOpenChange={vi.fn()}
          hideTrigger
          {...props}
        />
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe('ServiceRequestForm', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    createServiceRequest.mockResolvedValue({ id: 'sr-1' });
    await i18n.changeLanguage('it');
  });

  it('ServiceRequestForm_ChosenSupplier_SubmitsManualRequestWithNotes', async () => {
    const onOpenChange = vi.fn();
    renderForm({ onOpenChange, preselectedCategory: 'plumbing' });

    fireEvent.change(screen.getByLabelText(i18n.t('serviceRequest.notes')), {
      target: { value: 'Chiavi in portineria' },
    });
    fireEvent.click(screen.getByTestId('submit-service-request'));

    await waitFor(() => expect(createServiceRequest).toHaveBeenCalledTimes(1));
    expect(createServiceRequest.mock.calls[0][0]).toEqual({
      propertyId: 'prop-1',
      supplierOrgId: 'sup-chosen',
      category: 'plumbing',
      urgency: 'Normal',
      notes: 'Chiavi in portineria',
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('ServiceRequestForm_Opened_ShowsNoAiMatchOrExternalSuggestions', () => {
    renderForm();

    // D11: AI supplier discovery is off; nothing presents LLM output as "top rated on Google".
    expect(screen.queryByTestId('ai-recommended-supplier')).not.toBeInTheDocument();
    expect(screen.queryByText(/Google/i)).not.toBeInTheDocument();
    expect(screen.getByText(i18n.t('serviceRequest.propertyScopedDescription'))).toBeInTheDocument();
  });

  it('ServiceRequestForm_CreateFails_KeepsDialogOpen', async () => {
    const onOpenChange = vi.fn();
    createServiceRequest.mockRejectedValue(new Error('network'));
    renderForm({ onOpenChange });

    fireEvent.click(screen.getByTestId('submit-service-request'));

    await waitFor(() => expect(createServiceRequest).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('submit-service-request')).toBeEnabled());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
