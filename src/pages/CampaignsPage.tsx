import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { CampaignEditor } from '@/components/campaigns/CampaignEditor';
import { MarketingSettingsForm } from '@/components/campaigns/MarketingSettingsForm';
import { CampaignAssets } from '@/components/campaigns/CampaignAssets';
import { MarketingError } from '@/components/campaigns/MarketingInputs';
import { useCampaignReport, useCampaigns, useSubmitForApproval, useScheduleCampaign } from '@/queries/campaigns';
import type { Campaign } from '@/types/campaign.types';

const sections = ['campaignList', 'compose', 'assets', 'settings'] as const;

export function CampaignsPage() {
  const { t } = useTranslation();
  const [section, setSection] = useState<(typeof sections)[number]>('campaignList');
  const campaigns = useCampaigns();
  return (
    <AppShell>
      <div className="workspace-page space-y-5">
        <PageHeader title={t('campaigns.title')} description={t('campaigns.description')} crumbs="auto" />
        <div className="flex flex-wrap gap-2" aria-label={t('campaigns.title')}>
          {sections.map((key) => (
            <Button
              key={key}
              variant={key === section ? 'default' : 'outline'}
              aria-pressed={key === section}
              onClick={() => setSection(key)}
            >
              {t('marketingStudio.' + key)}
            </Button>
          ))}
        </div>
        {section === 'campaignList' && (
          <section className="space-y-3">
            <MarketingError error={campaigns.error} />
            {campaigns.isLoading && <LoadingScreen />}
            {campaigns.data?.length === 0 && (
              <div className="rounded-xl border p-5">
                <h2 className="font-semibold">{t('campaigns.emptyTitle')}</h2>
                <p>{t('campaigns.emptyList')}</p>
              </div>
            )}
            {campaigns.data?.map((c) => (
              <CampaignCard key={c.id} campaign={c} />
            ))}
          </section>
        )}
        {section === 'compose' && <CampaignEditor onSaved={() => setSection('campaignList')} />}
        {section === 'assets' && <CampaignAssets />}
        {section === 'settings' && (
          <>
            <MarketingSettingsForm />
            <details className="rounded-xl border bg-card p-4">
              <summary className="cursor-pointer font-semibold">{t('marketingStudio.visibility')}</summary>
              <ol className="mt-3 list-decimal space-y-2 pl-5">
                {['googlePartner', 'googleInventory', 'siteVisibility'].map((key) => (
                  <li key={key}>{t('marketingStudio.' + key)}</li>
                ))}
              </ol>
              <Link className="mt-3 block text-primary underline" to="/app/short-rent/vetrina">
                {t('marketingStudio.storefront')}
              </Link>
            </details>
          </>
        )}
      </div>
    </AppShell>
  );
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const submit = useSubmitForApproval();
  const schedule = useScheduleCampaign();
  const report = useCampaignReport(open && campaign.status === 'Sent' ? campaign.id : '');
  const statusKey = campaign.status[0].toLowerCase() + campaign.status.slice(1);
  return (
    <article className="rounded-xl border bg-card p-4">
      <button
        type="button"
        className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span>
          <span className="block text-sm text-muted-foreground">{campaign.segmentName}</span>
          <strong>{campaign.subject}</strong>
        </span>
        <span className="rounded-full bg-muted px-3 py-1 text-sm">{t('campaigns.status.' + statusKey)}</span>
      </button>
      {open && (
        <div className="mt-4 space-y-3">
          <p className="whitespace-pre-wrap">{campaign.body}</p>
          {campaign.status === 'Draft' && (
            <Button disabled={submit.isPending} onClick={() => submit.mutate({ campaignId: campaign.id })}>
              {t('campaigns.editor.submitForApproval')}
            </Button>
          )}
          {campaign.status === 'PendingApproval' && (
            <Link className="text-primary underline" to="/app/short-rent/approval-queue">
              {t('marketingStudio.reviewQueue')}
            </Link>
          )}
          {campaign.status === 'Approved' && (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const instant = new Date(date);
                if (instant.getTime() > Date.now())
                  schedule.mutate({ campaignId: campaign.id, scheduledAt: instant.toISOString() });
              }}
            >
              <label>
                {t('campaigns.editor.schedule')}
                <Input type="datetime-local" required value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <Button type="submit" disabled={schedule.isPending || !(new Date(date).getTime() > Date.now())}>
                {t('campaigns.editor.scheduleButton')}
              </Button>
            </form>
          )}
          {campaign.scheduledAt && (
            <p>{t('campaigns.scheduledAt', { date: new Date(campaign.scheduledAt).toLocaleString() })}</p>
          )}
          {campaign.sentAt && <p>{t('campaigns.sentAt', { date: new Date(campaign.sentAt).toLocaleString() })}</p>}
          {report.data && (
            <dl className="grid gap-3 sm:grid-cols-3">
              {(
                ['sentCount', 'errorCount', 'unsubscribeCount', 'openedCount', 'clickedCount', 'bouncedCount'] as const
              ).map((key, i) => (
                <div key={key}>
                  <dt>
                    {t('campaigns.report.' + ['sent', 'errors', 'unsubscribes', 'opened', 'clicked', 'bounced'][i])}
                  </dt>
                  <dd>{report.data[key]}</dd>
                </div>
              ))}
            </dl>
          )}
          <MarketingError error={submit.error ?? schedule.error ?? report.error} />
        </div>
      )}
    </article>
  );
}
