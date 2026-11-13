import { describe, expect, it, vi } from 'vitest';
import axios from '@/lib/axios';
import { registrationPreparationApi } from '../registration-preparation.api';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));

describe('registration preparation response contract', () => {
  it('preserves the schema and validation alongside the data property', async () => {
    const result = { schema: { fields: [] }, data: { version: 1, values: {}, documents: {} }, issues: [], ready: true, paid: false };
    vi.mocked(axios.get).mockResolvedValueOnce({ data: result });
    vi.mocked(axios.put).mockResolvedValueOnce({ data: result });
    expect(await registrationPreparationApi.get('lease-1')).toEqual(result);
    expect(await registrationPreparationApi.save('lease-1', result.data)).toEqual(result);
  });
});
