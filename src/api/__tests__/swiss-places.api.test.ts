import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from '@/lib/axios';
import { SWISS_SEARCH_LIMIT, SwissPlacesApi } from '../swiss-places.api';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));

const get = vi.mocked(axios.get);

const LUGANO = { postalCode: '6900', name: 'Lugano', municipalityCode: '5192', municipalityName: 'Lugano', cantonCode: 'TI' };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('SwissPlacesApi (official directory of the Swiss places, E29/F01/US01/T01)', () => {
  it('searchLocalities_Query_AsksTheDirectoryWithTheQueryAndTheLimit', async () => {
    get.mockResolvedValueOnce({ status: 200, data: [LUGANO] });

    await expect(SwissPlacesApi.searchLocalities('6900')).resolves.toEqual([LUGANO]);

    const [url, config] = get.mock.calls[0]!;
    expect(url).toBe('/swiss/localities');
    expect(config).toMatchObject({ params: { query: '6900', limit: SWISS_SEARCH_LIMIT } });
  });

  it('searchLocalities_TheDirectoryIsForWhoeverMayReadProperties_SoItIsNeverAnAnonymousCall', async () => {
    get.mockResolvedValueOnce({ status: 200, data: [] });

    await SwissPlacesApi.searchLocalities('lugano');

    expect(get.mock.calls[0]![1]).not.toHaveProperty('public');
  });

  it('getMunicipality_BfsNumber_IsInThePath', async () => {
    get.mockResolvedValueOnce({ status: 200, data: { municipalityCode: '5192', name: 'Lugano', cantonCode: 'TI' } });

    await expect(SwissPlacesApi.getMunicipality('5192')).resolves.toEqual({ municipalityCode: '5192', name: 'Lugano', cantonCode: 'TI' });

    expect(get.mock.calls[0]![0]).toBe('/swiss/municipalities/5192');
    expect(get.mock.calls[0]![1]).not.toHaveProperty('public');
  });

  it('getMunicipality_AnythingThatIsNotADigit_IsEncodedInThePath', async () => {
    get.mockResolvedValueOnce({ status: 200, data: {} });

    await SwissPlacesApi.getMunicipality('a/b');

    expect(get.mock.calls[0]![0]).toBe('/swiss/municipalities/a%2Fb');
  });

  it('searchLocalities_TheServerRefuses_TheFailureReachesTheCaller', async () => {
    const failure = new Error('swiss_places_unavailable');
    get.mockRejectedValueOnce(failure);

    await expect(SwissPlacesApi.searchLocalities('6900')).rejects.toBe(failure);
  });
});
