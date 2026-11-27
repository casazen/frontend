import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultPreferences } from '@/features/profile/__tests__/notification-preferences-fixtures';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { ApiClient } from '../client';
import { notificationPreferencesApi } from '../notification-preferences.api';

vi.mock('../client');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('notificationPreferencesApi (E05/F03/US02, NF-65)', () => {
  it('get_ReadsTheSettingsOfTheCaller_FromAnAddressWithNoUserInIt', async () => {
    vi.mocked(ApiClient.get).mockResolvedValueOnce(defaultPreferences());

    const result = await notificationPreferencesApi.get();

    // The user is the one of the token: nobody can read the settings of another person by changing the address.
    expect(ApiClient.get).toHaveBeenCalledWith('/me/notification-preferences');
    expect(result).toEqual(defaultPreferences());
  });

  it.each([['<!doctype html><html></html>'], [undefined], [{}], [{ quietHours: {}, events: 'none', availableChannels: [] }]])(
    'get_BodyThatIsNotTheSettings_IsALoadErrorAndNotAPageWithNoRows (%j)',
    async (body) => {
      vi.mocked(ApiClient.get).mockResolvedValueOnce(body);

      await expect(notificationPreferencesApi.get()).rejects.toBeInstanceOf(UnexpectedApiResponseError);
    },
  );

  it('save_PutsTheRequestAsItIsAndAnswersWithTheSettingsAfterTheSave', async () => {
    const request = { events: [{ eventType: 'NewBooking' as const, channels: ['MobilePush' as const] }] };
    vi.mocked(ApiClient.put).mockResolvedValueOnce(defaultPreferences());

    const result = await notificationPreferencesApi.save(request);

    expect(ApiClient.put).toHaveBeenCalledWith('/me/notification-preferences', request);
    expect(result).toEqual(defaultPreferences());
  });

  it('save_AnswerThatIsNotTheSettings_IsAnErrorToo', async () => {
    vi.mocked(ApiClient.put).mockResolvedValueOnce(undefined);

    await expect(notificationPreferencesApi.save({ quietHours: { start: '22:00:00', end: '08:00:00' } })).rejects.toBeInstanceOf(
      UnexpectedApiResponseError,
    );
  });
});
