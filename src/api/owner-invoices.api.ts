import axios from '@/lib/axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { ApiClient } from './client';
import { acceptsRefusal } from './accept-refusal';
import { downloadPdf } from './fiscal-documents.api';
import type { DownloadedFile } from './file.api';
import type { OwnerInvoice, OwnerInvoiceCriteria, OwnerInvoiceListItem } from '@/types';

const PATH = '/owner-invoices';

/**
 * The invoices of the property manager to the owners (E13/F02/US01/T03, NF-114; backend `api/owner-invoices`). Paths are relative to the API base URL, which already ends in `/api`.
 * The list needs `agency.statement.view`, the writes `agency.statement.manage`: the owner and the administrators of an org on the agency plan. Everything answers 404 while the flag
 * `OwnerInvoicing` is off. Every write is an explicit call: nothing here makes, issues or discards an invoice by itself.
 */
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
   * The draft of the invoice of a statement version, or the draft its owner and month already have, made again from that version (it has the lines, with their VAT, as of now).
   * 409 `owner_invoice_version_superseded`, `document_already_issued`; 422 `owner_invoice_nothing_to_invoice`, `document_rule_not_configured`, `issuer_profile_incomplete`.
   */
  createDraft: (versionId: string) => ApiClient.post<OwnerInvoice>(`${PATH}/drafts`, { versionId }),

  /**
   * Issues the draft after the person confirmed it (`confirm: true`): it is numbered in the series of the owner invoices, and the VAT it adds is posted once to the owner ledger.
   * 409 `document_draft_outdated` (make the draft again first); 422 `document_not_draft`, `fatturapa_schema_unavailable`.
   */
  issue: (invoiceId: string) => ApiClient.post<OwnerInvoice>(`${PATH}/${encodeURIComponent(invoiceId)}/issue`, { confirm: true }),

  /** The PDF of an invoice, through CasaZen as every document of the fiscal chain (the refusal of that read is an error of the call, not a trip to the page of no access). */
  downloadPdf: (invoiceId: string): Promise<DownloadedFile> => downloadPdf({ id: invoiceId, source: 'CasaZen' }),
};
