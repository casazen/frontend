import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import axios from '@/lib/axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { ownerPortalApi } from '../ownerPortal.api';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ownerPortalApi: what is not the answer of the endpoint is an error to show, never a list that is empty (E07/F07/US01/T03)', () => {
  const NOT_A_LIST = [['<!doctype html><html></html>'], [undefined], [{}], [{ items: [] }]];

  describe.each([
    ['getProperties', () => ownerPortalApi.getProperties()],
    ['listStays', () => ownerPortalApi.listStays()],
    ['listExternalDocuments', () => ownerPortalApi.listExternalDocuments()],
    ['listContacts', () => ownerPortalApi.listContacts()],
    ['listConversations', () => ownerPortalApi.listConversations()],
    ['listMessages', () => ownerPortalApi.listMessages('c1')],
  ])('%s', (_name, read) => {
    it.each(NOT_A_LIST)('BodyThatIsNotAList_IsALoadErrorAndNotAnEmptyList (%j)', async (body) => {
      vi.mocked(axios.get).mockResolvedValueOnce({ data: body });
      await expect(read()).rejects.toBeInstanceOf(UnexpectedApiResponseError);
    });

    it('AnEmptyList_IsAnEmptyList_BecauseTheServerSaidSo', async () => {
      vi.mocked(axios.get).mockResolvedValueOnce({ data: [] });
      await expect(read()).resolves.toEqual([]);
    });
  });

  it.each([['<!doctype html>'], [undefined], [null], [[]]])('ReadsOfAnObject_BodyThatIsNotAnObject_IsALoadError (%j)', async (body) => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: body });
    await expect(ownerPortalApi.getStayRule('p1')).rejects.toBeInstanceOf(UnexpectedApiResponseError);
    vi.mocked(axios.get).mockResolvedValueOnce({ data: body });
    await expect(ownerPortalApi.getCalendar('p1')).rejects.toBeInstanceOf(UnexpectedApiResponseError);
  });

  it.each([[{ documents: [] }], [{ statements: [] }], [{ documents: {}, statements: [] }], [[]]])(
    'listDocuments_BothListsMustBeThere_OrTheAnswerIsNotTheOneOfTheEndpoint (%j)',
    async (body) => {
      vi.mocked(axios.get).mockResolvedValueOnce({ data: body });
      await expect(ownerPortalApi.listDocuments()).rejects.toBeInstanceOf(UnexpectedApiResponseError);
    },
  );

  it('listDocuments_KeepsTheTwoListsAndNothingElseOfTheAnswer', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ data: { documents: [{ id: 'd1' }], statements: [{ statementVersionId: 's1' }], somethingElse: 'x' } });

    await expect(ownerPortalApi.listDocuments()).resolves.toEqual({ documents: [{ id: 'd1' }], statements: [{ statementVersionId: 's1' }] });
    expect(axios.get).toHaveBeenCalledWith('/owner-portal/documents', { params: undefined });
  });
});

describe('ownerPortalApi: the requests (ids in the path, dates in the query, the words in the body)', () => {
  it('getCalendar_AsksForOnePropertyAndTheDaysGiven_AndNothingElse', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { propertyId: 'p1', from: '2026-11-13', to: '2027-02-11', ranges: [] } });

    await ownerPortalApi.getCalendar('p1', '2026-11-13', '2027-02-11');
    await ownerPortalApi.getCalendar('p1');

    expect(axios.get).toHaveBeenNthCalledWith(1, '/owner-portal/calendar', { params: { propertyId: 'p1', from: '2026-11-13', to: '2027-02-11' } });
    expect(axios.get).toHaveBeenNthCalledWith(2, '/owner-portal/calendar', { params: { propertyId: 'p1' } });
  });

  it('requestStay_SendsThePropertyAndTheTwoDays_AndCancelStayPutsTheIdInThePath', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { id: 's1' } });

    await ownerPortalApi.requestStay({ propertyId: 'p1', startDate: '2027-01-10', endDate: '2027-01-14' });
    await ownerPortalApi.cancelStay('s/1');

    expect(axios.post).toHaveBeenNthCalledWith(1, '/owner-portal/stays', { propertyId: 'p1', startDate: '2027-01-10', endDate: '2027-01-14' }, undefined);
    expect(axios.post).toHaveBeenNthCalledWith(2, '/owner-portal/stays/s%2F1/cancel', undefined, undefined);
  });

  it('inviteContact_AndTheChangeOfPermissions_SendOnlyTheListsGiven_NeverAnImplicitAll', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { id: 'c1' } });
    vi.mocked(axios.put).mockResolvedValue({ data: { id: 'c1' } });

    await ownerPortalApi.inviteContact({ email: 'anna@example.com', firstName: 'Anna', lastName: 'Verdi', permissions: ['calendar.read'] });
    await ownerPortalApi.setContactPermissions('c1', ['inbox.use']);
    await ownerPortalApi.revokeContact('c1');

    expect(axios.post).toHaveBeenNthCalledWith(1, '/owner-portal/contacts', { email: 'anna@example.com', firstName: 'Anna', lastName: 'Verdi', permissions: ['calendar.read'] }, undefined);
    expect(axios.put).toHaveBeenCalledWith('/owner-portal/contacts/c1/permissions', { permissions: ['inbox.use'] }, undefined);
    expect(axios.post).toHaveBeenNthCalledWith(2, '/owner-portal/contacts/c1/revoke', undefined, undefined);
  });

  it('acceptContact_SendsTheSecretInTheBodyOnly_NeverInTheAddress', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { ownerUserId: 'u1', claimsRefresh: 'published' } });
    const secret = 'Qx7_aB-9kLmN0pRsTuVwXyZ1234567890AbCdEfGhIj';

    await ownerPortalApi.acceptContact(secret);

    expect(axios.post).toHaveBeenCalledWith('/owner-contacts/accept', { token: secret }, undefined);
    expect(vi.mocked(axios.post).mock.calls[0][0]).not.toContain(secret);
  });

  it('startConversation_AndPreferences_GoWhereTheyShould', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { id: 'cv1' } });
    vi.mocked(axios.put).mockResolvedValue({ data: { emailNotifications: false } });
    vi.mocked(axios.get).mockResolvedValue({ data: { emailNotifications: true } });

    await ownerPortalApi.startConversation({ topic: 'document', documentId: 'd1', subject: 'Scadenza', body: 'Quando scade?' });
    await ownerPortalApi.setInboxPreferences(false);
    await ownerPortalApi.getInboxPreferences();

    expect(axios.post).toHaveBeenCalledWith('/owner-portal/conversations', { topic: 'document', documentId: 'd1', subject: 'Scadenza', body: 'Quando scade?' }, undefined);
    expect(axios.put).toHaveBeenCalledWith('/owner-portal/inbox/preferences', { emailNotifications: false }, undefined);
    expect(axios.get).toHaveBeenCalledWith('/owner-portal/inbox/preferences', { params: undefined });
  });
});

describe('ownerPortalApi: the files (a blob from the authenticated API, a multipart form for the upload)', () => {
  it('downloadDocument_AsksForTheVersionGiven_AsABlob_ThroughTheTokenInterceptor', async () => {
    const blob = new Blob(['%PDF']);
    vi.mocked(axios.get).mockResolvedValue({ data: blob });

    const result = await ownerPortalApi.downloadDocument('d/1', 'v 2');
    await ownerPortalApi.downloadDocument('d1');

    expect(result).toBe(blob);
    expect(axios.get).toHaveBeenNthCalledWith(1, '/owner-portal/documents/d%2F1/file?versionId=v%202', { responseType: 'blob' });
    // Without a version the server hands out the one in force: no query at all.
    expect(axios.get).toHaveBeenNthCalledWith(2, '/owner-portal/documents/d1/file', { responseType: 'blob' });
    // Never an anonymous call.
    expect(vi.mocked(axios.get).mock.calls[0][1]).not.toHaveProperty('public');
  });

  it('downloadAttachment_AsksForTheFileOfThatMessageOfThatConversation', async () => {
    const blob = new Blob(['%PDF']);
    vi.mocked(axios.get).mockResolvedValue({ data: blob });

    await expect(ownerPortalApi.downloadAttachment('c1', 'm 1')).resolves.toBe(blob);

    expect(axios.get).toHaveBeenCalledWith('/owner-portal/conversations/c1/messages/m%201/attachment', { responseType: 'blob' });
  });

  it('downloadDocument_AProblemBodyThatArrivesAsABlob_IsParsedSoThatItsCodeCanBeRead', async () => {
    const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
    const body = new Blob([JSON.stringify({ code: 'owner_document_not_found' })], { type: 'application/json' });
    vi.mocked(axios.get).mockRejectedValueOnce(new AxiosError('Not found', AxiosError.ERR_BAD_REQUEST, config, {}, { status: 404, data: body, statusText: '', headers: {}, config }));

    const error = await ownerPortalApi.downloadDocument('d1').catch((e: unknown) => e);

    expect((error as AxiosError).response?.data).toEqual({ code: 'owner_document_not_found' });
  });

  it('postMessage_SendsTheWordsAndTheFileAsAMultipartForm_AndNoFileWhenThereIsNone', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { id: 'm1' } });
    const file = new File(['%PDF-1.4'], 'fattura.pdf', { type: 'application/pdf' });

    await ownerPortalApi.postMessage('c/1', 'Ecco il documento', file);
    await ownerPortalApi.postMessage('c1', 'Solo parole');

    const [url, form, options] = vi.mocked(axios.post).mock.calls[0] as [string, FormData, { headers: Record<string, string> }];
    expect(url).toBe('/owner-portal/conversations/c%2F1/messages');
    expect(form).toBeInstanceOf(FormData);
    expect(form.get('body')).toBe('Ecco il documento');
    expect((form.get('file') as File).name).toBe('fattura.pdf');
    expect(options).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } });
    const second = vi.mocked(axios.post).mock.calls[1][1] as FormData;
    expect(second.get('body')).toBe('Solo parole');
    expect(second.has('file')).toBe(false);
  });
});
