import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Copy, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSupplierShowcasePreview } from '@/queries/use-supplier';
import type { SupplierShowcasePreview } from '@/types/supplier';
import { SupplierShowcaseView } from './components/supplier-showcase-view';

/** Where the showcase is: public (with its address), not yet public (never activated) or withdrawn (suspended). */
function PublicationStatus({ preview }: { preview: SupplierShowcasePreview }) {
  const { t } = useTranslation();
  const [copying, setCopying] = useState(false);

  const copyLink = async () => {
    if (!preview.publicUrl) return;
    setCopying(true);
    try {
      await navigator.clipboard.writeText(preview.publicUrl);
      toast.success(t('supplier.showcase.linkCopied'));
    } catch {
      toast.error(t('supplier.showcase.linkCopyError'));
    } finally {
      setCopying(false);
    }
  };

  if (preview.published) {
    return (
      <Card className="border-green-300 bg-green-50" data-testid="supplier-showcase-published">
        <CardContent className="space-y-3 py-4">
          <p className="text-sm font-medium text-green-900">{t('supplier.showcase.published')}</p>
          {preview.publicUrl ? (
            <p className="break-all text-sm text-green-900" data-testid="supplier-showcase-url">
              {preview.publicUrl}
            </p>
          ) : (
            <p className="text-sm text-green-900" data-testid="supplier-showcase-no-base-url">
              {t('supplier.showcase.noPublicUrl')}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {preview.publicPath && (
              <Button asChild size="sm" variant="outline">
                <Link to={preview.publicPath} target="_blank" rel="noopener noreferrer" data-testid="supplier-showcase-open">
                  <ExternalLink className="mr-1 h-4 w-4" /> {t('supplier.showcase.open')}
                </Link>
              </Button>
            )}
            {preview.publicUrl && (
              <Button size="sm" variant="outline" disabled={copying} onClick={() => void copyLink()}>
                <Copy className="mr-1 h-4 w-4" /> {t('supplier.showcase.copyLink')}
              </Button>
            )}
          </div>
          <p className="text-xs text-green-900">{t('supplier.showcase.notIndexed')}</p>
        </CardContent>
      </Card>
    );
  }

  const suspended = preview.status === 'Suspended';
  return (
    <Card className="border-amber-300 bg-amber-50" role="status" data-testid="supplier-showcase-unpublished">
      <CardContent className="space-y-3 py-4">
        <p className="text-sm font-medium text-amber-900">
          {suspended ? t('supplier.showcase.suspended') : t('supplier.showcase.notPublished')}
        </p>
        {!suspended && (
          <Button asChild size="sm" variant="outline" className="border-amber-400 text-amber-900">
            <Link to="/app/supplier/activation">{t('supplier.goToActivation')}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** Preview of the public showcase (SU-13): exactly what visitors see, with where it is published. */
export function SupplierShowcasePreviewPage() {
  const { t } = useTranslation();
  const { data, isLoading, isError, error, refetch } = useSupplierShowcasePreview();

  const header = <PageHeader title={t('supplier.showcase.title')} description={t('supplier.showcase.description')} />;

  if (isError) {
    return (
      <div className="space-y-6">
        {header}
        <ErrorState
          testId="supplier-showcase-preview-error"
          title={t('supplier.showcase.loadError')}
          error={error}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  if (isLoading || !data) {
    return <LoadingScreen message={t('supplier.showcase.loading')} />;
  }

  return (
    <div className="space-y-6" data-testid="supplier-showcase-preview-page">
      {header}
      <PublicationStatus preview={data} />
      <SupplierShowcaseView showcase={data.showcase} />
    </div>
  );
}
