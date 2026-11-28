import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosHeaders } from 'axios';
import axios from '@/lib/axios';
import { guestRegisterApi } from '../guest-register.api';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));

const PROPERTY_ID = '5b1c0e5a-7f43-4d7e-9a41-2c6f1d8a9b10';
const PERIOD = { from: '2026-10-23', to: '2026-11-21' };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('guestRegisterApi (the guest register of a property in Switzerland, E31/F02/US02/T01, NF-130)', () => {
  it('getInfo_APeriod_AsksTheCountOfThatPeriodWithTheTokenOfTheCaller', async () => {
    const info = { propertyId: PROPERTY_ID, ...PERIOD, rowCount: 2, retentionYears: 5, regimeCode: 'CH-TI' };
    vi.mocked(axios.get).mockResolvedValueOnce({ status: 200, data: info });

    await expect(guestRegisterApi.getInfo(PROPERTY_ID, PERIOD)).resolves.toEqual(info);

    const [url, config] = vi.mocked(axios.get).mock.calls[0]!;
    expect(url).toBe(`/properties/${PROPERTY_ID}/swiss/guest-register/info`);
    expect(config).toMatchObject({ params: PERIOD });
    expect(config).not.toHaveProperty('public');
  });

  it('download_APeriod_AsksTheCsvInTheLanguageOfThePageAndBringsTheNameTheServerGave', async () => {
    const blob = new Blob(['Arrivo;Firma']);
    vi.mocked(axios.get).mockResolvedValueOnce({ data: blob, headers: new AxiosHeaders({ 'content-disposition': 'attachment; filename="registro-ospiti-ch-2026-10-23-2026-11-21.csv"' }) });

    const file = await guestRegisterApi.download(PROPERTY_ID, PERIOD, 'en');

    expect(file).toEqual({ blob, contentDisposition: 'attachment; filename="registro-ospiti-ch-2026-10-23-2026-11-21.csv"' });
    const [url, config] = vi.mocked(axios.get).mock.calls[0]!;
    expect(url).toBe(`/properties/${PROPERTY_ID}/swiss/guest-register`);
    expect(config).toMatchObject({ params: { ...PERIOD, format: 'csv' }, responseType: 'blob', headers: { 'Accept-Language': 'en' } });
  });

  it('PropertyIdWithSpecialCharacters_IsEncodedInThePath', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ status: 200, data: {} });

    await guestRegisterApi.getInfo('a/b?c', PERIOD);

    expect(vi.mocked(axios.get).mock.calls[0]![0]).toBe('/properties/a%2Fb%3Fc/swiss/guest-register/info');
  });
});
