import { ApiClient } from './client';

export interface PublicInquiryBody {
  /** Made up once for an attempt: the same id is the same request (a retry after a lost answer sends no second e-mail). */
  clientRequestId: string;
  service?: string;
  comuneIstat?: string;
  city: string;
  message: string;
  fullName: string;
  email: string;
  phone: string;
  locale: 'it' | 'en';
  privacyAccepted: boolean;
  privacyNoticeVersion: string;
  website: string;
}

export interface PublicInquiryCreated {
  id: string;
  expiresAt: string;
}

export interface PublicInquiryConfirmation {
  publicCode: string;
  status: string;
  serviceName?: string | null;
  respondBy?: string | null;
  alreadyConfirmed: boolean;
}

const enc = encodeURIComponent;

export const publicInquiryApi = {
  create: (slug: string, body: PublicInquiryBody) =>
    ApiClient.post<PublicInquiryCreated>(`/public/suppliers/${enc(slug)}/inquiries`, body, { public: true }),

  confirmEmail: (slug: string, inquiryId: string, token: string) =>
    ApiClient.post<PublicInquiryConfirmation>(`/public/suppliers/${enc(slug)}/inquiries/${enc(inquiryId)}/confirm-email`, { token }, { public: true }),
};
