import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '@/api/client';
import i18n from '@/i18n/config';
import { useCampaignDraftStore } from '../campaign-draft-store';
import { CampaignWizard } from '../campaign-wizard';

vi.mock('@/api/client', () => ({ ApiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

let segments: Array<Record<string, unknown>>;

function view(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>{node}</QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  vi.resetAllMocks();
  segments = [];
  useCampaignDraftStore.getState().forget();
  await i18n.changeLanguage('it');
  vi.mocked(ApiClient.get).mockImplementation(async (path: string) => {
    if (path === '/properties') return [{ id: 'house', name: 'Villa Sofia', photoUrls: ['https://img.example/villa.jpg'] }];
    if (path === '/campaigns/segments') return segments;
    if (path.endsWith('/preview')) return { count: 12 };
    throw new Error(path);
  });
  vi.mocked(ApiClient.post).mockImplementation(async (path: string, data?: unknown) => {
    if (path === '/campaigns/segments/preview') return { count: 12 };
    if (path === '/campaigns/segments') {
      const created = { id: 'group-1', createdAt: '2026-11-27T10:00:00Z', ...(data as object) };
      segments = [created];
      return created;
    }
    if (path === '/campaigns/studio/generate') return { id: 'asset-1', subject: 'Grazie di essere stati con noi', body: 'Ciao! Torna presto a Villa Sofia.' };
    if (path === '/campaigns/studio/assets/asset-1/draft') return { id: 'campaign-1' };
    if (path === '/campaigns/campaign-1/submit') return undefined;
    throw new Error(path);
  });
});

async function readyNext() {
  const button = await screen.findByTestId('campaign-wizard-next');
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}

describe('campaign wizard', () => {
  it('takes the host from the goal to the approval queue, creating the suggested group on the way', async () => {
    const onOpenChange = vi.fn();
    view(<CampaignWizard open onOpenChange={onOpenChange} />);

    fireEvent.click(await screen.findByTestId('campaign-goal-thanks'));
    expect(await screen.findByTestId('campaign-recipe-recent')).toBeChecked();

    fireEvent.click(await readyNext());
    await waitFor(() =>
      expect(ApiClient.post).toHaveBeenCalledWith(
        '/campaigns/segments',
        expect.objectContaining({ name: 'Ospiti recenti' }),
      ),
    );

    fireEvent.click(await screen.findByTestId('campaign-generate'));
    expect(await screen.findByDisplayValue('Grazie di essere stati con noi')).toBeVisible();
    expect(screen.getByText(/Testo scritto dall'AI/)).toBeVisible();
    expect(ApiClient.post).toHaveBeenCalledWith(
      '/campaigns/studio/generate',
      expect.objectContaining({ propertyId: 'house', segmentId: 'group-1', channel: 'email' }),
      expect.anything(),
    );
    expect(screen.getByTestId('email-preview')).toHaveTextContent('Torna presto a Villa Sofia');

    fireEvent.click(screen.getByTestId('campaign-wizard-next'));
    expect(await screen.findByRole('heading', { name: 'Controlla e invia' })).toBeVisible();

    fireEvent.click(screen.getByTestId('campaign-wizard-next'));
    expect(await screen.findByText('Campagna inviata per approvazione')).toBeVisible();
    expect(ApiClient.post).toHaveBeenCalledWith('/campaigns/studio/assets/asset-1/draft', {
      subject: 'Grazie di essere stati con noi',
      body: 'Ciao! Torna presto a Villa Sofia.',
    });
    expect(ApiClient.post).toHaveBeenCalledWith('/campaigns/campaign-1/submit', {});
    expect(screen.getByTestId('campaign-wizard-queue')).toHaveAttribute('href', '/app/short-rent/approval-queue');
    expect(useCampaignDraftStore.getState().remembered).toBeNull();
  });

  it('asks for what to offer before it lets the AI write, and writes nothing it was not told', async () => {
    view(<CampaignWizard open onOpenChange={() => undefined} initialGoalId="offer" />);
    fireEvent.click(await readyNext());
    const generate = await screen.findByTestId('campaign-generate');
    expect(generate).toBeDisabled();

    fireEvent.change(screen.getByTestId('campaign-details'), { target: { value: '10% di sconto su settembre' } });
    expect(generate).toBeEnabled();
    fireEvent.click(generate);
    await waitFor(() =>
      expect(ApiClient.post).toHaveBeenCalledWith(
        '/campaigns/studio/generate',
        expect.objectContaining({ brief: expect.stringContaining('10% di sconto su settembre') }),
        expect.anything(),
      ),
    );
  });

  it('keeps the campaign when the layer is closed and offers to resume it', async () => {
    const first = view(<CampaignWizard open onOpenChange={() => undefined} />);
    fireEvent.click(await screen.findByTestId('campaign-goal-comeback'));
    await screen.findByTestId('campaign-recipe-lost');
    first.unmount();

    view(<CampaignWizard open onOpenChange={() => undefined} />);
    expect(await screen.findByText('Hai una campagna a metà')).toBeVisible();
    fireEvent.click(screen.getByTestId('campaign-resume'));
    expect(await screen.findByTestId('campaign-recipe-lost')).toBeChecked();

    act(() => useCampaignDraftStore.getState().forget());
  });

  it('lets the host write the text by hand when the AI is not available', async () => {
    vi.mocked(ApiClient.post).mockImplementation(async (path: string, data?: unknown) => {
      if (path === '/campaigns/segments/preview') return { count: 12 };
      if (path === '/campaigns/segments') {
        const created = { id: 'group-1', createdAt: '2026-11-27T10:00:00Z', ...(data as object) };
        segments = [created];
        return created;
      }
      if (path === '/campaigns') return { id: 'campaign-9', ...(data as object), status: 'Draft', segmentName: 'Ospiti recenti' };
      throw new Error(path);
    });
    view(<CampaignWizard open onOpenChange={() => undefined} initialGoalId="thanks" />);
    fireEvent.click(await readyNext());
    fireEvent.click(await screen.findByTestId('campaign-manual'));
    fireEvent.change(await screen.findByTestId('campaign-subject'), { target: { value: 'Grazie' } });
    fireEvent.change(screen.getByTestId('campaign-body'), { target: { value: 'A presto' } });
    fireEvent.click(screen.getByTestId('campaign-wizard-next'));
    fireEvent.click(await screen.findByTestId('campaign-save-draft'));

    expect(await screen.findByText('Bozza salvata')).toBeVisible();
    expect(ApiClient.post).toHaveBeenCalledWith('/campaigns', { propertyId: 'house', segmentId: 'group-1', subject: 'Grazie', body: 'A presto' });
  });
});
