import { AxiosError, type AxiosResponse } from 'axios';
import axios from '@/lib/axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type {
  SelfBillingCloseRequest,
  SelfBillingDetail,
  SelfBillingFailure,
  SelfBillingGeneration,
  SelfBillingIssueRequest,
  SelfBillingKept,
  SelfBillingLine,
  SelfBillingListItem,
  SelfBillingNotDue,
  SelfBillingOutcome,
} from '@/types';
import { acceptsRefusal } from './accept-refusal';

const PATH = '/fiscal/self-billing';

const DRAFTS_TIMEOUT_MS = 5 * 60_000;

function refusalOf(response: AxiosResponse): AxiosError {
  return new AxiosError(`Request failed with status code ${response.status}`, AxiosError.ERR_BAD_REQUEST, response.config, response.request, response);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isOptionalText = (value: unknown) => value === undefined || value === null || typeof value === 'string';
const isOptionalFlag = (value: unknown) => value === undefined || value === null || typeof value === 'boolean';
const textOf = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/**
 * One TD17 of the list, reduced to what the page shows: the codes, the amounts and the currency are there and of the right type. A member that is not one is a load error for the whole answer, never a row left out.
 * The members of the correction of a rejected TD17 (`canCorrect`, `replacesDocumentId`, `replacedByDocumentId`, `keptReason`) and those of the closing of its replacement (`closedReason`, `closedAt`, `closedBy`,
 * `closedNote`) are additive: a server that does not send them (an older one) has neither, so they are read as «no»; one that sends them with a type that is not the right one is a load error like any other member.
 */
function itemOf(value: unknown): SelfBillingListItem | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.holderKind !== 'string' ||
    typeof value.holderName !== 'string' ||
    typeof value.portalName !== 'string' ||
    typeof value.portalCountry !== 'string' ||
    !isFiniteNumber(value.periodYear) ||
    !isFiniteNumber(value.periodMonth) ||
    typeof value.dueDate !== 'string' ||
    typeof value.status !== 'string' ||
    !isFiniteNumber(value.taxableBase) ||
    !isFiniteNumber(value.vatAmount) ||
    !isFiniteNumber(value.total) ||
    typeof value.currency !== 'string' ||
    typeof value.sdiStatus !== 'string' ||
    !isOptionalText(value.holderOwnerId) ||
    !isOptionalText(value.number) ||
    !isOptionalText(value.issueDate) ||
    !isOptionalFlag(value.canCorrect) ||
    !isOptionalText(value.replacesDocumentId) ||
    !isOptionalText(value.replacedByDocumentId) ||
    !isOptionalText(value.keptReason) ||
    !isOptionalText(value.closedReason) ||
    !isOptionalText(value.closedAt) ||
    !isOptionalText(value.closedBy) ||
    !isOptionalText(value.closedNote)
  ) {
    return null;
  }
  return {
    id: value.id,
    holderKind: value.holderKind,
    holderOwnerId: textOf(value.holderOwnerId),
    holderName: value.holderName,
    portalName: value.portalName,
    portalCountry: value.portalCountry,
    periodYear: value.periodYear,
    periodMonth: value.periodMonth,
    dueDate: value.dueDate,
    number: textOf(value.number),
    issueDate: textOf(value.issueDate),
    status: value.status,
    taxableBase: value.taxableBase,
    vatAmount: value.vatAmount,
    total: value.total,
    currency: value.currency,
    sdiStatus: value.sdiStatus,
    canCorrect: value.canCorrect === true,
    replacesDocumentId: textOf(value.replacesDocumentId),
    replacedByDocumentId: textOf(value.replacedByDocumentId),
    keptReason: textOf(value.keptReason),
    closedReason: textOf(value.closedReason),
    closedAt: textOf(value.closedAt),
    closedBy: textOf(value.closedBy),
    closedNote: textOf(value.closedNote),
  };
}

function lineOf(value: unknown): SelfBillingLine | null {
  if (!isRecord(value) || !isFiniteNumber(value.lineNumber) || typeof value.description !== 'string' || !isFiniteNumber(value.totalPrice) || !isFiniteNumber(value.vatRatePercent)) return null;
  return {
    lineNumber: value.lineNumber,
    description: value.description,
    totalPrice: value.totalPrice,
    vatRatePercent: value.vatRatePercent,
    vatAmount: isFiniteNumber(value.vatAmount) ? value.vatAmount : null,
  };
}

function detailOf(data: unknown, path: string): SelfBillingDetail {
  const invoice = isRecord(data) ? itemOf(data.invoice) : null;
  const lines = isRecord(data) && Array.isArray(data.lines) ? data.lines.map(lineOf) : null;
  if (!isRecord(data) || invoice === null || lines === null || lines.some((line) => line === null) || typeof data.hasXml !== 'boolean' || !isFiniteNumber(data.estimatedAmount)) {
    throw new UnexpectedApiResponseError(path);
  }
  return {
    invoice,
    ruleVersion: textOf(data.ruleVersion),
    vatRatePercent: isFiniteNumber(data.vatRatePercent) ? data.vatRatePercent : null,
    hasXml: data.hasXml,
    estimatedAmount: data.estimatedAmount,
    lines: (lines as SelfBillingLine[]).sort((a, b) => a.lineNumber - b.lineNumber),
  };
}

function outcomeOf(value: unknown): SelfBillingOutcome | null {
  if (
    !isRecord(value) ||
    typeof value.documentId !== 'string' ||
    typeof value.holderKind !== 'string' ||
    typeof value.portalName !== 'string' ||
    typeof value.result !== 'string' ||
    !isFiniteNumber(value.taxableBase) ||
    !isFiniteNumber(value.estimatedAmount) ||
    !isOptionalText(value.holderOwnerId)
  ) {
    return null;
  }
  return {
    documentId: value.documentId,
    holderKind: value.holderKind,
    holderOwnerId: textOf(value.holderOwnerId),
    portalName: value.portalName,
    result: value.result,
    taxableBase: value.taxableBase,
    estimatedAmount: value.estimatedAmount,
    changedSinceIssue: value.changedSinceIssue === true,
  };
}

function failureOf(value: unknown): SelfBillingFailure | null {
  if (!isRecord(value) || typeof value.holderKind !== 'string' || typeof value.portalName !== 'string' || typeof value.code !== 'string' || !isOptionalText(value.holderOwnerId)) return null;
  return {
    holderKind: value.holderKind,
    holderOwnerId: textOf(value.holderOwnerId),
    portalName: value.portalName,
    code: value.code,
    fields: Array.isArray(value.fields) ? value.fields.filter((field): field is string => typeof field === 'string') : [],
  };
}

function notDueOf(value: unknown): SelfBillingNotDue | null {
  if (!isRecord(value) || typeof value.reason !== 'string' || typeof value.channel !== 'string' || !isFiniteNumber(value.stays) || !isFiniteNumber(value.amount) || typeof value.currency !== 'string') return null;
  return { reason: value.reason, channel: value.channel, stays: value.stays, amount: value.amount, currency: value.currency };
}

function keptOf(value: unknown): SelfBillingKept | null {
  if (
    !isRecord(value) ||
    typeof value.documentId !== 'string' ||
    typeof value.holderKind !== 'string' ||
    typeof value.portalName !== 'string' ||
    typeof value.reason !== 'string' ||
    !isOptionalText(value.holderOwnerId) ||
    !isOptionalText(value.number)
  ) {
    return null;
  }
  return {
    documentId: value.documentId,
    holderKind: value.holderKind,
    holderOwnerId: textOf(value.holderOwnerId),
    portalName: value.portalName,
    number: textOf(value.number),
    reason: value.reason,
  };
}

function generationOf(data: unknown, path: string): SelfBillingGeneration {
  if (!isRecord(data)) throw new UnexpectedApiResponseError(path);
  const drafts = Array.isArray(data.drafts) ? data.drafts.map(outcomeOf) : null;
  const failed = Array.isArray(data.failed) ? data.failed.map(failureOf) : null;
  const notDue = Array.isArray(data.notDue) ? data.notDue.map(notDueOf) : null;
  const kept = data.kept === undefined || data.kept === null ? [] : Array.isArray(data.kept) ? data.kept.map(keptOf) : null;
  if (
    !isFiniteNumber(data.year) ||
    !isFiniteNumber(data.month) ||
    !isFiniteNumber(data.created) ||
    !isFiniteNumber(data.updated) ||
    !isFiniteNumber(data.alreadyIssued) ||
    !isFiniteNumber(data.discarded) ||
    typeof data.ledgerPosted !== 'boolean' ||
    drafts === null ||
    failed === null ||
    notDue === null ||
    kept === null ||
    [...drafts, ...failed, ...notDue, ...kept].some((row) => row === null)
  ) {
    throw new UnexpectedApiResponseError(path);
  }
  return {
    year: data.year,
    month: data.month,
    created: data.created,
    updated: data.updated,
    alreadyIssued: data.alreadyIssued,
    discarded: data.discarded,
    drafts: drafts as SelfBillingOutcome[],
    failed: failed as SelfBillingFailure[],
    notDue: notDue as SelfBillingNotDue[],
    kept: kept as SelfBillingKept[],
    ledgerPosted: data.ledgerPosted,
  };
}

export async function listSelfBilling(period?: string): Promise<SelfBillingListItem[]> {
  const response = await axios.get<unknown>(PATH, { params: period ? { period } : undefined, validateStatus: acceptsRefusal });
  if (response.status === 403) throw refusalOf(response);
  const rows = Array.isArray(response.data) ? response.data.map(itemOf) : null;
  if (rows === null || rows.some((row) => row === null)) throw new UnexpectedApiResponseError(PATH);
  return rows as SelfBillingListItem[];
}

export async function getSelfBilling(id: string): Promise<SelfBillingDetail> {
  const path = `${PATH}/${encodeURIComponent(id)}`;
  const response = await axios.get<unknown>(path, { validateStatus: acceptsRefusal });
  if (response.status === 403) throw refusalOf(response);
  return detailOf(response.data, path);
}

export async function createSelfBillingDrafts(period: string): Promise<SelfBillingGeneration> {
  const path = `${PATH}/drafts`;
  const response = await axios.post<unknown>(path, { period }, { timeout: DRAFTS_TIMEOUT_MS });
  return generationOf(response.data, path);
}

/**
 * The draft issued (`POST api/fiscal/self-billing/{id}/issue`): numbered in the series of its holder, with its XML, to be sent to the SDI. The confirmation the server asks for is the person pressing «Emetti» in the
 * dialog, so it goes in the body here and nowhere else; when part of the amount is an estimate the issue needs `acceptEstimate` too (422 `self_billing_estimate_unconfirmed`, and nothing is numbered). 409
 * `document_draft_outdated` (make the drafts of the month again first); 422 `document_not_draft`, `self_billing_period_not_ended`, `self_billing_not_configured`, `fatturapa_xml_invalid`, `fatturapa_schema_unavailable`.
 */
export async function issueSelfBilling(id: string, request: SelfBillingIssueRequest): Promise<SelfBillingDetail> {
  const path = `${PATH}/${encodeURIComponent(id)}/issue`;
  const response = await axios.post<unknown>(path, { confirm: true, acceptEstimate: request.acceptEstimate });
  return detailOf(response.data, path);
}

export async function discardSelfBilling(id: string): Promise<void> {
  await axios.delete(`${PATH}/${encodeURIComponent(id)}`);
}

/**
 * «Correggi e rimanda» (`POST api/fiscal/self-billing/{id}/correct`, no body, behind the flags of the issuance and of the sending, `agency.invoice.manage`, the whole organization): the TD17 the SDI rejected counts as not
 * issued, so it is discarded (its number stays on it for the history) and a draft that holds its series and number replaces it. Nothing is issued and nothing is sent to the SDI by it. 201 with the replacement, the detail of
 * `GET {id}` (a second call answers the same draft). Only that 201 proves the server acted: the answer is `null` when the server answered 201 but its body is not a TD17 this client can read (the correction was made,
 * and the draft is in the list). Any other success status (a 200 with the page of the app served in place of the API, a 204) is not the answer of the endpoint: it is an `UnexpectedApiResponseError`, a call that failed, told
 * as such and asked again (a second call answers the same draft), never as «done».
 * 404 `fiscal_document_not_found` (another organization, not a TD17, unknown; also while a flag is off, with no code), 422 `self_billing_not_correctable` (not issued and rejected, or an issued credit note), 403.
 * A 403 of a write never sends the app to the page of no access (the shared client does that for reads only): the screen that asked tells it.
 */
export async function startSelfBillingCorrection(id: string): Promise<SelfBillingDetail | null> {
  const path = `${PATH}/${encodeURIComponent(id)}/correct`;
  const response = await axios.post<unknown>(path);
  if (response.status !== 201) throw new UnexpectedApiResponseError(path);
  try {
    return detailOf(response.data, path);
  } catch (error) {
    if (error instanceof UnexpectedApiResponseError) return null;
    throw error;
  }
}

/**
 * «Chiudi come non più dovuta» (`POST api/fiscal/self-billing/{id}/close-not-due`, `{ reason, note? }`, behind the flags of the issuance and of the sending, `agency.invoice.manage`, the whole organization): the
 * replacement draft of a rejected TD17 that the month no longer supports is closed with the reason, the person and the day recorded, and KEEPS its number (reserved, never given to another invoice). The note is left out of
 * the body when there is none. 200 with the detail of the closed draft (`invoice.status` `Discarded`, `invoice.closedReason` set); the same call again with the same reason answers the same 200, so a double click is not an error.
 * A 200 is the generic success status, so it proves the server acted only when its body is that closed draft: any other answer (the page of the app served in place of the API, a 204, a TD17 that is not closed) is an
 * `UnexpectedApiResponseError`, a call that failed, told as such and asked again (safe: the same call answers the same draft), never as «done».
 * 404 `fiscal_document_not_found` (another organization, not a TD17, unknown; also while a flag is off, with no code), 422 `close_reason_required`, `close_note_too_long`, `self_billing_already_closed` (closed with another
 * reason), `self_billing_not_closable` (not the replacement of a rejected TD17, or one the month still supports), 403. A 403 of a write never sends the app to the page of no access: the screen that asked tells it.
 */
export async function closeSelfBillingNotDue(id: string, request: SelfBillingCloseRequest): Promise<SelfBillingDetail> {
  const path = `${PATH}/${encodeURIComponent(id)}/close-not-due`;
  const response = await axios.post<unknown>(path, request.note ? { reason: request.reason, note: request.note } : { reason: request.reason });
  if (response.status !== 200) throw new UnexpectedApiResponseError(path);
  const detail = detailOf(response.data, path);
  if (detail.invoice.status !== 'Discarded' || detail.invoice.closedReason === null) throw new UnexpectedApiResponseError(path);
  return detail;
}
