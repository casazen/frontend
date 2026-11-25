import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ApiClient } from '@/api/client';
import { guideFields, type HouseGuide } from '@/features/guest-portal/house-guide-fields';
import { GuestHouseGuideEditor } from '../guest-house-guide-editor';

vi.mock('@/api/client', () => ({ ApiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const propertyId = 'example-property';
const generationPath = `/properties/${propertyId}/guest-portal-setup/suggestions/guide`;
const fastGenerationPath = `${generationPath}?fast=true`;
type GuideResponse = { guide: HouseGuide; guideSource: 'ai' | 'property' };

function deferResponse() {
  let resolve!: (value: GuideResponse) => void;
  const promise = new Promise<GuideResponse>((done) => { resolve = done; });
  return { promise, resolve };
}

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

it('shows the property draft while AI runs and enriches only untouched generated fields', async () => {
  vi.mocked(ApiClient.get).mockResolvedValue({});
  const quick = deferResponse();
  const ai = deferResponse();
  vi.mocked(ApiClient.post).mockImplementation((path) => path === fastGenerationPath ? quick.promise : ai.promise);

  renderEditor();
  fireEvent.click(await screen.findByRole('button', { name: 'guestPortal.guide.aiGenerate' }));
  expect(await screen.findByText('guestPortal.guide.aiGenerating')).toBeVisible();
  expect(ApiClient.post).toHaveBeenCalledWith(fastGenerationPath);
  expect(ApiClient.post).toHaveBeenCalledWith(generationPath);
  expect(screen.getByRole('button', { name: 'guestPortal.guide.save' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('guestPortal.guide.arrival'), { target: { value: 'My arrival directions' } });
  quick.resolve({ guide: { arrival: 'Property arrival', departure: 'Property departure', access: 'Property access' }, guideSource: 'property' });

  expect(await screen.findByText('guestPortal.guide.aiRefining')).toBeVisible();
  expect(screen.getByLabelText('guestPortal.guide.arrival')).toHaveValue('My arrival directions');
  expect(screen.getByLabelText('guestPortal.guide.departure')).toHaveValue('Property departure');
  expect(screen.getByRole('button', { name: 'guestPortal.guide.save' })).toBeEnabled();

  fireEvent.change(screen.getByLabelText('guestPortal.guide.access'), { target: { value: 'My access directions' } });
  fireEvent.change(screen.getByLabelText('guestPortal.guide.access'), { target: { value: '' } });
  ai.resolve({ guide: { arrival: 'AI arrival', departure: 'AI departure', access: 'AI access' }, guideSource: 'ai' });

  expect(await screen.findByText('guestPortal.guide.aiReady')).toBeVisible();
  expect(screen.getByLabelText('guestPortal.guide.arrival')).toHaveValue('My arrival directions');
  expect(screen.getByLabelText('guestPortal.guide.departure')).toHaveValue('AI departure');
  expect(screen.getByLabelText('guestPortal.guide.access')).toHaveValue('');
});

it('saves the visible draft without waiting and ignores the later AI answer', async () => {
  vi.mocked(ApiClient.get).mockResolvedValue({});
  const ai = deferResponse();
  vi.mocked(ApiClient.post).mockImplementation((path) => path === fastGenerationPath
    ? Promise.resolve({ guide: { departure: 'Property departure' }, guideSource: 'property' })
    : ai.promise);

  renderEditor();
  fireEvent.click(await screen.findByRole('button', { name: 'guestPortal.guide.aiGenerate' }));
  expect(await screen.findByText('guestPortal.guide.aiRefining')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'guestPortal.guide.save' }));
  await waitFor(() => expect(ApiClient.put).toHaveBeenCalledWith(`/properties/${propertyId}/guest-house-guide`, {
    departure: 'Property departure',
  }));
  await act(async () => ai.resolve({ guide: { departure: 'AI departure' }, guideSource: 'ai' }));

  expect(await screen.findByText('guestPortal.guide.saved')).toBeVisible();
  expect(screen.getByLabelText('guestPortal.guide.departure')).toHaveValue('Property departure');
});

it('keeps AI text when the fast response arrives afterwards', async () => {
  vi.mocked(ApiClient.get).mockResolvedValue({});
  const quick = deferResponse();
  vi.mocked(ApiClient.post).mockImplementation((path) => path === fastGenerationPath
    ? quick.promise
    : Promise.resolve({ guide: { departure: 'AI departure' }, guideSource: 'ai' }));

  renderEditor();
  fireEvent.click(await screen.findByRole('button', { name: 'guestPortal.guide.aiGenerate' }));
  expect(await screen.findByText('guestPortal.guide.aiReady')).toBeVisible();
  quick.resolve({ guide: { departure: 'Property departure', access: 'Property access' }, guideSource: 'property' });

  await waitFor(() => expect(screen.getByLabelText('guestPortal.guide.access')).toHaveValue('Property access'));
  expect(screen.getByLabelText('guestPortal.guide.departure')).toHaveValue('AI departure');
});

it('uses the AI response when the fast endpoint is unavailable', async () => {
  vi.mocked(ApiClient.get).mockResolvedValue({});
  vi.mocked(ApiClient.post).mockImplementation((path) => path === fastGenerationPath
    ? Promise.reject(new Error('Fast endpoint unavailable'))
    : Promise.resolve({ guide: { parking: 'AI parking' }, guideSource: 'ai' }));

  renderEditor();
  fireEvent.click(await screen.findByRole('button', { name: 'guestPortal.guide.aiGenerate' }));
  expect(await screen.findByText('guestPortal.guide.aiReady')).toBeVisible();
  expect(screen.getByLabelText('guestPortal.guide.parking')).toHaveValue('AI parking');
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
