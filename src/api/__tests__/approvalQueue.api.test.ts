import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { approvalQueueApi } from '../approvalQueue.api';
import { ApiClient } from '../client';

vi.mock('../client');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('approvalQueueApi (NF-68 endpoints of api/approval-queue)', () => {
  it('getPending_ReadsTheQueueOfTheOrganization', async () => {
    vi.mocked(ApiClient.get).mockResolvedValueOnce([{ id: 'a1' }]);

    const items = await approvalQueueApi.getPending();

    expect(ApiClient.get).toHaveBeenCalledWith('/approval-queue');
    expect(items).toEqual([{ id: 'a1' }]);
  });

  it.each([['<!doctype html><html></html>'], [{ code: 'not_a_list' }], [null]])(
    'getPending_AnswerThatIsNotAList_IsALoadErrorNeverAList (%j)',
    async (answer) => {
      vi.mocked(ApiClient.get).mockResolvedValueOnce(answer);

      await expect(approvalQueueApi.getPending()).rejects.toBeInstanceOf(UnexpectedApiResponseError);
    },
  );

  it('edit_PutsTheNewTextToTheEditEndpointOfTheItem', async () => {
    vi.mocked(ApiClient.put).mockResolvedValueOnce({ id: 'a1', editedContentText: 'Dalle 16.' });

    await approvalQueueApi.edit('a1', 'Dalle 16.');

    expect(ApiClient.put).toHaveBeenCalledWith('/approval-queue/a1/edit', { text: 'Dalle 16.' });
  });

  it('approve_PostsToTheApproveEndpointOfTheItemWithNoBody', async () => {
    vi.mocked(ApiClient.post).mockResolvedValueOnce({ id: 'a1', originActionResult: 'Sent' });

    const approved = await approvalQueueApi.approve('a1');

    expect(ApiClient.post).toHaveBeenCalledWith('/approval-queue/a1/approve');
    expect(approved).toEqual({ id: 'a1', originActionResult: 'Sent' });
  });

  it('reject_PostsTheReasonToTheRejectEndpointOfTheItem', async () => {
    vi.mocked(ApiClient.post).mockResolvedValueOnce({ id: 'a1', rejectionReason: 'Non serve.' });

    await approvalQueueApi.reject('a1', { reason: 'Non serve.' });

    expect(ApiClient.post).toHaveBeenCalledWith('/approval-queue/a1/reject', { reason: 'Non serve.' });
  });
});
