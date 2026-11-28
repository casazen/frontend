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
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({
    title,
    primary,
    secondary,
  }: {
    title: string;
    primary?: { label: string; onClick?: () => void };
    secondary?: Array<{ label?: string; onClick?: () => void }>;
  }) => (
    <header>
      <h1>{title}</h1>
      {primary ? <button onClick={primary.onClick}>{primary.label}</button> : null}
      {secondary?.map((item) => (item.label ? <button key={item.label} onClick={item.onClick}>{item.label}</button> : null))}
    </header>
  ),
}));

let campaigns: Array<Record<string, unknown>>;
let segments: Array<Record<string, unknown>>;
let assets: Array<Record<string, unknown>>;
const loyal = {
  id: 'audience',
  name: 'Loyal guests',
  createdAt: '2026-11-01T10:00:00Z',
  condition: { version: '1.0', groups: [{ operator: 'AND', rules: [{ fieldId: 'stage', operator: 'in', value: ['loyal'] }] }] },
};
const preferences = {
  voice: 'Friendly',
  propertyNotes: {},
  propertyUrls: {},
  monthlyEmailLimit: 2,
  loyalStays: 3,
  lostMonths: 24,
  newsletter: { cadenceDays: 30, instructions: '', enabled: false, propertyId: null, segmentId: null },
};

function view(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>{node}</QueryClientProvider>
    </MemoryRouter>,
  );
}

const campaign = (status: string, extra: Record<string, unknown> = {}) => ({
  id: 'first',
  segmentId: 'audience',
  segmentName: 'Loyal guests',
  subject: 'Summer return',
  body: 'Visit again',
  status,
  scheduledAt: null,
  sentAt: null,
  createdAt: '2026-11-20T10:00:00Z',
  sentCount: 0,
  errorCount: 0,
  unsubscribeCount: 0,
  isAiGenerated: false,
  ...extra,
});

beforeEach(async () => {
  campaigns = [];
  segments = [];
  assets = [];
  vi.resetAllMocks();
  await i18n.changeLanguage('en');
  vi.mocked(ApiClient.get).mockImplementation(async (path: string) => {
    if (path === '/campaigns') return campaigns;
    if (path === '/campaigns/segments') return segments;
    if (path === '/campaigns/studio/assets') return assets;
    if (path === '/properties') return [{ id: 'house', name: 'Villa Sofia', photoUrls: [] }];
    if (path.endsWith('/preview')) return { count: 1 };
    if (path.endsWith('/settings')) return preferences;
    if (path.endsWith('/report')) return { id: 'first', openedCount: 5, clickedCount: 2, bouncedCount: 0, sentCount: 10, errorCount: 0, unsubscribeCount: 1 };
    throw new Error(path);
  });
  vi.mocked(ApiClient.post).mockImplementation(async (path: string) => {
    if (path === '/campaigns/segments/preview') return { count: 3 };
    if (path.endsWith('/submit')) {
      campaigns = campaigns.map((row) => ({ ...row, status: 'PendingApproval' }));
      return undefined;
    }
    if (path === '/marketing/import/preview') return { headers: ['email'], sample: [['guest@example.org']], totalRows: 1 };
    if (path === '/marketing/import') return { imported: 1, skipped: 0, errors: [] };
    if (path.endsWith('/draft')) return { id: 'drafted' };
    throw new Error(path);
  });
});

it('shows ready-made groups to a host with none and opens the wizard on the rules of the one picked', async () => {
  view(<SegmentsPage />);
  expect(await screen.findByTestId('groups-empty')).toBeVisible();
  fireEvent.click(screen.getByTestId('group-recipe-loyal'));
  expect(await screen.findByText('Check who is in it')).toBeVisible();
  expect(screen.getByText('Guests: loyal')).toBeVisible();
});

it('lists the groups with their rules in plain words and starts a campaign from one of them', async () => {
  segments = [loyal];
  view(<SegmentsPage />);
  expect(await screen.findByText('Loyal guests')).toBeVisible();
  expect(screen.getByText('Guests: loyal')).toBeVisible();
  fireEvent.click(screen.getByTestId('group-write-campaign'));
  expect(await screen.findByText('What do you want to achieve?')).toBeVisible();
});

it('imports a file step by step, asking for the permission and the source, then shows the totals', async () => {
  view(<SegmentsPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Import guests from a file' }));
  fireEvent.change(await screen.findByTestId('import-dropzone-input'), {
    target: { files: [new File(['email\nguest@example.org'], 'guest.csv')] },
  });
  expect(await screen.findByText('I read 1 row of guests')).toBeVisible();
  await waitFor(() => expect(screen.getByTestId('import-wizard-next')).toBeEnabled());
  fireEvent.click(screen.getByTestId('import-wizard-next'));
  expect(await screen.findByText('guest@example.org')).toBeVisible();
  fireEvent.click(screen.getByTestId('import-wizard-next'));
  fireEvent.click(await screen.findByTestId('import-basis-consent'));
  fireEvent.click(screen.getByTestId('import-wizard-next'));
  fireEvent.change(await screen.findByTestId('import-source'), { target: { value: 'check-in v3' } });
  fireEvent.click(screen.getByTestId('import-wizard-next'));
  expect(await screen.findByTestId('import-result-imported')).toHaveTextContent('1');
});

it('says what to do next on every campaign and lets a draft go to approval from its card', async () => {
  campaigns = [campaign('Draft')];
  view(<CampaignsPage />);
  expect(await screen.findByText('Summer return')).toBeVisible();
  expect(screen.getByTestId('campaign-next-step')).toHaveTextContent('It is a draft');
  fireEvent.click(screen.getByRole('button', { name: /submit for approval/i }));
  expect(await screen.findByRole('link', { name: 'Open approval queue' })).toHaveAttribute('href', '/app/short-rent/approval-queue');
  expect(ApiClient.post).toHaveBeenCalledWith('/campaigns/first/submit', {});
});

it('offers quick times to schedule an approved campaign and refuses a time in the past', async () => {
  campaigns = [campaign('Approved')];
  view(<CampaignsPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Tomorrow at 10' }));
  expect(screen.getByLabelText('Schedule sending')).not.toHaveValue('');
  fireEvent.change(screen.getByLabelText('Schedule sending'), { target: { value: '2020-01-01T10:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Schedule' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Choose a future date and time.');
});

it('shows how a sent campaign went', async () => {
  campaigns = [campaign('Sent', { sentAt: '2026-11-21T10:00:00Z', sentCount: 10 })];
  view(<CampaignsPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'See text and results' }));
  expect(await screen.findByTestId('campaign-results')).toHaveTextContent('50%');
});

it('welcomes a host with no campaign, and a starter idea opens the wizard at the guests step', async () => {
  view(<CampaignsPage />);
  expect(await screen.findByTestId('campaigns-empty')).toBeVisible();
  fireEvent.click(screen.getByTestId('campaign-starter-thanks'));
  expect(await screen.findByText('Who are you writing to?')).toBeVisible();
});

it('opens an idea of the AI in the wizard, ready to review and send', async () => {
  assets = [
    {
      id: 'idea',
      propertyId: 'house',
      segmentId: 'audience',
      channel: 'email',
      subject: 'Lake festival',
      body: 'Come back for the festival',
      keywords: '',
      audience: '',
      budget: '',
      approvedAt: null,
      campaignId: null,
      trackingUrl: null,
      sourceEvent: { name: 'Lake festival', date: '2026-12-01', source: 'https://example.org', description: '' },
    },
  ];
  view(<CampaignsPage />);
  expect(await screen.findByTestId('campaign-idea')).toHaveTextContent('Lake festival');
  fireEvent.click(screen.getByRole('button', { name: 'Review and send' }));

  expect(await screen.findByDisplayValue('Come back for the festival')).toBeVisible();
  fireEvent.change(screen.getByTestId('campaign-subject'), { target: { value: 'Lake festival: join us' } });
  fireEvent.click(screen.getByTestId('campaign-wizard-next'));
  fireEvent.click(await screen.findByTestId('campaign-wizard-next'));
  await waitFor(() =>
    expect(ApiClient.post).toHaveBeenCalledWith('/campaigns/studio/assets/idea/draft', { subject: 'Lake festival: join us', body: 'Come back for the festival' }),
  );
});

it('saves the edited style at the end of the guided settings', async () => {
  view(<CampaignsPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Marketing settings' }));
  fireEvent.change(await screen.findByTestId('voice-text'), { target: { value: 'Calm and direct' } });
  for (let step = 0; step < 4; step += 1) {
    const next = screen.getByTestId('settings-wizard-next');
    await waitFor(() => expect(next).toBeEnabled());
    fireEvent.click(next);
  }
  fireEvent.click(await screen.findByTestId('settings-wizard-next'));
  expect(await screen.findByTestId('settings-done')).toBeVisible();
  expect(ApiClient.put).toHaveBeenCalledWith('/campaigns/studio/settings', { ...preferences, voice: 'Calm and direct' });
});
