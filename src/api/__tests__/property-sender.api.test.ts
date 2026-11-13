import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from '@/lib/axios';
import { propertySenderApi } from '../property-sender.api';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));

const PROPERTY_ID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';

beforeEach(() => {
  vi.clearAllMocks();
});

// E03/F01/US02/T02: a property of the organization that the caller does not reach answers 403 (no code) to the read of its sender. The wizard says «not found» for it.
describe('propertySenderApi.get (E03/F01/US02/T02)', () => {
  it('get_PropertyTheCallerDoesNotReach_ResolvesNullInsteadOfThrowing', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ status: 403, data: '' });

    await expect(propertySenderApi.get(PROPERTY_ID)).resolves.toBeNull();

    // The shared client rejects a 403 on a read and sends the whole app to the no-access page; here it must reach the code as an answer. Any other refusal is still an error.
    const config = vi.mocked(axios.get).mock.calls[0][1];
    expect(config?.validateStatus?.(403)).toBe(true);
    expect(config?.validateStatus?.(200)).toBe(true);
    expect(config?.validateStatus?.(401)).toBe(false);
    expect(config?.validateStatus?.(404)).toBe(false);
    expect(config?.validateStatus?.(500)).toBe(false);
  });

  it('get_Sender_IsReturnedAsTheServerSentItForThePathOfTheProperty', async () => {
    const sender = { propertyId: PROPERTY_ID, sender: 'Manual' };
    vi.mocked(axios.get).mockResolvedValueOnce({ status: 200, data: sender });

    await expect(propertySenderApi.get(PROPERTY_ID)).resolves.toBe(sender);
    expect(axios.get).toHaveBeenCalledWith(`/properties/${PROPERTY_ID}/sender`, expect.anything());
  });

  it('get_IdWithSlashes_NeverTurnsIntoAnotherPath', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ status: 200, data: {} });

    await propertySenderApi.get('../../admin');

    expect(vi.mocked(axios.get).mock.calls[0][0]).toBe('/properties/..%2F..%2Fadmin/sender');
  });
});
