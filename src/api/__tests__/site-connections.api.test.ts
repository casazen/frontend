import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from '@/lib/axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { SiteConnectionsApi } from '../site-connections.api';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

const ORG_ID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';
const CONNECTION_ID = '9a1c7e52-3b8d-4f60-8c2e-7d5a4b3c2e11';

const REQUEST = {
  siteUrl: 'https://www.quokka360.test',
  returnUrl: 'https://www.quokka360.test/wp-admin/options-general.php?page=casazen',
  state: 'test-state-0123456789',
  codeChallenge: 'A'.repeat(43),
  codeChallengeMethod: 'S256' as const,
};
const ANSWER = { redirectUrl: `${REQUEST.returnUrl}&casazen_code=test-code&state=${REQUEST.state}`, siteUrl: REQUEST.siteUrl, expiresAt: '2026-11-27T12:05:00Z' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SiteConnectionsApi', () => {
  it('authorize_PostsTheFiveFieldsToThePathOfTheOrg_AndTheRefusalOfTheAccountStaysOnThePage', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ status: 200, data: ANSWER });

    await expect(SiteConnectionsApi.authorize(ORG_ID, REQUEST)).resolves.toEqual(ANSWER);

    expect(axios.post).toHaveBeenCalledWith(`/orgs/${ORG_ID}/site-connections/authorize`, REQUEST, { localAuthRecovery: true });
  });

  it.each([null, '', 'plain text', {}, { redirectUrl: 42 }, ['https://www.quokka360.test']])('authorize_AnAnswerThatIsNotTheAddressToGoTo_%j_IsAnUnexpectedAnswer', async (data) => {
    vi.mocked(axios.post).mockResolvedValueOnce({ status: 200, data });

    await expect(SiteConnectionsApi.authorize(ORG_ID, REQUEST)).rejects.toBeInstanceOf(UnexpectedApiResponseError);
  });

  it('list_ReadsThePathOfTheOrg', async () => {
    const sites = [{ id: CONNECTION_ID, siteUrl: 'https://www.quokka360.test', createdAt: '2026-11-20T12:00:00Z', lastUsedAt: null }];
    vi.mocked(axios.get).mockResolvedValueOnce({ status: 200, data: sites });

    await expect(SiteConnectionsApi.list(ORG_ID)).resolves.toEqual(sites);

    expect(vi.mocked(axios.get).mock.calls[0][0]).toBe(`/orgs/${ORG_ID}/site-connections`);
  });

  it.each([undefined, null, '', '<!doctype html><html></html>', {}, { data: 'x' }])('list_AnAnswerThatIsNotAList_%j_IsAnUnexpectedAnswer', async (data) => {
    vi.mocked(axios.get).mockResolvedValueOnce({ status: 200, data });

    await expect(SiteConnectionsApi.list(ORG_ID)).rejects.toBeInstanceOf(UnexpectedApiResponseError);
  });

  it('revoke_DeletesThatConnectionOfThatOrg', async () => {
    vi.mocked(axios.delete).mockResolvedValueOnce({ status: 204, data: '' });

    await SiteConnectionsApi.revoke(ORG_ID, CONNECTION_ID);

    expect(axios.delete).toHaveBeenCalledTimes(1);
    expect(vi.mocked(axios.delete).mock.calls[0][0]).toBe(`/orgs/${ORG_ID}/site-connections/${CONNECTION_ID}`);
  });

  it('revoke_AnIdWithSlashes_NeverTurnsIntoAnotherPath', async () => {
    vi.mocked(axios.delete).mockResolvedValueOnce({ status: 204, data: '' });

    await SiteConnectionsApi.revoke(ORG_ID, '../../domain');

    expect(vi.mocked(axios.delete).mock.calls[0][0]).toBe(`/orgs/${ORG_ID}/site-connections/..%2F..%2Fdomain`);
  });
});
