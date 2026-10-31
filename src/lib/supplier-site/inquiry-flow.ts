import type { PublicInquiryBody } from '@/api/public-supplier-inquiry.api';
import { emailProblem, fullNameProblem, phoneProblem, type DraftComune, type FieldProblem } from './booking-flow';

/**
 * The request on measure (`/fornitori/:slug/preventivo`, SP-12c): what the customer typed, what makes it ready to send, and the body the
 * server keeps it with. Pure: no clock, no storage, no network. The consent is never part of the draft (it is asked again every time).
 */

export interface InquiryDraft {
  /** Slug of the published service the request is about; null is "something else". */
  service: string | null;
  /**
   * The comune of the work. `undefined`: not chosen here, the one the address of the page named (`?comune=`) stands; `null`: chosen to
   * be empty. A JSON file cannot tell the two apart, which is fine: the address only seeds a new draft.
   */
  comune?: DraftComune | null;
  message: string;
  fullName: string;
  email: string;
  phone: string;
}

export const EMPTY_INQUIRY_DRAFT: InquiryDraft = { service: null, message: '', fullName: '', email: '', phone: '' };

/** The limits of the server (`ShowcaseInquiryLimits`): a text outside them is refused there, so the page says so first. */
export const INQUIRY_LIMITS = { messageMin: 10, messageMax: 1000 } as const;

export type InquiryField = 'message' | 'comune' | 'fullName' | 'email' | 'phone' | 'consent';
/** `tooShort`: fewer than ten characters, or no letter or digit in them. */
export type InquiryProblem = FieldProblem | 'tooShort';
export type InquiryProblems = Partial<Record<InquiryField, InquiryProblem>>;

/** The words of the request as the server reads them: the line breaks are one, the outer spaces are gone. */
export const normalizedMessage = (value: string) => value.replace(/\r\n?/g, '\n').trim();

export function messageProblem(value: string): InquiryProblem | null {
  const text = normalizedMessage(value);
  if (!text) return 'required';
  if (text.length < INQUIRY_LIMITS.messageMin || !/[\p{L}\p{N}]/u.test(text)) return 'tooShort';
  return text.length > INQUIRY_LIMITS.messageMax ? 'tooLong' : null;
}

/** The problems of the request; empty means it can be sent. The consent is the person's, given now, never remembered. */
export function validateInquiry(draft: InquiryDraft, hasComune: boolean, consent: boolean): InquiryProblems {
  const problems: InquiryProblems = {};
  const message = messageProblem(draft.message);
  if (message) problems.message = message;
  if (!hasComune) problems.comune = 'required';
  const fullName = fullNameProblem(draft.fullName);
  if (fullName) problems.fullName = fullName;
  const email = emailProblem(draft.email);
  if (email) problems.email = email;
  const phone = phoneProblem(draft.phone);
  if (phone) problems.phone = phone;
  if (!consent) problems.consent = 'required';
  return problems;
}

export interface InquiryBodyInput {
  draft: InquiryDraft;
  comune: DraftComune;
  locale: string;
  privacyNoticeVersion: string;
  clientRequestId: string;
  /** What the trap field holds (a person leaves it empty). */
  trap: string;
}

/** The body the server keeps the request with. Only call it with a draft that passed {@link validateInquiry} and has a comune. */
export function toInquiryBody(input: InquiryBodyInput): PublicInquiryBody {
  const { draft, comune } = input;
  return {
    clientRequestId: input.clientRequestId,
    ...(draft.service ? { service: draft.service } : {}),
    comuneIstat: comune.istatCode,
    city: comune.name,
    message: normalizedMessage(draft.message),
    fullName: draft.fullName.trim(),
    email: draft.email.trim(),
    phone: draft.phone.trim(),
    locale: input.locale.toLowerCase().startsWith('en') ? 'en' : 'it',
    privacyAccepted: true,
    privacyNoticeVersion: input.privacyNoticeVersion,
    website: input.trap,
  };
}
