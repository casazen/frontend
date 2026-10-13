import { beforeEach, describe, expect, it, vi } from 'vitest';
import { acceptHostInvite } from '@/api/host-invites.api';
import {
  acceptHostInviteOnce,
  clearPendingHostInvite,
  hostInvitePath,
  isWellFormedHostInviteToken,
  readPendingHostInvite,
  savePendingHostInvite,
} from '../host-invite';
import { validLandingPath } from '../signup-attribution';

vi.mock('@/api/host-invites.api', () => ({ acceptHostInvite: vi.fn() }));

let TOKEN = '';
let counter = 0;

describe('host-invite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    counter += 1;
    TOKEN = `tok_${String(counter).padStart(4, '0')}${'a'.repeat(36)}`;
  });

  it('savePendingHostInvite_WellFormedToken_IsReadBack', () => {
    savePendingHostInvite(TOKEN);

    expect(readPendingHostInvite()).toBe(TOKEN);
  });

  it.each(['', 'short', 'has space in it 123', '../../etc/passwd/x'])(
    'savePendingHostInvite_MalformedToken_%s_StoresNothing',
    (token) => {
      savePendingHostInvite(token);

      expect(readPendingHostInvite()).toBeNull();
      expect(isWellFormedHostInviteToken(token)).toBe(false);
    },
  );

  it('hostInvitePath_Token_IsUnderTheInviteAddress', () => {
    expect(hostInvitePath(TOKEN)).toBe(`/invito-host/${TOKEN}`);
  });

  it('acceptHostInviteOnce_Success_SendsOnceAndForgetsTheToken', async () => {
    vi.mocked(acceptHostInvite).mockResolvedValue(undefined);
    savePendingHostInvite(TOKEN);

    const [first, second] = await Promise.all([acceptHostInviteOnce(TOKEN), acceptHostInviteOnce(TOKEN)]);

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(acceptHostInvite).toHaveBeenCalledTimes(1);
    expect(readPendingHostInvite()).toBeNull();
  });

  it('acceptHostInviteOnce_AlreadyAcceptedInThisPageLoad_DoesNotCallTheApiAgain', async () => {
    vi.mocked(acceptHostInvite).mockResolvedValue(undefined);

    await acceptHostInviteOnce(TOKEN);
    const again = await acceptHostInviteOnce(TOKEN);

    expect(again).toEqual({ ok: true });
    expect(acceptHostInvite).toHaveBeenCalledTimes(1);
  });

  it('acceptHostInviteOnce_FinalRefusal_ForgetsTheToken', async () => {
    const error = Object.assign(new Error('x'), { isAxiosError: true, response: { status: 409, data: {} } });
    vi.mocked(acceptHostInvite).mockRejectedValue(error);
    savePendingHostInvite(TOKEN);

    const outcome = await acceptHostInviteOnce(TOKEN);

    expect(outcome.ok).toBe(false);
    expect(readPendingHostInvite()).toBeNull();
  });

  it('acceptHostInviteOnce_ServerError_KeepsTheTokenForARetry', async () => {
    const error = Object.assign(new Error('x'), { isAxiosError: true, response: { status: 503, data: {} } });
    vi.mocked(acceptHostInvite).mockRejectedValue(error);
    savePendingHostInvite(TOKEN);

    await acceptHostInviteOnce(TOKEN);

    expect(readPendingHostInvite()).toBe(TOKEN);
    clearPendingHostInvite();
    expect(readPendingHostInvite()).toBeNull();
  });

  it('validLandingPath_InviteAddress_NeverBecomesPartOfAnAttribution', () => {
    expect(validLandingPath(`/invito-host/${TOKEN}`)).toBeUndefined();
    expect(validLandingPath('/p/tassa-soggiorno/roma')).toBe('/p/tassa-soggiorno/roma');
  });
});
