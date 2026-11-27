import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '@/api/client';
import i18n from '@/i18n/config';
import { SegmentWizard } from '../segment-wizard';

vi.mock('@/api/client', () => ({ ApiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

const suggested = {
  name: 'Chi torna spesso',
  condition: { version: '1.0', groups: [{ operator: 'AND', rules: [{ fieldId: 'totalStays', operator: 'greaterThan', value: 2 }] }] },
};

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
  await i18n.changeLanguage('it');
  vi.mocked(ApiClient.get).mockImplementation(async (path: string) => {
    if (path === '/properties') return [{ id: 'house', name: 'Villa Sofia', photoUrls: [] }];
    throw new Error(path);
  });
  vi.mocked(ApiClient.post).mockImplementation(async (path: string, data?: unknown) => {
    if (path === '/campaigns/segments/preview') return { count: 14 };
    if (path === '/campaigns/segments') return { id: 'group-1', createdAt: '2026-11-27T10:00:00Z', ...(data as object) };
    if (path === '/campaigns/studio/suggest-segment') return suggested;
    throw new Error(path);
  });
});

describe('segment wizard', () => {
  it('takes a ready-made group to creation, with the live count, and offers the campaign next', async () => {
    const onWriteCampaign = vi.fn();
    const onCreated = vi.fn();
    view(<SegmentWizard open onOpenChange={() => undefined} onCreated={onCreated} onWriteCampaign={onWriteCampaign} />);

    fireEvent.click(await screen.findByTestId('segment-recipe-loyal'));
    expect(await screen.findByText('Ospiti fedeli')).toBeVisible();
    expect(await screen.findByTestId('segment-count')).toHaveTextContent('14');

    fireEvent.click(screen.getByTestId('segment-wizard-next'));
    expect(await screen.findByLabelText('Nome del gruppo')).toHaveValue('Ospiti fedeli');

    fireEvent.click(screen.getByTestId('segment-wizard-next'));
    await waitFor(() =>
      expect(ApiClient.post).toHaveBeenCalledWith('/campaigns/segments', {
        name: 'Ospiti fedeli',
        condition: { version: '1.0', groups: [{ operator: 'AND', rules: [{ fieldId: 'stage', operator: 'in', value: ['loyal'] }] }] },
      }),
    );
    expect(await screen.findByText('Il gruppo «Ospiti fedeli» è pronto')).toBeVisible();
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'group-1' }));

    fireEvent.click(screen.getByTestId('segment-wizard-write'));
    expect(onWriteCampaign).toHaveBeenCalledWith(expect.objectContaining({ id: 'group-1', name: 'Ospiti fedeli' }));
  });

  it('shows the rules proposed by the AI in plain words and says that they come from it', async () => {
    view(<SegmentWizard open onOpenChange={() => undefined} />);
    fireEvent.change(await screen.findByLabelText(/Scrivilo con parole tue/), { target: { value: 'Chi torna più di una volta' } });
    fireEvent.click(screen.getByTestId('segment-ai-submit'));

    expect(await screen.findByText('Hanno soggiornato almeno 3 volte')).toBeVisible();
    expect(screen.getByText(/le ha proposte l'AI/)).toBeVisible();
    expect(ApiClient.post).toHaveBeenCalledWith('/campaigns/studio/suggest-segment', { brief: 'Chi torna più di una volta' });

    fireEvent.click(screen.getByTestId('segment-wizard-next'));
    expect(await screen.findByLabelText('Nome del gruppo')).toHaveValue('Chi torna spesso');
  });

  it('lets the host change a rule and add another one without typing a single technical word', async () => {
    view(<SegmentWizard open onOpenChange={() => undefined} initialRecipeId="recent" />);

    fireEvent.click(await screen.findByRole('button', { name: /Modifica la regola: Ultimo soggiorno negli ultimi 60 giorni/ }));
    const editor = await screen.findByTestId('rule-editor');
    fireEvent.click(within(editor).getByRole('button', { name: '90 giorni' }));
    fireEvent.click(within(editor).getByTestId('rule-editor-apply'));
    expect(await screen.findByText('Ultimo soggiorno negli ultimi 90 giorni')).toBeVisible();

    fireEvent.click(screen.getByTestId('segment-add-stays'));
    const second = await screen.findByTestId('rule-editor');
    fireEvent.change(within(second).getByLabelText('Quanti soggiorni'), { target: { value: '4' } });
    fireEvent.click(within(second).getByTestId('rule-editor-apply'));
    expect(await screen.findByText('Hanno soggiornato almeno 4 volte')).toBeVisible();
    expect(screen.getByText('Rispetta tutte le regole')).toBeVisible();
  });

  it('removes a rule and says that an empty group reaches everyone', async () => {
    view(<SegmentWizard open onOpenChange={() => undefined} initialRecipeId="recent" />);
    fireEvent.click(await screen.findByRole('button', { name: /Togli la regola: Ultimo soggiorno negli ultimi 60 giorni/ }));
    expect(await screen.findByTestId('segment-no-rules')).toBeVisible();
  });

  it('keeps the next button closed while a rule is being edited and the name empty', async () => {
    view(<SegmentWizard open onOpenChange={() => undefined} />);
    fireEvent.click(await screen.findByTestId('segment-scratch'));
    fireEvent.click(await screen.findByTestId('segment-add-lastStay'));
    expect(screen.getByTestId('segment-wizard-next')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Annulla', hidden: false }));
    fireEvent.click(screen.getByTestId('segment-wizard-next'));
    expect(await screen.findByLabelText('Nome del gruppo')).toHaveValue('');
    expect(screen.getByTestId('segment-wizard-next')).toBeDisabled();
  });
});
