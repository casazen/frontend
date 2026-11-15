import { AxiosError, type AxiosResponse } from 'axios';
import axios from '@/lib/axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type {
  SelfBillingDetail,
  SelfBillingFailure,
  SelfBillingGeneration,
  SelfBillingIssueRequest,
  SelfBillingLine,
  SelfBillingListItem,
  SelfBillingNotDue,
  SelfBillingOutcome,
} from '@/types';
import { acceptsRefusal } from './accept-refusal';

const PATH = '/fiscal/self-billing';

/** The drafts of a month are made from the owner ledger of the month for every holder and portal that needs one: it takes longer than the 30 s of every other call on an agency with many owners. */
const DRAFTS_TIMEOUT_MS = 5 * 60_000;

/** The 403 of the self-billed invoices is an answer of these calls (the whole organization only), not a failure of the app: it is thrown again as the error it is, with the response, and never sends the whole app to the page of no access. */
function refusalOf(response: AxiosResponse): AxiosError {
  return new AxiosError(`Request failed with status code ${response.status}`, AxiosError.ERR_BAD_REQUEST, response.config, response.request, response);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isOptionalText = (value: unknown) => value === undefined || value === null || typeof value === 'string';
const textOf = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** One TD17 of the list, reduced to what the page shows: the codes, the amounts and the currency are there and of the right type. A member that is not one is a load error for the whole answer, never a row left out. */
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
    !isOptionalText(value.issueDate)
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

/** What the drafts of a month did: the counts and every row. An answer that is not one is a load error: the page never says «done» over a body it could not read. */
function generationOf(data: unknown, path: string): SelfBillingGeneration {
  if (!isRecord(data)) throw new UnexpectedApiResponseError(path);
  const drafts = Array.isArray(data.drafts) ? data.drafts.map(outcomeOf) : null;
  const failed = Array.isArray(data.failed) ? data.failed.map(failureOf) : null;
  const notDue = Array.isArray(data.notDue) ? data.notDue.map(notDueOf) : null;
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
    [...drafts, ...failed, ...notDue].some((row) => row === null)
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
    ledgerPosted: data.ledgerPosted,
  };
}

/**
 * The self-billed invoices (TD17) of the organization, drafts and issued ones, the newest month first (`GET api/fiscal/self-billing`, `agency.invoice.manage`, the whole organization): `period` (`yyyy-MM`) narrows
 * the list to a month. 422 `self_billing_period_invalid`. A 403 is thrown as the refusal it is (no redirect to the no-access page).
 */
export async function listSelfBilling(period?: string): Promise<SelfBillingListItem[]> {
  const response = await axios.get<unknown>(PATH, { params: period ? { period } : undefined, validateStatus: acceptsRefusal });
  if (response.status === 403) throw refusalOf(response);
  const rows = Array.isArray(response.data) ? response.data.map(itemOf) : null;
  if (rows === null || rows.some((row) => row === null)) throw new UnexpectedApiResponseError(PATH);
  return rows as SelfBillingListItem[];
}

/** One TD17 with its lines (`GET api/fiscal/self-billing/{id}`). 404 `fiscal_document_not_found` for a document of another organization or one that is not a TD17. */
export async function getSelfBilling(id: string): Promise<SelfBillingDetail> {
  const path = `${PATH}/${encodeURIComponent(id)}`;
  const response = await axios.get<unknown>(path, { validateStatus: acceptsRefusal });
  if (response.status === 403) throw refusalOf(response);
  return detailOf(response.data, path);
}

/**
 * The drafts of a month for every holder and portal that needs a TD17 (`POST api/fiscal/self-billing/drafts`, `{ period: 'yyyy-MM' }`): made, or made again, with the holders that need one and cannot get one yet and the
 * commissions that are not self-billed. 422 `self_billing_period_invalid`, `self_billing_period_not_ended` (the month is not over), `self_billing_not_configured`.
 */
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

/** The draft of a TD17 discarded (`DELETE api/fiscal/self-billing/{id}`): no number is consumed, and its holder, portal and month are free for a new draft. 422 `document_not_draft`. */
export async function discardSelfBilling(id: string): Promise<void> {
  await axios.delete(`${PATH}/${encodeURIComponent(id)}`);
}
