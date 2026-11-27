import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { ApiClient } from '../client';
import { scheduledMessagesApi } from '../scheduled-messages.api';

vi.mock('../client', () => ({ ApiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));

const ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('scheduledMessagesApi (E05/F07/US02, NF-71)', () => {
  // A read of a section of a page: a refusal stays on the section instead of sending the whole app to the page of no access.
  it('list_ReadsTheMessagesOfTheBooking_AndKeepsAnAuthFailureOnTheSection', async () => {
    vi.mocked(ApiClient.get).mockResolvedValue([]);

    await expect(scheduledMessagesApi.list(ID)).resolves.toEqual([]);

    expect(ApiClient.get).toHaveBeenCalledWith(`/bookings/${ID}/scheduled-messages`, undefined, { localAuthRecovery: true });
  });

  it.each([['an object', { data: [] }], ['text', '<html></html>'], ['nothing', undefined], ['null', null]])(
    'list_AnAnswerThatIs_%s_IsAFailedRead_NeverAnEmptyList',
    async (_what, answer) => {
      vi.mocked(ApiClient.get).mockResolvedValue(answer);

      await expect(scheduledMessagesApi.list(ID)).rejects.toBeInstanceOf(UnexpectedApiResponseError);
    },
  );

  it('list_TheIdOfTheBooking_GoesEscapedInTheAddress', async () => {
    vi.mocked(ApiClient.get).mockResolvedValue([]);

    await scheduledMessagesApi.list('a/b?c');

    expect(vi.mocked(ApiClient.get).mock.calls[0]?.[0]).toBe('/bookings/a%2Fb%3Fc/scheduled-messages');
  });

  it('edit_SendsTheTextInTheBody_AndANullTextToGoBackToTheTemplateOfTheRoutine', async () => {
    vi.mocked(ApiClient.put).mockResolvedValue({});

    await scheduledMessagesApi.edit(ID, 'Ciao {{guest_name}}');
    await scheduledMessagesApi.edit(ID, null);

    expect(ApiClient.put).toHaveBeenNthCalledWith(1, `/scheduled-messages/${ID}`, { text: 'Ciao {{guest_name}}' });
    expect(ApiClient.put).toHaveBeenNthCalledWith(2, `/scheduled-messages/${ID}`, { text: null });
  });

  it('skipAndSendNow_PostToTheirOwnAddressesWithNoBody', async () => {
    vi.mocked(ApiClient.post).mockResolvedValue({});

    await scheduledMessagesApi.skip(ID);
    await scheduledMessagesApi.sendNow(ID);

    expect(ApiClient.post).toHaveBeenNthCalledWith(1, `/scheduled-messages/${ID}/skip`);
    expect(ApiClient.post).toHaveBeenNthCalledWith(2, `/scheduled-messages/${ID}/send-now`);
  });
});
