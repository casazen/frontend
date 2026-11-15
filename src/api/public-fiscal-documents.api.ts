import axios from '@/lib/axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { ApiClient } from './client';
import type { DownloadedFile } from './file.api';

/**
 * The page of the document a guest got by e-mail (`/documents/view/:documentId?token=…`, E12/F02/US02/T01), reached from the link of the
 * e-mail: the token of the link is the only access check, sent in the BODY of the two calls and never in the address of the API, in a header
 * or in a query. Anonymous; the answers carry no personal data (no name, no address, no fiscal code).
 *
 * Every failure is given back without the request that failed: an error of axios holds the body that was sent (`config.data`), and that body is
 * the token, which no cache, no state and no log may keep.
 */

/** What the guest sees of the document: nothing else is in the answer. */
export interface PublicFiscalDocument {
  id: string;
  /** `Invoice`, `Receipt` or `CreditNote`: the name of the kind as the API writes it (a value this page does not know is shown as a plain «document»). */
  kind: string;
  number: string;
  /** The day of the issue, `yyyy-MM-dd`. */
  issueDate: string;
  total: number;
  /** The ISO code of the currency of the document (`EUR`, `CHF`); `null` when the answer carries none: the page then says so and shows no symbol. */
  currency: string | null;
}

/** A PDF is a few hundred kB: more than the 30 s of every other call, on a connection that is not fast (as for the host's own download). */
const DOWNLOAD_TIMEOUT_MS = 120_000;

const enc = encodeURIComponent;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The name the API gave the file (`Content-Disposition`, whatever the case of the header), or `null` when the page cannot read it: a browser reads a header of
 * another origin only if the API exposes it, and the caller then saves under the name it built.
 */
function dispositionOf(headers: unknown): string | null {
  if (!isRecord(headers)) return null;
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === 'content-disposition' && typeof value === 'string') return value;
  }
  return null;
}

/**
 * The summary the API answers, or `null` when the body is not one: the members the page draws are there and of the right type (a total is a
 * number, never a text that happens to look like one). A body that is not a summary (the SPA's `index.html` behind a wrong rewrite) is never
 * drawn as a document.
 */
function summaryOf(value: unknown): PublicFiscalDocument | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.kind !== 'string' ||
    typeof value.number !== 'string' ||
    typeof value.issueDate !== 'string' ||
    typeof value.total !== 'number' ||
    !Number.isFinite(value.total)
  ) {
    return null;
  }
  const currency = typeof value.currency === 'string' && value.currency.trim() !== '' ? value.currency.trim() : null;
  return { id: value.id, kind: value.kind, number: value.number, issueDate: value.issueDate, total: value.total, currency };
}

/**
 * The name a PDF is saved under when the page cannot read the one the API gave it (`Content-Disposition`): `documento-A-12.pdf`, from the number of
 * the document and nothing else. Never the name of the guest: a file name is shown in the folder of downloads and kept there.
 */
export function pdfFileNameOf(number: string): string {
  const slug = number.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|-+$/g, '');
  return slug ? `documento-${slug}.pdf` : 'documento.pdf';
}

export const publicFiscalDocumentsApi = {
  /**
   * The summary of the document of the link (`POST api/public/fiscal-documents/{id}`, token in the body). 404 `document_link_invalid` for a wrong, expired or
   * foreign token, a document that is not there and one that cannot be sent: the same answer for all, and nothing of the document in it.
   */
  getDocument: async (documentId: string, token: string): Promise<PublicFiscalDocument> => {
    const path = `/public/fiscal-documents/${enc(documentId)}`;
    try {
      const summary = summaryOf(await ApiClient.post<unknown>(path, { token }, { public: true }));
      if (summary === null) throw new UnexpectedApiResponseError(path);
      return summary;
    } catch (error) {
      throw withoutRequest(error);
    }
  },

  /**
   * The PDF of the document of the link (`POST api/public/fiscal-documents/{id}/pdf`, token in the body), in the language of the page (`Accept-Language`: the
   * API draws the PDF in the language of the request). An answer that is not a PDF is a failure, never a file saved as one.
   */
  downloadPdf: async (documentId: string, token: string, language: string): Promise<DownloadedFile> => {
    const path = `/public/fiscal-documents/${enc(documentId)}/pdf`;
    try {
      const response = await axios.post<Blob>(
        path,
        { token },
        { public: true, responseType: 'blob', timeout: DOWNLOAD_TIMEOUT_MS, headers: { 'Accept-Language': language } },
      );
      const blob: unknown = response.data;
      if (!(blob instanceof Blob) || !blob.type.toLowerCase().startsWith('application/pdf')) throw new UnexpectedApiResponseError(path);
      return { blob, contentDisposition: dispositionOf(response.headers) };
    } catch (error) {
      throw withoutRequest(error);
    }
  },
};
