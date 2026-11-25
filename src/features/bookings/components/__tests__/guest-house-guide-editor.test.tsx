import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ApiClient } from '@/api/client';
import { guideFields, type HouseGuide } from '@/features/guest-portal/house-guide-fields';
import { GuestHouseGuideEditor } from '../guest-house-guide-editor';

vi.mock('@/api/client', () => ({ ApiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const propertyId = 'example-property';

function renderEditor() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <GuestHouseGuideEditor propertyId={propertyId} section="guide" withAi />
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.resetAllMocks());

it('fills every blank guide field in one click and preserves saved values before explicit publication', async () => {
  const saved = { house: 'Published house rules' };
  const generated = Object.fromEntries(guideFields.map((field) => [field, `Generated ${field}`])) as HouseGuide;
  vi.mocked(ApiClient.get).mockResolvedValue(saved);
  vi.mocked(ApiClient.post).mockResolvedValue({ guide: {
    ...generated,
    autoReplies: { enabled: true, checkIn: true },
  } });

  renderEditor();
  fireEvent.click(await screen.findByRole('button', { name: 'guestPortal.guide.aiGenerate' }));

  expect(await screen.findByText('guestPortal.guide.aiReady')).toBeVisible();
  expect(ApiClient.post).toHaveBeenCalledWith(`/properties/${propertyId}/guest-portal-setup/suggestions/guide`);
  for (const field of guideFields) {
    expect(screen.getByLabelText(`guestPortal.guide.${field}`)).toHaveValue(field === 'house' ? saved.house : generated[field]);
  }
  expect(ApiClient.put).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'guestPortal.guide.save' }));
  await waitFor(() => expect(ApiClient.put).toHaveBeenCalledWith(`/properties/${propertyId}/guest-house-guide`, {
    ...generated, ...saved,
  }));
});

it('preserves text entered while generation is running', async () => {
  vi.mocked(ApiClient.get).mockResolvedValue({});
  let resolveGeneration!: (value: { guide: HouseGuide }) => void;
  vi.mocked(ApiClient.post).mockImplementation(() => new Promise((resolve) => { resolveGeneration = resolve; }));

  renderEditor();
  fireEvent.click(await screen.findByRole('button', { name: 'guestPortal.guide.aiGenerate' }));
  expect(await screen.findByText('guestPortal.guide.aiGenerating')).toBeVisible();
  expect(screen.getByRole('button', { name: 'guestPortal.guide.save' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('guestPortal.guide.arrival'), { target: { value: 'My arrival directions' } });
  resolveGeneration({ guide: { arrival: 'Generated arrival', departure: 'Generated departure' } });

  expect(await screen.findByText('guestPortal.guide.aiReady')).toBeVisible();
  expect(screen.getByLabelText('guestPortal.guide.arrival')).toHaveValue('My arrival directions');
  expect(screen.getByLabelText('guestPortal.guide.departure')).toHaveValue('Generated departure');
});

it('keeps an already complete guide and avoids an unnecessary provider call', async () => {
  vi.mocked(ApiClient.get).mockResolvedValue(Object.fromEntries(guideFields.map((field) => [field, `Saved ${field}`])));

  renderEditor();
  fireEvent.click(await screen.findByRole('button', { name: 'guestPortal.guide.aiGenerate' }));

  expect(await screen.findByText('guestPortal.guide.aiNoEmptyFields')).toBeVisible();
  expect(ApiClient.post).not.toHaveBeenCalled();
  expect(ApiClient.put).not.toHaveBeenCalled();
});

it('fills fields from the property draft when the AI provider is unavailable', async () => {
  vi.mocked(ApiClient.get).mockResolvedValue({});
  vi.mocked(ApiClient.post).mockResolvedValue({
    guide: { checkInHours: 'From 15:00' },
    guideSource: 'property',
  });

  renderEditor();
  fireEvent.click(await screen.findByRole('button', { name: 'guestPortal.guide.aiGenerate' }));

  expect(await screen.findByText('guestPortal.guide.aiPropertyReady')).toBeVisible();
  expect(screen.getByLabelText('guestPortal.guide.checkInHours')).toHaveValue('From 15:00');
  expect(ApiClient.put).not.toHaveBeenCalled();
});

it('keeps manual editing available when the AI returns no suggestion', async () => {
  vi.mocked(ApiClient.get).mockResolvedValue({});
  vi.mocked(ApiClient.post).mockResolvedValue(undefined);

  renderEditor();
  fireEvent.click(await screen.findByRole('button', { name: 'guestPortal.guide.aiGenerate' }));

  expect(await screen.findByText('guestPortal.guide.aiUnavailable')).toBeVisible();
  expect(screen.getByLabelText('guestPortal.guide.arrival')).toBeEnabled();
  expect(ApiClient.put).not.toHaveBeenCalled();
});
