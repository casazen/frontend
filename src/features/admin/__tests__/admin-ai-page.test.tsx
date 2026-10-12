import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { AdminSeoApi } from '@/api/admin-seo.api';
import { AdminAiPage } from '../admin-ai-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/admin-seo.api', () => ({
  AdminSeoApi: {
    getAiSettings: vi.fn(),
    updateAiSettings: vi.fn(),
  },
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string; action?: ReactNode }) => createElement('h1', null, title),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(AdminAiPage))),
  );
}

describe('AdminAiPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    vi.mocked(AdminSeoApi.getAiSettings).mockResolvedValue({
      provider: 'Stub',
      externalActive: false,
      apiKeyConfigured: false,
      apiKeyHint: null,
      model: 'deepseek-v4-flash',
      baseUrl: 'https://api.deepseek.com',
      source: 'environment',
      hasStoredKey: false,
    });
    vi.mocked(AdminSeoApi.updateAiSettings).mockResolvedValue({
      provider: 'OpenAI',
      externalActive: true,
      apiKeyConfigured: true,
      apiKeyHint: '••••cret',
      model: 'gpt-4o-mini',
      baseUrl: 'https://api.openai.com/v1',
      source: 'admin',
      hasStoredKey: true,
    });
  });

  it('selecting OpenAI fills the preset and the save sends the key once', async () => {
    renderPage();

    expect(await screen.findByTestId('admin-ai-status')).toHaveTextContent('Nessun provider esterno attivo');
    fireEvent.change(screen.getByTestId('admin-ai-provider'), { target: { value: 'OpenAI' } });

    expect(screen.getByTestId('admin-ai-model')).toHaveValue('gpt-4o-mini');
    expect(screen.getByTestId('admin-ai-base-url')).toHaveValue('https://api.openai.com/v1');
    expect(screen.getByTestId('admin-ai-transfer-warning')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('admin-ai-key'), { target: { value: 'sk-openai-secret' } });
    fireEvent.click(screen.getByTestId('admin-ai-save'));

    await waitFor(() =>
      expect(AdminSeoApi.updateAiSettings).toHaveBeenCalledWith({
        provider: 'OpenAI',
        model: 'gpt-4o-mini',
        baseUrl: 'https://api.openai.com/v1',
        clearApiKey: false,
        apiKey: 'sk-openai-secret',
      }),
    );
    expect(screen.getByTestId('admin-ai-key')).toHaveValue('');
  });
});
