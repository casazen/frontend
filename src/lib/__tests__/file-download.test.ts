import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/config';
import { getProblemMessage } from '../api-errors';
import { saveBlobAs, withJsonErrorBody } from '../file-download';

function blobError(status: number, body: Blob): AxiosError {
  const config = { headers: new AxiosHeaders(), responseType: 'blob' } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, {
    status,
    data: body,
    statusText: '',
    headers: {},
    config,
  });
}

beforeAll(async () => {
  await i18n.changeLanguage('it');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('withJsonErrorBody (FD-07)', () => {
  it('withJsonErrorBody_jsonBlobBody_exposesCodeToGetProblemMessage', async () => {
    const body = new Blob([JSON.stringify({ error: 'Il file non è disponibile.', code: 'document_file_missing' })], {
      type: 'application/json',
    });

    const error = await withJsonErrorBody(blobError(404, body));

    expect(getProblemMessage(error, (key) => i18n.t(key))).toBe(i18n.t('apiErrors.codes.documentFileMissing'));
  });

  it('withJsonErrorBody_nonJsonBlob_keepsOriginalBody', async () => {
    const body = new Blob(['<html>'], { type: 'text/html' });
    const original = blobError(500, body);

    const error = (await withJsonErrorBody(original)) as AxiosError;

    expect(error).toBe(original);
    expect(error.response?.data).toBe(body);
  });

  it('withJsonErrorBody_notAnAxiosError_returnsItUnchanged', async () => {
    const error = new Error('boom');

    expect(await withJsonErrorBody(error)).toBe(error);
  });
});

describe('saveBlobAs (FD-07)', () => {
  it('saveBlobAs_blob_clicksAnchorWithFileNameAndRevokesUrl', () => {
    const createObjectURL = vi.fn(() => 'blob:http://localhost/doc');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    saveBlobAs(new Blob(['%PDF']), 'Certificato CIN.pdf');

    expect(click).toHaveBeenCalledTimes(1);
    const anchor = click.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchor.download).toBe('Certificato CIN.pdf');
    expect(anchor.href).toBe('blob:http://localhost/doc');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/doc');
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
