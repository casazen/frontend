import { useTranslation } from 'react-i18next';
import { useState, useMemo } from 'react';
import { useCampaigns, useCampaignReport } from '@/queries/campaigns';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Alert } from '@/components/ui/alert';
import { AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import type { CampaignStatus } from '@/types/campaign.types';

export function CampaignsPage() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'all'>('all');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  const { data: campaigns, isLoading, error } = useCampaigns();
  const { data: reportData } = useCampaignReport(selectedCampaignId || '');

  const filteredCampaigns = useMemo(() => {
    if (!campaigns) return [];

    if (statusFilter === 'all') return campaigns;

    return campaigns.filter((c) => c.status === statusFilter);
  }, [campaigns, statusFilter]);

  const getStatusBadgeClass = (status: CampaignStatus) => {
    switch (status) {
      case 'Draft':
        return 'bg-muted text-foreground';
      case 'PendingApproval':
        return 'bg-warning-soft text-warning-foreground';
      case 'Approved':
        return 'bg-success-soft text-success-foreground';
      case 'Scheduled':
        return 'bg-info-soft text-info-foreground';
      case 'Sending':
        return 'bg-info-soft text-info-foreground';
      case 'Sent':
        return 'bg-success-soft text-success-foreground';
      case 'Failed':
        return 'bg-danger-soft text-danger-foreground';
      default:
        return 'bg-muted text-foreground';
    }
  };

  if (isLoading) {
    return <LoadingScreen message={t('campaigns.loading')} />;
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="danger" title={t('shared.error')} icon={AlertCircle}>
          {t('campaigns.loadError')}
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold">{t('campaigns.title')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('campaigns.description')}
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          {t('campaigns.create')}
        </Button>
      </div>

      <div className="mb-6">
        <label htmlFor="status-filter" className="text-sm font-medium mb-2 block">
          {t('campaigns.filter.status')}
        </label>
        <Select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CampaignStatus | 'all')}
          className="w-full sm:w-64"
        >
          <option value="all">{t('campaigns.filter.allStatuses')}</option>
          <option value="Draft">{t('campaigns.status.draft')}</option>
          <option value="PendingApproval">{t('campaigns.status.pendingApproval')}</option>
          <option value="Approved">{t('campaigns.status.approved')}</option>
          <option value="Scheduled">{t('campaigns.status.scheduled')}</option>
          <option value="Sending">{t('campaigns.status.sending')}</option>
          <option value="Sent">{t('campaigns.status.sent')}</option>
          <option value="Failed">{t('campaigns.status.failed')}</option>
        </Select>
      </div>

      {filteredCampaigns.length === 0 ? (
        <Alert variant="info" title={t('campaigns.emptyTitle')} icon={AlertCircle}>
          {campaigns && campaigns.length > 0
            ? t('campaigns.emptyFiltered')
            : t('campaigns.emptyList')}
        </Alert>
      ) : (
        <div className="space-y-4">
          {filteredCampaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="rounded-xl border bg-card p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 basis-64">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{campaign.subject}</h3>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(
                        campaign.status
                      )}`}
                    >
                      {t(`campaigns.status.${campaign.status.toLowerCase()}`)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('campaigns.segment')}: {campaign.segmentName}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('campaigns.createdAt', {
                      date: new Date(campaign.createdAt).toLocaleDateString(),
                    })}
                  </p>
                  {campaign.scheduledAt && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('campaigns.scheduledAt', {
                        date: new Date(campaign.scheduledAt).toLocaleString(),
                      })}
                    </p>
                  )}
                  {campaign.sentAt && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('campaigns.sentAt', {
                        date: new Date(campaign.sentAt).toLocaleString(),
                      })}
                    </p>
                  )}
                  {selectedCampaignId === campaign.id && reportData && (
                    <div className="mt-3 p-3 bg-muted rounded-md">
                      <h4 className="font-medium text-sm mb-2">{t('campaigns.report.title')}</h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">{t('campaigns.report.sent')}: </span>
                          <span className="font-medium">{reportData.sent}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('campaigns.report.errors')}: </span>
                          <span className="font-medium text-danger-foreground">{reportData.errors}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            {t('campaigns.report.unsubscribes')}:{' '}
                          </span>
                          <span className="font-medium">{reportData.unsubscribes}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {(campaign.status === 'Sent' || campaign.status === 'Failed') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setSelectedCampaignId(
                          selectedCampaignId === campaign.id ? null : campaign.id
                        )
                      }
                    >
                      {selectedCampaignId === campaign.id
                        ? t('campaigns.report.hide')
                        : t('campaigns.report.view')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
