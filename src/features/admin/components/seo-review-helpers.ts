import type { SeoContentStatus, SeoPageType } from '@/types/seo.types';

export const SEO_REVIEW_NOTE_MAX_LENGTH = 1000;

export const SEO_PAGE_TYPE_KEY: Record<SeoPageType, string> = {
  ComplianceGuide: 'admin.seo.pageType.complianceGuide',
  TouristTaxCalc: 'admin.seo.pageType.touristTaxCalc',
  SupplierMicrosite: 'admin.seo.pageType.supplierMicrosite',
};

const NOT_GENERATED_KEY: Record<Exclude<SeoContentStatus, 'Generated' | 'Manual'>, string> = {
  AiProviderNotConfigured: 'admin.seo.contentStatus.aiProviderNotConfigured',
  EmptyOutput: 'admin.seo.contentStatus.emptyOutput',
  InvalidOutput: 'admin.seo.contentStatus.invalidOutput',
  Placeholder: 'admin.seo.contentStatus.placeholder',
};

export function isPublishableContent(status: SeoContentStatus): boolean {
  return status === 'Generated' || status === 'Manual';
}

export function isAiWrittenContent(status: SeoContentStatus): boolean {
  return status === 'Generated';
}

export function contentStatusKey(status: SeoContentStatus, published: boolean): string {
  if (status === 'Generated') {
    return published ? 'admin.seo.contentStatus.generatedPublished' : 'admin.seo.contentStatus.generated';
  }
  if (status === 'Manual') {
    return published ? 'admin.seo.contentStatus.manualPublished' : 'admin.seo.contentStatus.manual';
  }
  return NOT_GENERATED_KEY[status];
}
