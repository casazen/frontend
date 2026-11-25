import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ApiClient } from '@/api/client';
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

it('previews an AI draft and only fills empty fields before an explicit save', async () => {
  vi.mocked(ApiClient.get).mockResolvedValue({ house: 'Published house rules' });
  vi.mocked(ApiClient.post).mockResolvedValue({ guide: {
    arrival: 'Arrival suggestion',
    house: 'Replacement suggestion',
    departure: 'Departure suggestion',
    access: 'Unexpected field',
  } });

  renderEditor();
  fireEvent.click(await screen.findByRole('button', { name: 'guestPortal.guide.aiGenerate' }));

  expect(await screen.findByText('Arrival suggestion')).toBeVisible();
  expect(ApiClient.post).toHaveBeenCalledWith(`/properties/${propertyId}/guest-portal-setup/suggestions/guide`);
  expect(screen.getByLabelText('guestPortal.guide.arrival')).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: 'guestPortal.guide.aiApply' }));
  expect(screen.getByLabelText('guestPortal.guide.arrival')).toHaveValue('Arrival suggestion');
  expect(screen.getByLabelText('guestPortal.guide.house')).toHaveValue('Published house rules');
  expect(screen.getByLabelText('guestPortal.guide.access')).toHaveValue('');
  expect(ApiClient.put).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'guestPortal.guide.save' }));
  await waitFor(() => expect(ApiClient.put).toHaveBeenCalledWith(`/properties/${propertyId}/guest-house-guide`, {
    house: 'Published house rules', arrival: 'Arrival suggestion', departure: 'Departure suggestion',
  }));
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
