import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '@/api/client';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import axios from '@/lib/axios';
import {
  deactivateActivation,
  getDeactivationPreview,
  getMarketplaceActive,
  getMarketplaceHealth,
  requestFunctionChange,
  updateActivationSettings,
} from '../marketplace.api';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));
vi.mock('@/api/client', () => ({ ApiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

const rawGet = vi.mocked(axios.get);
const clientGet = vi.mocked(ApiClient.get);
const clientPost = vi.mocked(ApiClient.post);
const clientPatch = vi.mocked(ApiClient.patch);

const HEALTH_ROW = {
  activationId: 'act-1',
  propertyId: 'prop-1',
  propertyName: 'Villa Rosa',
  kind: 'Channel',
  code: 'PORTAL1',
  name: 'TEST Portal',
  status: 'ToFix',
  isDeclared: false,
  lastSyncedAt: '2026-11-12T14:05:00Z',
  error: { code: 'connection_disabled', message: 'Il collegamento è spento.' },
  quota: { used: 410, limit: 500, warn: true, readAt: '2026-11-12T14:00:00Z' },
  changeRequestedAt: null,
};

beforeEach(() => vi.clearAllMocks());

describe('getMarketplaceHealth', () => {
  it('getMarketplaceHealth_Answer200_GivesTheRowsAsTheServerSentThem', async () => {
    rawGet.mockResolvedValue({ status: 200, data: { items: [HEALTH_ROW] } });

    const read = await getMarketplaceHealth(undefined, 'it');

    expect(rawGet).toHaveBeenCalledWith('/marketplace/health', expect.objectContaining({ params: { propertyId: undefined, lang: 'it' } }));
    expect(read).toEqual({ outcome: 'items', items: [HEALTH_ROW] });
  });

  it('getMarketplaceHealth_ValidateStatus_AcceptsTheAnswers403And404ButNotAFailureOfTheServer', async () => {
    rawGet.mockResolvedValue({ status: 200, data: { items: [] } });
    await getMarketplaceHealth('prop-1', 'en');
    const options = rawGet.mock.calls[0]?.[1] as { validateStatus: (status: number) => boolean };

    // A 403 is answered, not thrown: the interceptor of the client would send the person to the page of no access.
    expect([200, 204, 403, 404].map((status) => options.validateStatus(status))).toEqual([true, true, true, true]);
    expect([400, 401, 409, 422, 500, 502, 503].map((status) => options.validateStatus(status))).toEqual([false, false, false, false, false, false, false]);
  });

  it('getMarketplaceHealth_403_IsForbidden_And404_IsNotFound_WithNoRows', async () => {
    rawGet.mockResolvedValueOnce({ status: 403, data: '' });
    expect(await getMarketplaceHealth(undefined, 'it')).toEqual({ outcome: 'forbidden' });

    rawGet.mockResolvedValueOnce({ status: 404, data: { code: 'marketplace_property_not_found' } });
    expect(await getMarketplaceHealth('prop-9', 'it')).toEqual({ outcome: 'notFound' });
  });

  it('getMarketplaceHealth_AnswerThatIsNotTheHealth_IsALoadError_NeverAnEmptyList', async () => {
    rawGet.mockResolvedValue({ status: 200, data: '<html>proxy</html>' });
    await expect(getMarketplaceHealth(undefined, 'it')).rejects.toBeInstanceOf(UnexpectedApiResponseError);

    // A row that is not an activation makes the whole read an error: a shorter list would say «no problem» about what it left out.
    rawGet.mockResolvedValue({ status: 200, data: { items: [HEALTH_ROW, { activationId: 'x' }] } });
    await expect(getMarketplaceHealth(undefined, 'it')).rejects.toBeInstanceOf(UnexpectedApiResponseError);
  });

  it('getMarketplaceHealth_ErrorWithoutWords_IsStillAProblem_AndAMalformedQuotaIsNotRead', async () => {
    rawGet.mockResolvedValue({
      status: 200,
      data: { items: [{ ...HEALTH_ROW, error: { code: 'x' }, quota: { used: '4', limit: 5 } }] },
    });

    const read = await getMarketplaceHealth(undefined, 'it');

    expect(read.outcome === 'items' && read.items[0]).toMatchObject({ error: { code: 'x', message: '' }, quota: null });
  });
});

describe('getMarketplaceActive', () => {
  it('getMarketplaceActive_AsksForTheLanguage_AndKeepsTheRowsAsTheServerSentThem', async () => {
    clientGet.mockResolvedValue({
      integrations: [
        { kind: 'Partner', code: 'beds', name: 'TEST Beds', property: null, status: 'Active', isDeclared: true, lastSyncedAt: null, declaredAt: '2026-11-10T00:00:00Z', verifiedAt: null },
        { kind: 'Channel', code: 'PORTAL1', name: 'TEST Portal', property: { id: 'prop-1', name: 'Villa Rosa' }, status: 'Pending', isDeclared: false },
      ],
      providers: [],
    } as never);

    const data = await getMarketplaceActive('prop-1', 'en');

    expect(clientGet).toHaveBeenCalledWith('/marketplace/active', { propertyId: 'prop-1', lang: 'en' });
    expect(data.integrations[0]).toMatchObject({ property: null, isDeclared: true, declaredAt: '2026-11-10T00:00:00Z', verifiedAt: null });
    // What a row leaves out is `null`, never made up.
    expect(data.integrations[1]).toMatchObject({ property: { id: 'prop-1', name: 'Villa Rosa' }, lastSyncedAt: null, declaredAt: null, verifiedAt: null });
  });

  it('getMarketplaceActive_RowThatIsNotAnActivation_IsALoadError', async () => {
    clientGet.mockResolvedValue({ integrations: [{ kind: 'Channel' }], providers: [] } as never);

    await expect(getMarketplaceActive(undefined, 'it')).rejects.toBeInstanceOf(UnexpectedApiResponseError);
  });
});

const CHANGE = { activationId: 'act-1', kind: 'Channel', code: 'PORTAL1', propertyId: 'prop-1', status: 'Deactivated', changeRequestedAt: null };

describe('the change of an activation', () => {
  it('deactivateActivation_PostsTheConfirmationOnTheActivationAndReturnsTheStatusTheServerGave', async () => {
    clientPost.mockResolvedValue({ ...CHANGE, status: 'Pending' } as never);

    const outcome = await deactivateActivation('act 1/x');

    // The id is encoded, and the body says yes: nothing else is sent.
    expect(clientPost).toHaveBeenCalledWith('/marketplace/activations/act%201%2Fx/deactivate', { confirmed: true });
    expect(outcome.status).toBe('Pending');
  });

  it('deactivateActivation_AnswerThatIsNotAnActivation_IsALoadError_NeverADeactivation', async () => {
    clientPost.mockResolvedValue('<html>proxy</html>' as never);

    await expect(deactivateActivation('act-1')).rejects.toBeInstanceOf(UnexpectedApiResponseError);
  });

  it('updateActivationSettings_PatchesOnlyTheMembersGiven', async () => {
    clientPatch.mockResolvedValue({ ...CHANGE, status: 'Active' } as never);

    await updateActivationSettings('act-1', { hotelId: '4711' });

    expect(clientPatch).toHaveBeenCalledWith('/marketplace/activations/act-1', { hotelId: '4711' });
  });

  it('requestFunctionChange_PostsToTheChangeRequestAndKeepsTheDateTheServerGave', async () => {
    clientPost.mockResolvedValue({ ...CHANGE, kind: 'LicensedFunction', changeRequestedAt: '2026-11-13T10:00:00Z' } as never);

    const outcome = await requestFunctionChange('act-f');

    expect(clientPost).toHaveBeenCalledWith('/marketplace/activations/act-f/change-request', {});
    expect(outcome.changeRequestedAt).toBe('2026-11-13T10:00:00Z');
  });

  it('getDeactivationPreview_AsksForTheLanguage_AndKeepsTheSentencesAsTheServerWroteThem', async () => {
    clientGet.mockResolvedValue({ activationId: 'act-1', kind: 'Channel', code: 'PORTAL1', name: 'TEST Portal', effects: ['One.', 'Two.'], requiresConfirmation: true, guided: false } as never);

    const preview = await getDeactivationPreview('act-1', 'en');

    expect(clientGet).toHaveBeenCalledWith('/marketplace/activations/act-1/deactivation-preview', { lang: 'en' });
    expect(preview.effects).toEqual(['One.', 'Two.']);
  });

  it('getDeactivationPreview_NoSentence_IsALoadError_ThePersonIsNeverAskedToConfirmWhatWasNotShown', async () => {
    clientGet.mockResolvedValue({ activationId: 'act-1', kind: 'Channel', code: 'PORTAL1', name: 'TEST Portal', effects: [], requiresConfirmation: true, guided: false } as never);
    await expect(getDeactivationPreview('act-1', 'it')).rejects.toBeInstanceOf(UnexpectedApiResponseError);

    clientGet.mockResolvedValue({ activationId: 'act-1', effects: ['One.', 42] } as never);
    await expect(getDeactivationPreview('act-1', 'it')).rejects.toBeInstanceOf(UnexpectedApiResponseError);
  });
});
