import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarClock, ChevronDown, MailOpen, MousePointerClick, Send, UserMinus, UsersRound } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useCampaignReport, useScheduleCampaign, useSubmitForApproval } from '@/queries/campaigns';
import type { Campaign } from '@/types/campaign.types';
import { marketingErrorText } from './marketing-error';

type Status = Campaign['status'];

const PIPELINE = ['draft', 'approval', 'approved', 'scheduled', 'sent'] as const;
const STATUS_INDEX: Record<Status, number> = { Draft: 0, PendingApproval: 1, Approved: 2, Scheduled: 3, Sending: 3, Failed: 3, Sent: 4 };

const pad = (value: number) => String(value).padStart(2, '0');
const toLocalInput = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

function tomorrowMorning(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return date;
}

function saturdayMorning(): Date {
  const date = new Date();
  date.setDate(date.getDate() + ((6 - date.getDay() + 7) % 7 || 7));
  date.setHours(10, 0, 0, 0);
  return date;
}

function stepState(index: number, current: number): 'done' | 'current' | 'todo' {
  if (index < current) return 'done';
  return index === current ? 'current' : 'todo';
}

function Pipeline({ status }: { status: Status }) {
  const { t } = useTranslation();
  const current = STATUS_INDEX[status];
  return (
    <ol aria-label={t('marketingHub.campaigns.pipelineLabel')} className="flex gap-1.5" data-testid="campaign-pipeline">
      {PIPELINE.map((step, index) => {
        const state = stepState(index, current);
        return (
          <li key={step} aria-current={state === 'current' ? 'step' : undefined} className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span
              aria-hidden="true"
              className={cn('h-1.5 rounded-full', state === 'todo' ? 'bg-muted' : status === 'Failed' && state === 'current' ? 'bg-danger-foreground' : 'bg-primary')}
            />
            <span className={cn('truncate text-xs max-sm:sr-only', state === 'current' ? 'font-semibold text-foreground' : 'text-foreground/70')}>
              {t(`marketingHub.pipeline.${step}`)}
              <span className="sr-only">{` (${t(`marketingHub.pipeline.${state}`)})`}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function SchedulePicker({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation();
  const schedule = useScheduleCampaign();
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);
  const inputId = `schedule-${campaignId}`;
  const quick = [
    { id: 'tomorrow', label: t('marketingHub.campaigns.schedule.tomorrow'), at: tomorrowMorning },
    { id: 'saturday', label: t('marketingHub.campaigns.schedule.saturday'), at: saturdayMorning },
  ];

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const instant = new Date(value);
        if (!(instant.getTime() > Date.now())) {
          setInvalid(true);
          return;
        }
        schedule.mutate({ campaignId, scheduledAt: instant.toISOString() });
      }}
    >
      <div className="flex flex-wrap gap-2">
        {quick.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              setValue(toLocalInput(option.at()));
              setInvalid(false);
            }}
            className="min-h-9 rounded-full bg-card px-3.5 text-sm font-medium ring-1 ring-inset ring-border hover:bg-muted pointer-coarse:min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={inputId}>{t('campaigns.editor.schedule')}</Label>
          <Input
            id={inputId}
            type="datetime-local"
            required
            aria-invalid={invalid || undefined}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setInvalid(false);
            }}
          />
        </div>
        <Button type="submit" disabled={schedule.isPending || !value}>
          <CalendarClock aria-hidden="true" className="size-4" />
          {t('campaigns.editor.scheduleButton')}
        </Button>
      </div>
      {invalid ? <p role="alert" className="text-sm text-danger-foreground">{t('marketingStudio.futureTime')}</p> : null}
      {schedule.isError ? <Alert variant="danger">{marketingErrorText(schedule.error, t)}</Alert> : null}
    </form>
  );
}

function Results({ campaign, open }: { campaign: Campaign; open: boolean }) {
  const { t } = useTranslation();
  const report = useCampaignReport(open && campaign.status === 'Sent' ? campaign.id : '');
  if (!report.data) return null;
  const data = report.data;
  const rate = (count: number) => (data.sentCount > 0 ? `${Math.round((count / data.sentCount) * 100)}%` : '—');
  const tiles = [
    { id: 'sent', icon: Send, value: String(data.sentCount) },
    { id: 'opened', icon: MailOpen, value: rate(data.openedCount) },
    { id: 'clicked', icon: MousePointerClick, value: rate(data.clickedCount) },
    { id: 'unsubscribed', icon: UserMinus, value: String(data.unsubscribeCount) },
  ] as const;
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="campaign-results">
      {tiles.map((tile) => (
        <div key={tile.id} className="rounded-xl bg-muted/50 p-3">
          <dt className="flex items-center gap-1.5 text-xs text-foreground/70">
            <tile.icon aria-hidden="true" className="size-4 shrink-0" />
            {t(`marketingHub.campaigns.results.${tile.id}`)}
          </dt>
          <dd className="mt-1 text-xl font-bold tabular-nums">{tile.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const submit = useSubmitForApproval();
  const statusKey = campaign.status[0].toLowerCase() + campaign.status.slice(1);
  const dateText = (iso: string) => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso));

  return (
    <article className="min-w-0 space-y-4 rounded-2xl border bg-card p-4 sm:p-5" data-testid="campaign-card" data-status={campaign.status}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-1.5 text-sm text-foreground/70">
            <UsersRound aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 break-words">{campaign.segmentName}</span>
          </p>
          <h3 className="break-words text-base font-semibold leading-snug">{campaign.subject}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-sm font-medium">{t(`campaigns.status.${statusKey}`)}</span>
      </header>

      <Pipeline status={campaign.status} />

      <div className="space-y-3 rounded-xl bg-primary-soft/50 p-4" data-testid="campaign-next-step">
        <p className="font-medium">{t(`marketingHub.campaigns.next.${campaign.status}`, { date: campaign.scheduledAt ? dateText(campaign.scheduledAt) : '', sent: campaign.sentAt ? dateText(campaign.sentAt) : '' })}</p>
        {campaign.status === 'Draft' ? (
          <Button type="button" size="sm" loading={submit.isPending} onClick={() => submit.mutate({ campaignId: campaign.id })}>
            <Send aria-hidden="true" className="size-4" />
            {t('campaigns.editor.submitForApproval')}
          </Button>
        ) : null}
        {campaign.status === 'PendingApproval' ? (
          <Button asChild size="sm" variant="outline">
            <Link to="/app/short-rent/approval-queue">{t('marketingStudio.reviewQueue')}</Link>
          </Button>
        ) : null}
        {campaign.status === 'Approved' ? <SchedulePicker campaignId={campaign.id} /> : null}
      </div>

      <div>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md text-sm font-medium text-primary-text hover:underline pointer-coarse:min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown aria-hidden="true" className={cn('size-4 transition-transform', open && 'rotate-180')} />
          {t(open ? 'marketingHub.campaigns.hideText' : campaign.status === 'Sent' ? 'marketingHub.campaigns.showResults' : 'marketingHub.campaigns.showText')}
        </button>
        {open ? (
          <div className="mt-3 space-y-4">
            <p className="whitespace-pre-wrap break-words text-sm text-foreground/85">{campaign.body}</p>
            <Results campaign={campaign} open={open} />
          </div>
        ) : null}
      </div>
      {submit.isError ? <Alert variant="danger">{marketingErrorText(submit.error, t)}</Alert> : null}
    </article>
  );
}
