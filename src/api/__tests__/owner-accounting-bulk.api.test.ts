import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { ApiClient } from '../client';
import { ownerAccountingApi } from '../owner-accounting.api';

vi.mock('../client');
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));

const BULK = '/owner-accounting/periods/2026/10/bulk';

const row = (ownerId: string, extra: Record<string, unknown> = {}) => ({ ownerId, ok: true, code: null, unchanged: false, issues: null, details: null, ...extra });
const RUN = { jobId: null, action: 'Approve', year: 2026, month: 10, status: 'Completed', total: 2, results: [row('a'), row('b')], errorCode: null };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the bulk month-end calls (E13/F02/US03/T01)', () => {
  it('RunBulkStep_AFinishedRunAndAQueuedOne_AreRuns_AndTheStepIsTheBodyOfTheRequest', async () => {
    vi.mocked(ApiClient.post).mockResolvedValueOnce(RUN);
    await expect(ownerAccountingApi.runBulkStep(2026, 10, { action: 'Approve' })).resolves.toEqual(RUN);
    expect(ApiClient.post).toHaveBeenCalledWith(BULK, { action: 'Approve' });

    const queued = { ...RUN, jobId: '42', status: 'Queued', results: [] };
    vi.mocked(ApiClient.post).mockResolvedValueOnce(queued);
    await expect(ownerAccountingApi.runBulkStep(2026, 10, { action: 'Approve' })).resolves.toEqual(queued);
  });

  it('GetBulkRun_IsAskedByItsEncodedId_AndAnswersTheRunSoFar', async () => {
    const running = { ...RUN, jobId: '4/2', status: 'Running', results: [row('a')] };
    vi.mocked(ApiClient.get).mockResolvedValueOnce(running);

    await expect(ownerAccountingApi.getBulkRun(2026, 10, '4/2')).resolves.toEqual(running);
    expect(ApiClient.get).toHaveBeenCalledWith(`${BULK}/4%2F2`);
  });

  const NOT_RUNS: Array<[string, unknown]> = [
    ['TheIndexHtmlOfTheSpa', '<!doctype html><html></html>'],
    ['NoBodyAtAll', null],
    ['AList', []],
    ['ARunWithNoRows', { ...RUN, results: undefined }],
    ['ARunWithNoTotal', { ...RUN, total: undefined }],
    ['AStatusThatIsNotAWord', { ...RUN, status: 3 }],
    ['ARowThatIsNotARow', { ...RUN, results: [row('a'), 'x'] }],
    ['ARowWithNoOwner', { ...RUN, results: [{ ok: true }] }],
    ['ARowWithNoVerdict', { ...RUN, results: [{ ownerId: 'a' }] }],
    ['ARunThatGoesOnWithNoIdToFollowItBy', { ...RUN, status: 'Running', jobId: null }],
    ['AQueuedRunWithAnEmptyId', { ...RUN, status: 'Queued', jobId: '' }],
  ];

  it.each(NOT_RUNS)('RunBulkStep_%s_IsAFailedCallAndNeverARun', async (_case, body) => {
    vi.mocked(ApiClient.post).mockResolvedValueOnce(body);

    await expect(ownerAccountingApi.runBulkStep(2026, 10, { action: 'Close' })).rejects.toBeInstanceOf(UnexpectedApiResponseError);
  });

  it.each(NOT_RUNS)('GetBulkRun_%s_IsAFailedReadAndNeverAProgress', async (_case, body) => {
    vi.mocked(ApiClient.get).mockResolvedValueOnce(body);

    await expect(ownerAccountingApi.getBulkRun(2026, 10, '42')).rejects.toBeInstanceOf(UnexpectedApiResponseError);
  });
});
