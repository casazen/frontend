import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useSegments, useCreateSegment, usePreviewCount } from '@/queries/campaigns';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Alert } from '@/components/ui/alert';
import { AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ConditionDefinition } from '@/types/campaign.types';

export function SegmentsPage() {
  const { t } = useTranslation();
  const [isCreating, setIsCreating] = useState(false);
  const [newSegmentName, setNewSegmentName] = useState('');
  const [conditionDefinition, setConditionDefinition] = useState<ConditionDefinition>({
    version: 1,
    groups: [{ operator: 'AND', conditions: [] }],
  });
  const [previewSegmentId, setPreviewSegmentId] = useState<string | null>(null);

  const { data: segments, isLoading, error } = useSegments();
  const createSegment = useCreateSegment();
  const { data: previewData } = usePreviewCount(previewSegmentId || '', !!previewSegmentId);

  const handleCreateSegment = async () => {
    if (!newSegmentName.trim()) {
      return;
    }

    await createSegment.mutateAsync({
      name: newSegmentName,
      conditionDefinitionJson: JSON.stringify(conditionDefinition),
    });

    setNewSegmentName('');
    setConditionDefinition({
      version: 1,
      groups: [{ operator: 'AND', conditions: [] }],
    });
    setIsCreating(false);
  };

  if (isLoading) {
    return <LoadingScreen message={t('campaigns.segment.loading')} />;
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="danger" title={t('shared.error')} icon={AlertCircle}>
          {t('campaigns.segment.loadError')}
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{t('campaigns.segment.title')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('campaigns.segment.description')}
          </p>
        </div>
        {!isCreating && (
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {t('campaigns.segment.create')}
          </Button>
        )}
      </div>

      {isCreating && (
        <div className="mb-6 border rounded-lg p-4 bg-muted/50">
          <h3 className="text-lg font-semibold mb-4">{t('campaigns.segment.newSegment')}</h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="segment-name" className="text-sm font-medium mb-2 block">
                {t('campaigns.segment.name')}
              </label>
              <Input
                id="segment-name"
                value={newSegmentName}
                onChange={(e) => setNewSegmentName(e.target.value)}
                placeholder={t('campaigns.segment.namePlaceholder')}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCreateSegment}
                disabled={!newSegmentName.trim() || createSegment.isPending}
              >
                {createSegment.isPending ? t('shared.saving') : t('shared.save')}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreating(false);
                  setNewSegmentName('');
                  setConditionDefinition({
                    version: 1,
                    groups: [{ operator: 'AND', conditions: [] }],
                  });
                }}
              >
                {t('shared.cancel')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {!segments || segments.length === 0 ? (
        <Alert variant="info" title={t('campaigns.segment.emptyTitle')} icon={AlertCircle}>
          {t('campaigns.segment.emptyList')}
        </Alert>
      ) : (
        <div className="space-y-4">
          {segments.map((segment) => (
            <div
              key={segment.id}
              className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{segment.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('campaigns.segment.createdAt', {
                      date: new Date(segment.createdAt).toLocaleDateString(),
                    })}
                  </p>
                  {previewSegmentId === segment.id && previewData && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {t('campaigns.segment.previewCount', { count: previewData.count })}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPreviewSegmentId(previewSegmentId === segment.id ? null : segment.id)
                  }
                >
                  {previewSegmentId === segment.id
                    ? t('campaigns.segment.hidePreview')
                    : t('campaigns.segment.preview')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
