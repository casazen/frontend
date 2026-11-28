import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ChevronDown, Mail, Megaphone, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { ApiClient } from '@/api/client';
import { assetQueryKey, saveAssetDraft, type GeneratedContent } from '@/api/marketing-studio.api';
import { Button } from '@/components/ui/button';
import { eventDateText } from '@/features/marketing/event-date';
import { ToneTile } from '@/features/marketing/tone-tile';
import { cn } from '@/lib/utils';
import { MarketingError } from './MarketingInputs';

const assets = '/campaigns/studio/assets';

export function CampaignAssets() {
  const { t } = useTranslation();
  const list = useQuery({ queryKey: assetQueryKey, queryFn: () => ApiClient.get<GeneratedContent[]>(assets) });
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{t('marketingStudio.assets')}</h2>
      <MarketingError error={list.error} />
      {list.isLoading && <p role="status">{t('campaigns.loading')}</p>}
      {list.data?.length === 0 && <p>{t('marketingStudio.emptyAssets')}</p>}
      {list.data?.map((item) => (
        <Asset key={item.id} item={item} />
      ))}
    </section>
  );
}

function Asset({ item }: { item: GeneratedContent }) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const [showResults, setResults] = useState(false);
  const [open, setOpen] = useState(false);
  const refresh = () => client.invalidateQueries({ queryKey: assetQueryKey });
  const approve = useMutation({
    mutationFn: () => ApiClient.post<GeneratedContent>(assets + '/' + item.id + '/approve', {}),
    onSuccess: refresh,
  });
  const dismiss = useMutation({
    mutationFn: () => ApiClient.post<void>(assets + '/' + item.id + '/dismiss', {}),
    onSuccess: refresh,
  });
  const draft = useMutation({
    mutationFn: () => saveAssetDraft(item),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success(t('campaigns.draft.created'));
    },
  });
  const report = useQuery({
    queryKey: ['marketing-asset-results', item.id],
    enabled: showResults,
    queryFn: () =>
      ApiClient.get<{
        clicks: number;
        bookings: number;
        revenueByCurrency: { currency: string; revenue: number }[];
        externalDestination: boolean;
      }>(assets + '/' + item.id + '/results'),
  });
  const email = item.channel === 'email' || item.channel === 'newsletter';
  const copy = useMutation({
    mutationFn: () =>
      navigator.clipboard.writeText(
        [item.subject, item.body, item.keywords, item.audience, item.budget, item.trackingUrl]
          .filter(Boolean)
          .join('\n\n'),
      ),
    onSuccess: () => toast.success(t('marketingStudio.copied')),
  });
  const ChannelIcon = email ? Mail : item.channel.endsWith('-ads') ? Megaphone : Share2;
  return (
    <article className="rounded-2xl border bg-card p-4 sm:p-5">
      <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <ToneTile icon={ChannelIcon} tone={email ? 'neutral' : 'info'} />
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="block text-xs font-semibold uppercase tracking-wide text-foreground/70">{t('marketingStudio.channels.' + item.channel)}</span>
          <span className="block break-words font-semibold leading-snug">{item.subject}</span>
          {item.sourceEvent ? (
            <span className="flex items-center gap-1.5 pt-0.5 text-sm text-foreground/75">
              <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
              <span className="min-w-0 break-words">
                {item.sourceEvent.name} · {eventDateText(item.sourceEvent.date, i18n.language)}
              </span>
            </span>
          ) : null}
        </span>
        <ChevronDown aria-hidden="true" className={cn('mt-1 size-5 shrink-0 text-foreground/60 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="whitespace-pre-wrap">{item.body}</p>
          {item.sourceEvent && (
            <div>
              <strong>{item.sourceEvent.name}</strong> &middot; {item.sourceEvent.date}
              <p>{item.sourceEvent.description}</p>
              {item.sourceEvent.confidence && (
                <p>
                  {t('marketingStudio.confidence')} {item.sourceEvent.confidence}
                </p>
              )}
              {/^https?:\/\//i.test(item.sourceEvent.source) && (
                <a className="text-primary underline" href={item.sourceEvent.source} target="_blank" rel="noreferrer">
                  {t('marketingStudio.eventSource')}
                </a>
              )}
            </div>
          )}
          {(['keywords', 'audience', 'budget'] as const).map(
            (key) =>
              item[key] && (
                <p key={key}>
                  <strong>{t('marketingStudio.' + key)}</strong> {item[key]}
                </p>
              ),
          )}
          <div className="flex flex-wrap gap-2">
            {email ? (
              <Button disabled={draft.isPending || draft.isSuccess} onClick={() => draft.mutate()}>
                {t('campaigns.editor.saveDraft')}
              </Button>
            ) : item.approvedAt ? (
              <Button onClick={() => copy.mutate()}>{t('marketingStudio.copy')}</Button>
            ) : (
              <Button disabled={approve.isPending} onClick={() => approve.mutate()}>
                {t('marketingStudio.approve')}
              </Button>
            )}
            <Button variant="outline" onClick={() => setResults(!showResults)}>
              {t(showResults ? 'campaigns.report.hide' : 'campaigns.report.view')}
            </Button>
          </div>
          {!item.approvedAt && !item.campaignId && (
            <Button variant="ghost" disabled={dismiss.isPending} onClick={() => dismiss.mutate()}>
              {t('marketingStudio.dismiss')}
            </Button>
          )}
          <MarketingError error={dismiss.error ?? approve.error ?? draft.error ?? copy.error ?? report.error} />
          {showResults && report.data && (
            <dl className="grid grid-cols-3 gap-2">
              {(['clicks', 'bookings'] as const)
                .filter((key) => !report.data.externalDestination || key === 'clicks')
                .map((key) => (
                  <div key={key}>
                    <dt>{t('marketingStudio.' + key)}</dt>
                    <dd>{report.data[key]}</dd>
                  </div>
                ))}
              {!report.data.externalDestination &&
                report.data.revenueByCurrency.map((row) => (
                  <div key={row.currency}>
                    <dt>{t('marketingStudio.revenue')}</dt>
                    <dd>
                      {row.revenue} {row.currency}
                    </dd>
                  </div>
                ))}
            </dl>
          )}
        </div>
      )}
    </article>
  );
}
