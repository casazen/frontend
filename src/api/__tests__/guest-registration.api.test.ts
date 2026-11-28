import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from '@/lib/axios';
import { guestRegistrationApi } from '../guest-registration.api';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), put: vi.fn() } }));

const get = vi.mocked(axios.get);
const put = vi.mocked(axios.put);

const PROPERTY_ID = '5b1c0e5a-7f43-4d7e-9a41-2c6f1d8a9b10';
const CARD = { regime: null, effectiveDuty: 'Ask', override: null, place: null, identifierMissing: [] };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('guestRegistrationApi (the regime of the registration of the guests of a property, E29/F02/US01/T01)', () => {
  it('get_Property_AsksTheCardOfThatPropertyWithTheTokenOfTheCaller', async () => {
    get.mockResolvedValueOnce({ status: 200, data: CARD });

    await expect(guestRegistrationApi.get(PROPERTY_ID)).resolves.toEqual(CARD);

    const [url, config] = get.mock.calls[0]!;
    expect(url).toBe(`/properties/${PROPERTY_ID}/guest-registration`);
    expect(config).not.toHaveProperty('public');
    expect(config).toMatchObject({ params: undefined });
  });

  it('get_IdWithSpecialCharacters_IsEncodedInThePath', async () => {
    get.mockResolvedValueOnce({ status: 200, data: CARD });

    await guestRegistrationApi.get('a/b?c');

    expect(get.mock.calls[0]![0]).toBe('/properties/a%2Fb%3Fc/guest-registration');
  });

  it.each(['Required', 'NotRequired'] as const)('setOverride_%s_SendsTheMemberAndAnswersTheCardAfterTheChange', async (override) => {
    put.mockResolvedValueOnce({ status: 200, data: { ...CARD, override } });

    await expect(guestRegistrationApi.setOverride(PROPERTY_ID, override)).resolves.toEqual({ ...CARD, override });

    const [url, body] = put.mock.calls[0]!;
    expect(url).toBe(`/properties/${PROPERTY_ID}/guest-registration`);
    expect(body).toStrictEqual({ override });
  });

  it('setOverride_Null_SendsTheMemberWithNull_NeverABodyWithoutIt', async () => {
    put.mockResolvedValueOnce({ status: 200, data: CARD });

    await guestRegistrationApi.setOverride(PROPERTY_ID, null);

    const body = put.mock.calls[0]![1] as Record<string, unknown>;
    expect(body).toStrictEqual({ override: null });
    expect(Object.keys(body)).toEqual(['override']);
  });
});
