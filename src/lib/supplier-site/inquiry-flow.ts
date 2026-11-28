import type { PublicInquiryBody } from '@/api/public-supplier-inquiry.api';
import { emailProblem, fullNameProblem, phoneProblem, type DraftComune, type FieldProblem } from './booking-flow';

export interface InquiryDraft {
  service: string | null;
  comune?: DraftComune | null;
  message: string;
  fullName: string;
  email: string;
  phone: string;
}

export const EMPTY_INQUIRY_DRAFT: InquiryDraft = { service: null, message: '', fullName: '', email: '', phone: '' };

export const INQUIRY_LIMITS = { messageMin: 10, messageMax: 1000 } as const;

export type InquiryField = 'message' | 'comune' | 'fullName' | 'email' | 'phone' | 'consent';
export type InquiryProblem = FieldProblem | 'tooShort';
export type InquiryProblems = Partial<Record<InquiryField, InquiryProblem>>;

export const normalizedMessage = (value: string) => value.replace(/\r\n?/g, '\n').trim();

export function messageProblem(value: string): InquiryProblem | null {
  const text = normalizedMessage(value);
  if (!text) return 'required';
  if (text.length < INQUIRY_LIMITS.messageMin || !/[\p{L}\p{N}]/u.test(text)) return 'tooShort';
  return text.length > INQUIRY_LIMITS.messageMax ? 'tooLong' : null;
}

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
  trap: string;
}

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
