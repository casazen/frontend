import axios from '@/lib/axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { withJsonErrorBody } from '@/lib/file-download';
import { acceptsRefusal } from './accept-refusal';
import type { DownloadedFile } from './file.api';
import { ReportAccessDeniedError } from './report-files';

const NOT_A_FILE = /^(text\/html|application\/(json|problem\+json))/i;

function headerOf(headers: unknown, name: string): string | null {
  if (typeof headers !== 'object' || headers === null) return null;
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted && typeof value === 'string') return value;
  }
  return null;
}

/**
 * A file of the tax exports of the agency (the withholding, the tourist tax at year end), through the authenticated client and never kept: the caller saves the bytes and lets them go. The 403 is an answer of the
 * call, not a failure of the app: the shared client sends the whole app to the page of no access on a 403 for a read whose body has no code, and an export that needs a permission the person does not hold (the CU, the
 * communication of the contracts: the elevated finance permission; the year-end files: the whole organization) must tell it where the person is. So the refusal is taken as an answer and thrown again as a
 * `ReportAccessDeniedError`. The body of a problem is a Blob until it is parsed: it is, so that its `code` (`tax_no_obligations`, `tax_dataset_not_found`, `tax_cu_dataset_outdated`...) can be told in words.
 */
export async function getTaxFile(path: string, params?: Record<string, string>): Promise<DownloadedFile> {
  try {
    const response = await axios.get<Blob>(path, { params, responseType: 'blob', validateStatus: acceptsRefusal });
    if (response.status === 403) throw new ReportAccessDeniedError(path);
    if (!(response.data instanceof Blob) || NOT_A_FILE.test(response.data.type)) throw new UnexpectedApiResponseError(path);
    return { blob: response.data, contentDisposition: headerOf(response.headers, 'content-disposition') };
  } catch (error) {
    throw await withJsonErrorBody(error);
  }
}
