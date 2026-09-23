import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import type { SupplierMatchResponse } from '@/types/service-request';
import { ServiceRequestForm } from '../service-request-form';

const { matchSupplier, createServiceRequest } = vi.hoisted(() => ({
  matchSupplier: vi.fn(),
  createServiceRequest: vi.fn(),
}));

// Real TanStack mutations around mocked network calls: the form's hooks behave as in the app.
vi.mock('@/queries/use-service-requests', async () => {
  const { useMutation } = await import('@tanstack/react-query');
  return {
    useMatchSupplier: () => useMutation({ mutationFn: matchSupplier }),
    useCreateServiceRequest: () => useMutation({ mutationFn: createServiceRequest }),
  };
});

const MATCH: SupplierMatchResponse = {
  recommended: {
    orgId: 'sup-recommended',
    legalName: 'Pulizie Rossi',
    phone: '+39 000 0000000',
    email: 'rossi@example.test',
    matchScore: 92,
    matchReason: 'Closest supplier',
    source: 'internal',
  },
  alternatives: [],
  externalSuggestions: [],
  usedExternalFallback: false,
};

function renderForm(props: Partial<React.ComponentProps<typeof ServiceRequestForm>> = {}) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ServiceRequestForm propertyId="prop-1" open onOpenChange={vi.fn()} hideTrigger {...props} />
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

function matchPayload(call: number) {
  return matchSupplier.mock.calls[call][0];
}

describe('ServiceRequestForm', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    matchSupplier.mockResolvedValue(MATCH);
    await i18n.changeLanguage('en');
  });

  it('ServiceRequestForm_MatchReturnsRecommendation_PreselectsRecommendedSupplier', async () => {
    renderForm();

    await waitFor(() => expect(screen.getByTestId('submit-service-request')).toBeEnabled());
    expect(matchSupplier).toHaveBeenCalledTimes(1);
    expect(matchPayload(0)).toEqual({
      propertyId: 'prop-1',
      category: 'cleaning',
      urgency: 'Normal',
      notes: undefined,
    });
    expect(screen.getByTestId('ai-recommended-supplier')).toHaveClass('border-primary');
  });

  it('ServiceRequestForm_NotesTyped_RerunsMatchOnlyWhenCriteriaChange', async () => {
    renderForm();
    await waitFor(() => expect(matchSupplier).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText(i18n.t('serviceRequest.notes')), {
      target: { value: 'Keys at the front desk' },
    });
    await waitFor(() => expect(screen.getByTestId('submit-service-request')).toBeEnabled());
    expect(matchSupplier).toHaveBeenCalledTimes(1);

    const category = screen.getByLabelText(i18n.t('serviceRequest.category')) as HTMLSelectElement;
    const otherCategory = Array.from(category.options).find((option) => option.value !== category.value)!.value;
    fireEvent.change(category, { target: { value: otherCategory } });

    await waitFor(() => expect(matchSupplier).toHaveBeenCalledTimes(2));
    expect(matchPayload(1)).toEqual({
      propertyId: 'prop-1',
      category: otherCategory,
      urgency: 'Normal',
      notes: 'Keys at the front desk',
    });
  });

  it('ServiceRequestForm_PreselectedSupplier_SkipsMatchAndKeepsSupplier', async () => {
    renderForm({ preselectedSupplierOrgId: 'sup-chosen' });

    await waitFor(() => expect(screen.getByTestId('submit-service-request')).toBeEnabled());
    expect(matchSupplier).not.toHaveBeenCalled();
  });
});
