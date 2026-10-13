import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@/i18n/config';
import { AdminApi } from '@/api/admin.api';
import { AdminDemoPage } from '../admin-demo-page';

vi.mock('@/api/admin.api', () => ({
  AdminApi: {
    getDemoStatus: vi.fn(),
    listDemoOrgs: vi.fn(),
    setDemoEnabled: vi.fn(),
    applyDemoCompliance: vi.fn(),
    resetDemoShowcase: vi.fn(),
  },
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));

const status = {
  available: true,
  enabled: true,
  templateVersion: '2026-10-12.1',
  lastResetAt: null,
  showcaseProperties: 0,
  scenarios: ['short-stay-published-lombardia'],
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(createElement(QueryClientProvider, { client }, createElement(AdminDemoPage) as ReactNode));
}

describe('AdminDemoPage', () => {
  beforeEach(() => {
    vi.mocked(AdminApi.getDemoStatus).mockResolvedValue(status);
    vi.mocked(AdminApi.listDemoOrgs).mockResolvedValue([
      { id: 'org-1', name: 'Luca La Malfa', slug: 'luca' },
    ]);
    vi.mocked(AdminApi.applyDemoCompliance).mockResolvedValue({
      propertiesSeen: 4,
      published: 4,
      alreadyComplete: 0,
      filled: 4,
    });
  });

  it('fills test compliance for the chosen organization', async () => {
    renderPage();

    expect(await screen.findByRole('option', { name: /Luca La Malfa/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Organizzazione'), { target: { value: 'org-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Completa conformità di test' }));

    expect(await screen.findByText('Pubblicati 4 annunci. Dati di test scritti su 4.')).toBeInTheDocument();
    expect(AdminApi.applyDemoCompliance).toHaveBeenCalledWith('org-1');
  });

  it('asks for RESET before rebuilding the showcase', async () => {
    renderPage();
    expect(await screen.findByRole('option', { name: /Luca La Malfa/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Organizzazione'), { target: { value: 'org-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reimposta la vetrina' }));

    const confirm = screen.getByTestId('demo-reset-confirm');
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('RESET'), { target: { value: 'RESET' } });
    expect(confirm).toBeEnabled();
  });
});
