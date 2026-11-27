import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from '@/lib/axios';
import { reportsApi } from '../reports.api';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));

const PERIOD = { from: '2026-10-01', to: '2026-10-31' };

beforeEach(() => {
  vi.clearAllMocks();
});

// NF-96 / AC-NF96-4: the agency view is not for every caller. The server answers 403 and the page leaves the grouping out, quietly.
describe('reportsApi.getByOwner (NF-96)', () => {
  it('getByOwner_Forbidden_ResolvesNullInsteadOfThrowing', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ status: 403, data: {} });

    await expect(reportsApi.getByOwner(PERIOD)).resolves.toBeNull();

    // The shared client rejects a 403 on a read and sends the whole app to the no-access page; here it must reach the code as an answer.
    const config = vi.mocked(axios.get).mock.calls[0][1];
    expect(config?.validateStatus?.(403)).toBe(true);
    expect(config?.validateStatus?.(200)).toBe(true);
    expect(config?.validateStatus?.(401)).toBe(false);
    expect(config?.validateStatus?.(404)).toBe(false);
    expect(config?.validateStatus?.(500)).toBe(false);
  });

  it('getByOwner_Report_IsReturnedAsTheServerSentIt', async () => {
    const report = { title: 'Prestazioni per proprietario', rows: [], total: { revenue: 0 } };
    vi.mocked(axios.get).mockResolvedValueOnce({ status: 200, data: report });

    await expect(reportsApi.getByOwner(PERIOD)).resolves.toBe(report);
    expect(axios.get).toHaveBeenCalledWith('/reports/by-owner', expect.objectContaining({ params: PERIOD }));
  });
});
