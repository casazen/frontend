import type { SeoContentStatus, SeoPageType } from '@/types/seo.types';

/** Maximum length of the audit note (backend `ApproveSeoRevisionRequest.Note` / `WithdrawSeoPageRequest.Note`). */
export const SEO_REVIEW_NOTE_MAX_LENGTH = 1000;

/** Label keys of the page types. */
export const SEO_PAGE_TYPE_KEY: Record<SeoPageType, string> = {
  ComplianceGuide: 'admin.seo.pageType.complianceGuide',
  TouristTaxCalc: 'admin.seo.pageType.touristTaxCalc',
  SupplierMicrosite: 'admin.seo.pageType.supplierMicrosite',
};

/** Label keys of the "content not generated" states; `Generated` depends on whether it is published. */
const NOT_GENERATED_KEY: Record<Exclude<SeoContentStatus, 'Generated'>, string> = {
  AiProviderNotConfigured: 'admin.seo.contentStatus.aiProviderNotConfigured',
  EmptyOutput: 'admin.seo.contentStatus.emptyOutput',
  InvalidOutput: 'admin.seo.contentStatus.invalidOutput',
  Placeholder: 'admin.seo.contentStatus.placeholder',
};

/** Only a generated text can be approved (SE-01): the other states are explicit "content not generated". */
export function isPublishableContent(status: SeoContentStatus): boolean {
  return status === 'Generated';
}

export function contentStatusKey(status: SeoContentStatus, published: boolean): string {
  if (status === 'Generated') {
    return published ? 'admin.seo.contentStatus.generatedPublished' : 'admin.seo.contentStatus.generated';
  }
  return NOT_GENERATED_KEY[status];
}
