import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { CampaignsPage } from '@/pages/CampaignsPage';
import { SegmentsPage } from '@/pages/SegmentsPage';
import { ApiClient } from '@/api/client';
import i18n from '@/i18n/config';

vi.mock('@/api/client', () => ({ ApiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('@/components/layout/app-shell', () => ({ AppShell: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/components/layout/page-header', () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock('@/queries/use-properties', () => ({
  useProperties: () => ({ data: [{ id: 'house', name: 'Villa Sofia' }] }),
}));

let rows: Array<Record<string, unknown>>;
const segment = { id: 'audience', name: 'Loyal guests' };
const preferences = {
  voice: 'Friendly',
  propertyNotes: {},
  propertyUrls: {},
  monthlyEmailLimit: 2,
  loyalStays: 3,
  lostMonths: 24,
  newsletter: { cadenceDays: 30, instructions: '', enabled: false, propertyId: null, segmentId: null },
};
const suggested = {
  name: 'Regular visitors',
  condition: {
    version: '1.0',
    groups: [{ operator: 'AND', rules: [{ fieldId: 'totalStays', operator: 'greaterThan', value: 2 }] }],
  },
};
function view(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>{node}</QueryClientProvider>
    </MemoryRouter>,
  );
}
beforeEach(async () => {
  rows = [];
  vi.resetAllMocks();
  await i18n.changeLanguage('en');
  vi.mocked(ApiClient.get).mockImplementation(async (path: string) => {
    if (path === '/campaigns') return rows;
    if (path === '/campaigns/segments') return [segment];
    if (path === '/campaigns/fields')
      return [{ fieldId: 'totalStays', fieldType: 'Number', operators: ['greaterThan'] }];
    if (path.endsWith('/preview')) return { count: 1 };
    if (path.endsWith('/settings')) return preferences;
    throw new Error(path);
  });
  vi.mocked(ApiClient.post).mockImplementation(async (path: string, data?: unknown) => {
    if (path === '/campaigns') {
      const row = { ...(data as object), id: 'first', status: 'Draft', segmentName: segment.name };
      rows = [row];
      return row;
    }
    if (path === '/campaigns/first/submit') {
      rows = rows.map((row) => ({ ...row, status: 'PendingApproval' }));
      return;
    }
    if (path.endsWith('/suggest-segment')) return suggested;
    if (path === '/campaigns/segments') return { id: 'next', ...(data as object) };
    if (path === '/marketing/import/preview')
      return { headers: ['email'], sample: [['guest@example.org']], totalRows: 1 };
    if (path === '/marketing/import') return { imported: 1, skipped: 0, errors: [] };
    throw new Error(path);
  });
});

it('creates a manual draft then submits the saved campaign to the shared approval queue', async () => {
  view(<CampaignsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'New campaign' }));
  fireEvent.change(screen.getByLabelText('Property', { exact: true }), { target: { value: 'house' } });
  await screen.findByRole('option', { name: 'Loyal guests' });
  fireEvent.change(screen.getByLabelText(i18n.t('campaigns.editor.segment'), { exact: true }), {
    target: { value: 'audience' },
  });
  fireEvent.change(screen.getByLabelText(i18n.t('campaigns.editor.subject')), { target: { value: 'Summer return' } });
  fireEvent.change(screen.getByLabelText(i18n.t('campaigns.editor.body')), { target: { value: 'Visit again' } });
  fireEvent.click(screen.getByRole('button', { name: i18n.t('campaigns.editor.saveDraft') }));
  fireEvent.click(await screen.findByRole('button', { name: /Summer return/ }));
  fireEvent.click(screen.getByRole('button', { name: i18n.t('campaigns.editor.submitForApproval') }));
  expect(await screen.findByRole('link', { name: 'Open approval queue' })).toHaveAttribute(
    'href',
    '/app/short-rent/approval-queue',
  );
});

it.each(['property', 'audience'])('clears the generated draft when its %s changes', async (field) => {
  view(<CampaignsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'New campaign' }));
  const property = screen.getByLabelText('Property', { exact: true });
  const audience = screen.getByLabelText(i18n.t('campaigns.editor.segment'), { exact: true });
  fireEvent.change(property, { target: { value: 'house' } });
  await screen.findByRole('option', { name: 'Loyal guests' });
  fireEvent.change(audience, { target: { value: 'audience' } });
  fireEvent.change(screen.getByLabelText(i18n.t('marketingStudio.brief')), { target: { value: 'Summer offer' } });
  vi.mocked(ApiClient.post).mockResolvedValueOnce({ id: 'asset', subject: 'Villa Sofia', body: 'Stay at Sofia' });
  fireEvent.click(screen.getByRole('button', { name: i18n.t('campaigns.editor.generate') }));
  await screen.findByDisplayValue('Stay at Sofia');
  fireEvent.change(field === 'property' ? property : audience, { target: { value: '' } });
  expect(screen.getByLabelText(i18n.t('campaigns.editor.subject'))).toHaveValue('');
  expect(screen.getByLabelText(i18n.t('campaigns.editor.body'))).toHaveValue('');
  fireEvent.change(field === 'property' ? property : audience, { target: { value: field === 'property' ? 'house' : 'audience' } });
  expect(screen.getByRole('button', { name: i18n.t('campaigns.editor.saveDraft') })).toBeDisabled();
});

it('saves the edited voice before moving to the audience settings step', async () => {
  view(<CampaignsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Marketing settings' }));
  const voice = await screen.findByLabelText('Organization voice');
  fireEvent.change(voice, { target: { value: 'Calm and direct' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
  expect(await screen.findByLabelText('Monthly emails per guest (maximum 2)')).toHaveValue(2);
  expect(ApiClient.put).toHaveBeenCalledWith('/campaigns/studio/settings', {
    ...preferences,
    voice: 'Calm and direct',
  });
});

it('shows the proposed rules and saves the reviewed audience definition', async () => {
  view(<SegmentsPage />);
  fireEvent.click(screen.getByRole('button', { name: i18n.t('campaigns.segment.create') }));
  fireEvent.change(screen.getByLabelText('Describe your audience'), {
    target: { value: 'Guests with over two stays' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Suggest rules with AI' }));
  expect(await screen.findByText('Stays Is greater than 2')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: i18n.t('shared.save') }));
  await waitFor(() => expect(ApiClient.post).toHaveBeenCalledWith('/campaigns/segments', suggested));
});

it('previews imported contacts, requires their source and legal basis, then shows the import totals', async () => {
  view(<SegmentsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Import guests' }));
  fireEvent.change(screen.getByLabelText('CSV or Excel file (.xlsx)'), {
    target: { files: [new File(['email\nguest@example.org'], 'guest.csv')] },
  });
  expect(await screen.findByText('guest@example.org')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Property', { exact: true }), { target: { value: 'house' } });
  fireEvent.change(screen.getByLabelText('Legal basis of the contacts'), { target: { value: 'consent' } });
  fireEvent.change(screen.getByLabelText('Source and evidence reference'), { target: { value: 'check-in v3' } });
  const buttons = screen.getAllByRole('button', { name: 'Import guests' });
  fireEvent.click(buttons[buttons.length - 1]);
  expect(await screen.findByText('Imported 1 · Skipped 0')).toBeVisible();
});
