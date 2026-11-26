import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from '@/lib/axios';
import { swissComplianceApi } from '../swissCompliance.api';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

const PROPERTY_ID = '5b1c0e5a-7f43-4d7e-9a41-2c6f1d8a9b10';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('the assisted notification of the cantons other than Ticino (E31/F02/US02/T02, NF-131)', () => {
  it('getSwissDay_WithAndWithoutADay_AsksTheDayOrTheFirstOneToNotify', async () => {
    vi.mocked(axios.get).mockResolvedValue({ status: 200, data: {} });

    await swissComplianceApi.getSwissDay(PROPERTY_ID, '2026-11-19');
    await swissComplianceApi.getSwissDay(PROPERTY_ID);

    const calls = vi.mocked(axios.get).mock.calls;
    expect(calls[0]![0]).toBe(`/properties/${PROPERTY_ID}/swiss/notification-day`);
    expect(calls[0]![1]).toMatchObject({ params: { date: '2026-11-19' } });
    // Without a day the server answers the oldest day still to notify: no date is sent.
    expect(calls[1]![1]).toMatchObject({ params: undefined });
  });

  it('declareSwissDay_AndUndo_TalkToTheDeclarationOfTheDayAndNothingElse', async () => {
    vi.mocked(axios.post).mockResolvedValue({ status: 200, data: { created: true } });
    vi.mocked(axios.delete).mockResolvedValue({ status: 204, data: undefined });

    await swissComplianceApi.declareSwissDay(PROPERTY_ID, { arrivalDay: '2026-11-19' });
    await swissComplianceApi.undeclareSwissDay(PROPERTY_ID, '2026-11-19');

    const [postUrl, body] = vi.mocked(axios.post).mock.calls[0]!;
    expect(postUrl).toBe(`/properties/${PROPERTY_ID}/swiss/notification-declare`);
    // The body is the day and nothing else: no guest, no name.
    expect(body).toStrictEqual({ arrivalDay: '2026-11-19' });
    expect(vi.mocked(axios.delete).mock.calls[0]![0]).toBe(`/properties/${PROPERTY_ID}/swiss/notification-declare?arrivalDay=2026-11-19`);
  });
});
