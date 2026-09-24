import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ComplianceSummaryWidget } from '../compliance-summary-widget';
import { fetchComplianceSummary } from '@/api/compliance.api';
import type { ComplianceSummaryResult } from '@/types/compliance.types';

vi.mock('@/api/compliance.api', () => ({
  fetchComplianceSummary: vi.fn(),
  fetchComplianceActivation: vi.fn(),
  completeComplianceActivation: vi.fn(),
  startCheckoutWizard: vi.fn(),
  completeCheckoutWizard: vi.fn(),
}));

const empty = { count: 0, items: [] };

function renderWidget() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(MemoryRouter, null, createElement(ComplianceSummaryWidget)),
    ),
  );
}

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe('ComplianceSummaryWidget (CO-11)', () => {
  it('widget_AlloggiatiToSendManually_IsCountedInOrangeNotAllClear', async () => {
    const summary: ComplianceSummaryResult = {
      propertiesPending: empty,
      guestCheckInsIncomplete: empty,
      checkoutsDue: empty,
      alloggiatiFailures: empty,
      alloggiatiManualRequired: {
        count: 12,
        items: [{ id: 'b1', label: 'Mario Rossi', routeLink: '/bookings/b1/alloggiati' }],
      },
    };
    vi.mocked(fetchComplianceSummary).mockResolvedValue(summary);

    renderWidget();

    const count = await screen.findByTestId('compliance-summary-alloggiati-manual-count');
    expect(count).toHaveTextContent('12');
    expect(count.className).toContain('bg-orange-500');
    expect(count.className).not.toContain('bg-green');
    expect(screen.getByText('Alloggiati da inviare manualmente')).toBeInTheDocument();
    expect(screen.getByTestId('compliance-summary-alloggiati-manual-more')).toHaveTextContent('e altri 11');
    expect(screen.queryByText('Tutte le attività di compliance sono aggiornate.')).not.toBeInTheDocument();
  });
});
