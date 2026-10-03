import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { AdminSeoApi } from '@/api/admin-seo.api';
import type { SeoTopComuniResponse } from '@/types/seo.types';
import { SeoTopComuniWidget } from './seo-top-comuni-widget';

vi.mock('@/api/admin-seo.api', () => ({ AdminSeoApi: { getTopComuni: vi.fn() } }));

const RESPONSE: SeoTopComuniResponse = {
  days: 30,
  from: '2026-09-01T00:00:00Z',
  to: '2026-10-01T00:00:00Z',
  retentionDays: 90,
  items: [
    { comuneCode: '013075', comuneName: 'Como', ctaClicks: 12345, signupStarts: 80, signups: 7 },
    { comuneCode: '015146', comuneName: 'Milano', ctaClicks: 20, signupStarts: 0, signups: 0 },
  ],
};

function problemError(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data: { status, code: 'internal_error' },
  });
}

function renderWidget() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SeoTopComuniWidget />
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
  vi.mocked(AdminSeoApi.getTopComuni).mockReset();
});

afterEach(() => cleanup());

describe('SeoTopComuniWidget (SE-04, #300 AC9, A8-11)', () => {
  it('SeoTopComuniWidget_Loading_ShowsSkeletons', () => {
    vi.mocked(AdminSeoApi.getTopComuni).mockReturnValue(new Promise(() => {}));

    renderWidget();

    expect(screen.getByTestId('seo-top-comuni-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('seo-top-comuni-empty')).not.toBeInTheDocument();
  });

  it('SeoTopComuniWidget_Data_ListsComuniWithClicksStartedSignupsAndSignups', async () => {
    vi.mocked(AdminSeoApi.getTopComuni).mockResolvedValue(RESPONSE);

    renderWidget();

    const como = await screen.findByTestId('seo-top-comune-013075');
    expect(AdminSeoApi.getTopComuni).toHaveBeenCalledWith(30);
    expect(como).toHaveTextContent('Como');
    expect(como).toHaveTextContent('12.345');
    expect(within(como).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Como', '12.345', '80', '7']);
    expect(screen.getByTestId('seo-top-comune-015146')).toHaveTextContent('Milano');
    expect(screen.getByTestId('seo-top-comuni-retention')).toHaveTextContent('eliminati dopo 90 giorni');
  });

  it('SeoTopComuniWidget_NoEvents_ShowsTheEmptyStateAndTheRetention', async () => {
    vi.mocked(AdminSeoApi.getTopComuni).mockResolvedValue({ ...RESPONSE, items: [] });

    renderWidget();

    expect(await screen.findByTestId('seo-top-comuni-empty')).toHaveTextContent('Nessun clic registrato negli ultimi 30 giorni');
    expect(screen.queryByTestId('seo-top-comuni-table')).not.toBeInTheDocument();
    expect(screen.getByTestId('seo-top-comuni-retention')).toBeInTheDocument();
  });

  it('SeoTopComuniWidget_RequestFails_ShowsTheErrorWithRetryNotAnEmptyTable', async () => {
    vi.mocked(AdminSeoApi.getTopComuni).mockRejectedValueOnce(problemError(500)).mockResolvedValueOnce(RESPONSE);

    renderWidget();

    const alert = await screen.findByTestId('seo-top-comuni-error');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(screen.queryByTestId('seo-top-comuni-empty')).not.toBeInTheDocument();

    fireEvent.click(within(alert).getByRole('button', { name: 'Riprova' }));

    await waitFor(() => expect(screen.getByTestId('seo-top-comuni-table')).toBeInTheDocument());
  });

  it('SeoTopComuniWidget_English_ShowsTheTextsInEnglishWithEnglishNumbers', async () => {
    await i18n.changeLanguage('en');
    vi.mocked(AdminSeoApi.getTopComuni).mockResolvedValue(RESPONSE);

    renderWidget();

    expect(await screen.findByText('Municipalities that convert')).toBeInTheDocument();
    expect(await screen.findByTestId('seo-top-comune-013075')).toHaveTextContent('12,345');
    expect(screen.getByTestId('seo-top-comuni-retention')).toHaveTextContent('deleted after 90 days');
  });
});
