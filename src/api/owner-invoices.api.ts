import axios from '@/lib/axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { ApiClient } from './client';
import { acceptsRefusal } from './accept-refusal';
import { downloadPdf } from './fiscal-documents.api';
import type { DownloadedFile } from './file.api';
import type { OwnerInvoice, OwnerInvoiceCriteria, OwnerInvoiceListItem } from '@/types';

const PATH = '/owner-invoices';

export const ownerInvoicesApi = {
  /**
   * The invoices of the org, the newest period first: `period` (`yyyy-MM`) and `ownerId` narrow them. `null` when the server refuses the list to this caller (403): a refused read would
   * send the whole app to the page of no access, and the page only has to say that the access is not there. A body that is not a list (the `index.html` of a wrong rewrite) is a load
   * error, never an empty list.
   */
  list: async (criteria: OwnerInvoiceCriteria): Promise<OwnerInvoiceListItem[] | null> => {
    const params: Record<string, string> = {};
    if (criteria.period) params.period = criteria.period;
    if (criteria.ownerId) params.ownerId = criteria.ownerId;
    const response = await axios.get<unknown>(PATH, { params, validateStatus: acceptsRefusal });
    if (response.status === 403) return null;
    if (!Array.isArray(response.data)) throw new UnexpectedApiResponseError(PATH);
    return response.data as OwnerInvoiceListItem[];
  },

  /**
   * One invoice of the org with its lines, as the creation of a draft answers it (`agency.statement.view`, the whole organization): a draft is read again by its id after a reload without making
   * it again, and an issued invoice shows its lines. It also reads a credit note and a discarded draft as they are (their `kind` and `status` say it), which the list leaves out. `null` when the
   * server refuses the read to this caller (403): a refused read would send the whole app to the page of no access, and the screen only has to say that the access is not there. A 404
   * (`fiscal_document_not_found`: another org's invoice, a document that is not an owner invoice, or the module off) is an error of the call. A body that is not an invoice (the `index.html` of a
   * wrong rewrite) is a load error, never an empty invoice.
   */
  get: async (invoiceId: string): Promise<OwnerInvoice | null> => {
    const path = `${PATH}/${encodeURIComponent(invoiceId)}`;
    const response = await axios.get<unknown>(path, { validateStatus: acceptsRefusal });
    if (response.status === 403) return null;
    const data = response.data;
    if (typeof data !== 'object' || data === null || !Array.isArray((data as { lines?: unknown }).lines)) throw new UnexpectedApiResponseError(path);
    return data as OwnerInvoice;
  },

  /**
   * The draft of the invoice of a statement version, or the draft its owner and month already have, made again from that version (it has the lines, with their VAT, as of now).
   * 409 `owner_invoice_version_superseded`, `document_already_issued`; 422 `owner_invoice_nothing_to_invoice`, `document_rule_not_configured`, `issuer_profile_incomplete`.
   */
  createDraft: (versionId: string) => ApiClient.post<OwnerInvoice>(`${PATH}/drafts`, { versionId }),

  /**
   * Issues the draft after the person confirmed it (`confirm: true`): it is numbered in the series of the owner invoices, and the VAT it adds is posted once to the owner ledger.
   * 409 `document_draft_outdated` (make the draft again first); 422 `document_not_draft`, `fatturapa_schema_unavailable`.
   */
  issue: (invoiceId: string) => ApiClient.post<OwnerInvoice>(`${PATH}/${encodeURIComponent(invoiceId)}/issue`, { confirm: true }),

  downloadPdf: (invoiceId: string): Promise<DownloadedFile> => downloadPdf({ id: invoiceId, source: 'CasaZen' }),
};
