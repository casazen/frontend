import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '@/api/client';
import { campaignsApi } from '@/api/campaigns.api';
import i18n from '@/i18n/config';
import { CampaignAssets } from '../CampaignAssets';
import { marketingStudioApi } from '@/api/marketing-studio.api';

vi.mock('@/api/client', () => ({ ApiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

function view(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe('host marketing workflow', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en');
  });
  it('uses the backend draft, submit and schedule contracts', async () => {
    const draft = { subject: 'Summer', body: 'Come back', segmentId: 'audience', propertyId: 'house' };
    await campaignsApi.createDraft(draft);
    await campaignsApi.submitForApproval({ campaignId: 'campaign' });
    await campaignsApi.scheduleCampaign({ campaignId: 'campaign', scheduledAt: '2027-01-01T10:00:00Z' });
    expect(ApiClient.post).toHaveBeenNthCalledWith(1, '/campaigns', draft);
    expect(ApiClient.post).toHaveBeenNthCalledWith(2, '/campaigns/campaign/submit', {});
    expect(ApiClient.post).toHaveBeenNthCalledWith(3, '/campaigns/campaign/schedule', {
      scheduledAt: '2027-01-01T10:00:00Z',
    });
  });
  it('lets the host copy social content with its tracked link only after approval', async () => {
    const draft = {
      id: 'asset',
      channel: 'instagram',
      subject: 'Summer',
      body: 'Come back',
      keywords: '',
      budget: '',
      audience: '',
      approvedAt: null,
      trackingUrl: 'https://example.org/t/id',
    };
    vi.mocked(ApiClient.get)
      .mockResolvedValueOnce([draft])
      .mockResolvedValue([{ ...draft, approvedAt: '2027-01-01' }]);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    view(<CampaignAssets />);
    fireEvent.click(await screen.findByRole('button', { name: /Summer/ }));
    expect(screen.queryByRole('button', { name: 'Copy for publication' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Approve content' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Copy for publication' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('https://example.org/t/id')));
    expect(ApiClient.post).toHaveBeenCalledWith('/campaigns/studio/assets/asset/approve', {});
  });
  it('posts the original import file and the mapped legal-basis evidence as multipart data', async () => {
    const file = new File(['address\na@example.org'], 'guests.csv');
    await marketingStudioApi.importGuests(file, { email: 0 }, 'property', 'consent', 'check-in/v2');
    const [, form, options] = vi.mocked(ApiClient.post).mock.calls[0];
    expect(form).toBeInstanceOf(FormData);
    expect((form as FormData).get('mapping')).toBe('{"email":0}');
    expect((form as FormData).get('source')).toBe('check-in/v2');
    expect((form as FormData).get('basis')).toBe('consent');
    expect((form as FormData).get('file')).toBe(file);
    expect(options?.headers?.['Content-Type']).toBe('multipart/form-data');
  });
});
