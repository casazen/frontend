import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from '@/lib/axios';
import { statementsApi } from '../statements.api';
import { withholdingApi } from '../withholding.api';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));

const get = vi.mocked(axios.get);

beforeEach(() => {
  vi.resetAllMocks();
});

/** The first reads of the pages of the agency's money: a 403 is an answer (`null`), because on a refused read the shared client sends the whole app to the page of no access. */
describe.each([
  ['StatementsApi_GetAll', () => statementsApi.getAll({ propertyId: 'p1' }), '/statements', { propertyId: 'p1' }, [{ id: 's1' }]],
  ['WithholdingApi_GetSummary', () => withholdingApi.getSummary(11, 2026), '/withholding/summary', { month: 11, year: 2026 }, { month: 11, year: 2026, ownerSummaries: [] }],
])('%s', (_name, read, path, params, body) => {
  it('AnswerOfTheServer_IsGivenAsItCame', async () => {
    get.mockResolvedValueOnce({ status: 200, data: body });

    await expect(read()).resolves.toEqual(body);

    const [url, config] = get.mock.calls[0]!;
    expect(url).toBe(path);
    expect(config).toMatchObject({ params });
  });

  it('RefusedWith403_IsNullNotAnError_SoTheAppStaysWhereItIs', async () => {
    get.mockResolvedValueOnce({ status: 403, data: '' });

    await expect(read()).resolves.toBeNull();

    const config = get.mock.calls[0]![1]!;
    // Only a 403 is taken as an answer: the other failures still reach the page as errors.
    expect(config.validateStatus!(403)).toBe(true);
    expect(config.validateStatus!(200)).toBe(true);
    expect(config.validateStatus!(401)).toBe(false);
    expect(config.validateStatus!(404)).toBe(false);
    expect(config.validateStatus!(500)).toBe(false);
  });

  it('AnyOtherFailure_StaysAnError', async () => {
    get.mockRejectedValueOnce(new Error('boom'));

    await expect(read()).rejects.toThrow('boom');
  });
});
