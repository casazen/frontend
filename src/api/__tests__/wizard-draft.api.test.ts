import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import axios from '@/lib/axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { wizardDraftApi } from '../wizard-draft.api';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

const ENTITY_ID = '2aeecf5b-b367-412e-a74d-e04bb8f28f16';
const SAVED_AT = '2026-11-06T09:30:00.123Z';

/** The body of a draft as the server sends it: the typed `data` is a member of it, next to the version. */
const draftBody = (overrides: Record<string, unknown> = {}) => ({
  type: 'BookingEdit',
  entityId: ENTITY_ID,
  version: 3,
  data: { shape: 1, step: 'dates', values: { name: 'Casa' } },
  lastSavedAt: SAVED_AT,
  ...overrides,
});

function httpError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('wizardDraftApi.get', () => {
  it('get_ADraft_IsReadFromTheAddressOfItsWizardAndTheTypedDataIsNotUnwrapped', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: draftBody() });

    const draft = await wizardDraftApi.get('BookingEdit', ENTITY_ID);

    expect(axios.get).toHaveBeenCalledWith('/wizards/BookingEdit/draft', { params: { entityId: ENTITY_ID } });
    expect(draft).toEqual({
      type: 'BookingEdit',
      entityId: ENTITY_ID,
      version: 3,
      data: { shape: 1, step: 'dates', values: { name: 'Casa' } },
      lastSavedAt: SAVED_AT,
    });
  });

  it('get_ANewEntity_AsksWithoutAnEntityId', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: draftBody({ entityId: null }) });

    const draft = await wizardDraftApi.get('BookingCreate');

    expect(axios.get).toHaveBeenCalledWith('/wizards/BookingCreate/draft', { params: undefined });
    expect(draft?.entityId).toBeNull();
  });

  it('get_NoDraft_IsNullAndAnyOtherErrorIsThrown', async () => {
    vi.mocked(axios.get).mockRejectedValueOnce(httpError(404, { code: 'wizard_draft_not_found' }));
    await expect(wizardDraftApi.get('BookingCreate')).resolves.toBeNull();

    const failure = httpError(500, {});
    vi.mocked(axios.get).mockRejectedValueOnce(failure);
    await expect(wizardDraftApi.get('BookingCreate')).rejects.toBe(failure);
  });

  it.each([null, '<!doctype html>', {}, draftBody({ data: 'not an object' }), draftBody({ lastSavedAt: 'yesterday' })])(
    'get_ABodyThatIsNotADraft_IsRefused (%j)',
    async (body) => {
      vi.mocked(axios.get).mockResolvedValueOnce({ data: body });

      await expect(wizardDraftApi.get('BookingCreate')).rejects.toBeInstanceOf(UnexpectedApiResponseError);
    },
  );
});

describe('wizardDraftApi.save', () => {
  it('save_ADraft_SendsTheVersionTheClientSawAndGivesBackTheNewOneWithTheTimeOfTheServer', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ data: draftBody({ version: 4 }) });

    const result = await wizardDraftApi.save('BookingEdit', { entityId: ENTITY_ID, clientVersion: 3, data: { step: 'dates' } });

    expect(axios.post).toHaveBeenCalledWith('/wizards/BookingEdit/draft', {
      entityId: ENTITY_ID,
      clientVersion: 3,
      data: { step: 'dates' },
    });
    expect(result).toEqual({ status: 'saved', version: 4, lastSavedAt: SAVED_AT });
  });

  it('save_ADraftOfANewEntity_SendsANullEntityId', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ data: draftBody({ entityId: null, version: 1 }) });

    await wizardDraftApi.save('BookingCreate', { clientVersion: 0, data: {} });

    expect(axios.post).toHaveBeenCalledWith('/wizards/BookingCreate/draft', { entityId: null, clientVersion: 0, data: {} });
  });

  it('save_ABehindTheServer409_IsTheConflictResultWithTheServerDraftAndNotAnError', async () => {
    vi.mocked(axios.post).mockRejectedValueOnce(
      httpError(409, { code: 'draft_conflict', serverVersion: 7, serverDraft: draftBody({ version: 7 }) }),
    );

    const result = await wizardDraftApi.save('BookingEdit', { entityId: ENTITY_ID, clientVersion: 3, data: {} });

    expect(result).toMatchObject({ status: 'conflict', serverVersion: 7, serverDraft: { version: 7, lastSavedAt: SAVED_AT } });
  });

  it('save_AConflictWithNoDraftLeftToShow_StillCarriesTheVersion', async () => {
    vi.mocked(axios.post).mockRejectedValueOnce(httpError(409, { code: 'draft_conflict', serverVersion: 2, serverDraft: null }));

    await expect(wizardDraftApi.save('BookingEdit', { clientVersion: 1, data: {} })).resolves.toEqual({
      status: 'conflict',
      serverDraft: null,
      serverVersion: 2,
    });
  });

  it.each([
    [409, { code: 'something_else' }],
    [409, {}],
    [413, { code: 'wizard_draft_too_large' }],
    [500, {}],
  ])('save_AnyOtherError_IsThrown (%i %j)', async (status, body) => {
    const failure = httpError(status, body);
    vi.mocked(axios.post).mockRejectedValueOnce(failure);

    await expect(wizardDraftApi.save('BookingEdit', { clientVersion: 1, data: {} })).rejects.toBe(failure);
  });

  it('save_AnAnswerThatIsNotADraft_IsRefused', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ data: '<!doctype html>' });

    await expect(wizardDraftApi.save('BookingEdit', { clientVersion: 1, data: {} })).rejects.toBeInstanceOf(UnexpectedApiResponseError);
  });
});

describe('wizardDraftApi.remove', () => {
  it('remove_ADraft_IsDeletedByItsWizardAndEntity', async () => {
    vi.mocked(axios.delete).mockResolvedValueOnce({ data: undefined });

    await wizardDraftApi.remove('BookingEdit', ENTITY_ID);

    expect(axios.delete).toHaveBeenCalledWith('/wizards/BookingEdit/draft', { params: { entityId: ENTITY_ID } });
  });
});
