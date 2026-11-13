import axios from '@/lib/axios';
import { withJsonErrorBody } from '@/lib/file-download';

/** A file the API sent back: its bytes and the name it gave it (`Content-Disposition`, when the page may read the header of the answer). */
export interface DownloadedFile {
  blob: Blob;
  contentDisposition: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The header `name` of an answer whatever the case of its name (a plain object or the headers of axios); `null` when the page cannot read it. */
function headerOf(headers: unknown, name: string): string | null {
  if (!isRecord(headers)) return null;
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted && typeof value === 'string') return value;
  }
  return null;
}

/**
 * The files of the agency's money pages (statements, F24, wire files): always through the authenticated client, never a link that carries a token, and
 * never kept: the caller saves the bytes and lets them go. With `responseType: 'blob'` a refusal arrives as a Blob too, so its problem body is read
 * before it is thrown and its `code` can be told in words.
 */
export const fileApi = {
  get: async (path: string, params?: Record<string, unknown>): Promise<DownloadedFile> => {
    try {
      const res = await axios.get<Blob>(path, { params, responseType: 'blob' });
      return { blob: res.data, contentDisposition: headerOf(res.headers, 'content-disposition') };
    } catch (error) {
      throw await withJsonErrorBody(error);
    }
  },
};
