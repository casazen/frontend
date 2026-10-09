import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n/config';
import { AdminSeoApi } from '@/api/admin-seo.api';
import { MarketingPage } from '../marketing-page';

vi.mock('@/api/admin-seo.api', () => ({
  AdminSeoApi: {
    getTopComuni: vi.fn(),
  },
}));

vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, description }: { title: string; description?: string }) =>
    createElement('div', null, createElement('h1', null, title), description ? createElement('p', null, description) : null),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(createElement(QueryClientProvider, { client }, createElement(MarketingPage)));
}

// SE-03: marketing section surfaces existing tracking data; no new events added.
describe('MarketingPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  it('render_Default_ShowsPageHeader', () => {
    vi.mocked(AdminSeoApi.getTopComuni).mockResolvedValue({ items: [], days: 30, retentionDays: 90 });

    renderPage();

    expect(screen.getByRole('heading', { name: i18n.t('admin.marketing.title') })).toBeInTheDocument();
  });

  it('render_Default_ShowsScopeNotice', () => {
    vi.mocked(AdminSeoApi.getTopComuni).mockResolvedValue({ items: [], days: 30, retentionDays: 90 });

    renderPage();

    expect(screen.getByTestId('marketing-scope-notice')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('admin.marketing.scopeNotice'))).toBeInTheDocument();
  });

  it('render_Default_ShowsAttributionsPlaceholderWithApiEndpoint', () => {
    vi.mocked(AdminSeoApi.getTopComuni).mockResolvedValue({ items: [], days: 30, retentionDays: 90 });

    renderPage();

    expect(screen.getByTestId('marketing-attributions-placeholder')).toBeInTheDocument();
    expect(screen.getByTestId('marketing-attributions-api-note')).toBeInTheDocument();
    expect(screen.getByText(/\/api\/admin\/attributions/)).toBeInTheDocument();
  });

  it('render_TopComuniData_ShowsTopComuniWidget', async () => {
    vi.mocked(AdminSeoApi.getTopComuni).mockResolvedValue({
      items: [{ comuneCode: '058091', comuneName: 'Roma', ctaClicks: 42, signupStarts: 10, signups: 5 }],
      days: 30,
      retentionDays: 90,
    });

    renderPage();

    expect(await screen.findByTestId('seo-top-comuni-widget')).toBeInTheDocument();
    expect(await screen.findByText('Roma')).toBeInTheDocument();
  });
});
