import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import {
  useSegments,
  useCreateDraft,
  useSubmitForApproval,
  useScheduleCampaign,
  usePreviewCount,
  useGenerateContent,
} from '@/queries/campaigns';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Alert } from '@/components/ui/alert';
import { AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { Campaign } from '@/types/campaign.types';

interface CampaignEditorProps {
  campaign?: Campaign;
  onSaved?: (campaign: Campaign) => void;
}

export function CampaignEditor({ campaign, onSaved }: CampaignEditorProps) {
  const { t } = useTranslation();
  const [segmentId, setSegmentId] = useState(campaign?.segmentId || '');
  const [subject, setSubject] = useState(campaign?.subject || '');
  const [body, setBody] = useState(campaign?.body || '');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  const { data: segments, isLoading: segmentsLoading } = useSegments();
  const { data: previewData } = usePreviewCount(segmentId, !!segmentId);
  const createDraft = useCreateDraft();
  const submitForApproval = useSubmitForApproval();
  const scheduleCampaign = useScheduleCampaign();
  const generateContent = useGenerateContent();

  const handleGenerateContent = async () => {
    if (!segmentId) return;

    const result = await generateContent.mutateAsync({ segmentId });
    if (result) {
      setSubject(result.subject);
      setBody(result.body);
    }
  };

  const handleSaveDraft = async () => {
    if (!segmentId || !subject || !body) return;

    const result = await createDraft.mutateAsync({
      segmentId,
      subject,
      body,
    });

    if (result && onSaved) {
      onSaved(result);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!campaign?.id) return;

    const result = await submitForApproval.mutateAsync({
      campaignId: campaign.id,
    });

    if (result && onSaved) {
      onSaved(result);
    }
  };

  const handleSchedule = async () => {
    if (!campaign?.id || !scheduledDate || !scheduledTime) return;

    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
    const result = await scheduleCampaign.mutateAsync({
      campaignId: campaign.id,
      scheduledAt,
    });

    if (result && onSaved) {
      onSaved(result);
    }
  };

  if (segmentsLoading) {
    return <LoadingScreen message={t('campaigns.segment.loading')} />;
  }

  if (!segments || segments.length === 0) {
    return (
      <Alert variant="info" title={t('campaigns.editor.noSegments')} icon={AlertCircle}>
        {t('campaigns.editor.noSegmentsMessage')}
      </Alert>
    );
  }

  const canSaveDraft = segmentId && subject && body;
  const canSubmitForApproval = campaign?.status === 'Draft';
  const canSchedule = campaign?.status === 'Approved' && scheduledDate && scheduledTime;

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="segment" className="text-sm font-medium mb-2 block">
          {t('campaigns.editor.segment')}
        </label>
        <Select
          id="segment"
          value={segmentId}
          onChange={(e) => setSegmentId(e.target.value)}
          disabled={!!campaign}
        >
          <option value="">{t('campaigns.editor.selectSegment')}</option>
          {segments.map((segment) => (
            <option key={segment.id} value={segment.id}>
              {segment.name}
            </option>
          ))}
        </Select>
        {previewData && (
          <p className="text-sm text-muted-foreground mt-2">
            {t('campaigns.editor.recipients', { count: previewData.count })}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="subject" className="text-sm font-medium mb-2 block">
          {t('campaigns.editor.subject')}
        </label>
        <Input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t('campaigns.editor.subjectPlaceholder')}
          disabled={!!campaign && campaign.status !== 'Draft'}
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <label htmlFor="body" className="text-sm font-medium">
            {t('campaigns.editor.body')}
          </label>
          {segmentId && (!campaign || campaign.status === 'Draft') && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateContent}
              disabled={generateContent.isPending}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {generateContent.isPending
                ? t('campaigns.editor.generating')
                : t('campaigns.editor.generate')}
            </Button>
          )}
        </div>
        <textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t('campaigns.editor.bodyPlaceholder')}
          disabled={!!campaign && campaign.status !== 'Draft'}
          className="w-full min-h-[200px] px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {campaign?.status === 'Approved' && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4">{t('campaigns.editor.schedule')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="scheduled-date" className="text-sm font-medium mb-2 block">
                {t('campaigns.editor.date')}
              </label>
              <Input
                id="scheduled-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="scheduled-time" className="text-sm font-medium mb-2 block">
                {t('campaigns.editor.time')}
              </label>
              <Input
                id="scheduled-time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {!campaign && (
          <Button
            onClick={handleSaveDraft}
            disabled={!canSaveDraft || createDraft.isPending}
          >
            {createDraft.isPending ? t('shared.saving') : t('campaigns.editor.saveDraft')}
          </Button>
        )}
        {canSubmitForApproval && (
          <Button
            onClick={handleSubmitForApproval}
            disabled={submitForApproval.isPending}
          >
            {submitForApproval.isPending
              ? t('shared.submitting')
              : t('campaigns.editor.submitForApproval')}
          </Button>
        )}
        {canSchedule && (
          <Button
            onClick={handleSchedule}
            disabled={!canSchedule || scheduleCampaign.isPending}
          >
            {scheduleCampaign.isPending ? t('shared.scheduling') : t('campaigns.editor.scheduleButton')}
          </Button>
        )}
      </div>
    </div>
  );
}
