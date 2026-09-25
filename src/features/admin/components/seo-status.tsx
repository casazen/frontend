import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type { SeoPageAdmin } from '@/types/seo.types';
import { contentStatusKey, isPublishableContent } from './seo-review-helpers';

/** Publication state of a page: what the public sees, and whether a newer text waits for a review. */
export function SeoPublicationBadge({ page }: { page: Pick<SeoPageAdmin, 'id' | 'isPublished' | 'hasPendingRevision'> }) {
  const { t } = useTranslation();
  if (!page.isPublished) {
    return (
      <Badge variant="secondary" data-testid={`seo-publication-${page.id}`}>
        {t('admin.seo.publication.notPublished')}
      </Badge>
    );
  }
  return page.hasPendingRevision ? (
    <Badge variant="warning" data-testid={`seo-publication-${page.id}`}>
      {t('admin.seo.publication.publishedWithPending')}
    </Badge>
  ) : (
    <Badge variant="success" data-testid={`seo-publication-${page.id}`}>
      {t('admin.seo.publication.published')}
    </Badge>
  );
}

/** State of the latest revision of a page, with the explicit "content not generated" reason. */
export function SeoLatestRevisionStatus({ page }: { page: SeoPageAdmin }) {
  const { t } = useTranslation();
  const latest = page.latestRevision;
  if (!latest) {
    return <span className="text-muted-foreground">{t('admin.seo.contentStatus.none')}</span>;
  }
  const published = latest.id === page.publishedRevisionId;
  return (
    <span
      className={isPublishableContent(latest.contentStatus) ? undefined : 'text-destructive'}
      data-testid={`seo-content-status-${page.id}`}
    >
      {t(contentStatusKey(latest.contentStatus, published))}
    </span>
  );
}
