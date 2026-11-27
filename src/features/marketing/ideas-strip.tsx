import { CalendarDays, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assetQueryKey, dismissAsset, type GeneratedContent } from '@/api/marketing-studio.api';
import { Button } from '@/components/ui/button';
import { useMarketingAssets } from '@/queries/marketing-assets';
import { eventDateText } from './event-date';

const IDEAS_SHOWN = 2;

const isEmailIdea = (asset: GeneratedContent) =>
  (asset.channel === 'email' || asset.channel === 'newsletter') && !asset.campaignId && !asset.approvedAt;

interface IdeasStripProps {
  onUse: (idea: GeneratedContent) => void;
  onSeeAll: () => void;
}

export function IdeasStrip({ onUse, onSeeAll }: IdeasStripProps) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const assets = useMarketingAssets();
  const ideas = (assets.data ?? []).filter(isEmailIdea);

  const dismiss = useMutation({
    mutationFn: dismissAsset,
    onSuccess: () => client.invalidateQueries({ queryKey: assetQueryKey }),
  });

  if (ideas.length === 0) return null;

  return (
    <section aria-labelledby="ideas-title" className="space-y-3" data-testid="campaign-ideas">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ideas-title" className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles aria-hidden="true" className="size-5 text-primary-text" />
          {t('marketingHub.ideas.title')}
        </h2>
        {ideas.length > IDEAS_SHOWN ? (
          <Button type="button" variant="link" className="h-auto p-0" onClick={onSeeAll}>
            {t('marketingHub.ideas.seeAll', { count: ideas.length })}
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {ideas.slice(0, IDEAS_SHOWN).map((idea) => (
          <article key={idea.id} className="flex min-w-0 flex-col gap-3 rounded-2xl bg-primary-soft/60 p-4 ring-1 ring-inset ring-border sm:p-5" data-testid="campaign-idea">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-text">
              {idea.sourceEvent ? t('marketingHub.ideas.eventKicker') : t('marketingHub.ideas.kicker')}
            </p>
            <h3 className="break-words text-base font-semibold leading-snug">{idea.subject}</h3>
            {idea.sourceEvent ? (
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
                <span className="min-w-0 break-words">
                  {idea.sourceEvent.name} · {eventDateText(idea.sourceEvent.date, i18n.language)}
                </span>
              </p>
            ) : null}
            <p className="line-clamp-3 text-sm text-foreground/75">{idea.body}</p>
            <div className="mt-auto flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => onUse(idea)}>
                {t('marketingHub.ideas.use')}
              </Button>
              <Button type="button" size="sm" variant="ghost" disabled={dismiss.isPending} onClick={() => dismiss.mutate(idea.id)}>
                {t('marketingHub.ideas.dismiss')}
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
