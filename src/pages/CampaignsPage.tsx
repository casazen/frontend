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
        return 'bg-gray-100 text-gray-800';
      case 'PendingApproval':
        return 'bg-yellow-100 text-yellow-800';
      case 'Approved':
        return 'bg-green-100 text-green-800';
      case 'Scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'Sending':
        return 'bg-indigo-100 text-indigo-800';
      case 'Sent':
        return 'bg-green-100 text-green-800';
      case 'Failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
      <div className="mb-8 flex justify-between items-center">
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
              className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
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
                          <span className="font-medium text-red-600">{reportData.errors}</span>
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
