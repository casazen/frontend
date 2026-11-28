import { useId, type HTMLAttributes, type ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, CircleDashed, Info, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { STATUS_TONE_CLASSES } from '@/components/shared/status/status-view';
import type { StatusTone } from '@/lib/status-dictionary';
import { cn } from '@/lib/utils';

const TILE_TONE = {
  neutral: 'bg-primary-soft text-primary-text',
  success: 'bg-success-soft text-success-foreground',
  warning: 'bg-warning-soft text-warning-foreground',
} as const;

const CHIP_ICON: Record<StatusTone, LucideIcon> = {
  neutral: CircleDashed,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
};

export function IconTile({ icon: Icon, tone = 'neutral', className }: { icon: LucideIcon; tone?: keyof typeof TILE_TONE; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('cz-icon-tile [--cz-icon-tile-size:2.25rem] [--cz-icon-size:1.125rem]', TILE_TONE[tone], className)}>
      <Icon strokeWidth={1.75} />
    </span>
  );
}

interface StateChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone: StatusTone;
  icon?: LucideIcon;
}

export function StateChip({ tone, icon, className, children, ...props }: StateChipProps) {
  const Icon = icon ?? CHIP_ICON[tone];
  return (
    <span {...props} data-tone={tone} className={cn('inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', STATUS_TONE_CLASSES[tone], className)}>
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="min-w-0 break-words">{children}</span>
    </span>
  );
}

interface OwnerCardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  icon: LucideIcon;
  title: string;
  chip?: ReactNode;
  action?: ReactNode;
  help?: ReactNode;
  headingLevel?: 'h2' | 'h3';
}

export function OwnerCard({ icon, title, chip, action, help, headingLevel: Heading = 'h2', className, children, ...props }: OwnerCardProps) {
  const titleId = useId();
  return (
    <section {...props} aria-labelledby={titleId} className={cn('@container min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5', className)}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <IconTile icon={icon} />
        <div className="flex min-w-0 flex-[1_1_10rem] items-center gap-1">
          <Heading id={titleId} className="min-w-0 break-words text-base font-semibold">
            {title}
          </Heading>
          {help}
        </div>
        {chip}
        {action}
      </header>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function PanelGrid({ children }: { children: ReactNode }) {
  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-2 @4xl:items-start">{children}</div>
    </div>
  );
}

const FACT_COLUMNS = { 2: '@md:grid-cols-2', 3: '@md:grid-cols-2 @2xl:grid-cols-3' } as const;

export function FactGrid({ columns = 2, children, className, ...props }: HTMLAttributes<HTMLDListElement> & { columns?: keyof typeof FACT_COLUMNS }) {
  return (
    <dl {...props} className={cn('grid grid-cols-1 gap-x-8 gap-y-4', FACT_COLUMNS[columns], className)}>
      {children}
    </dl>
  );
}

interface FactProps {
  label: string;
  value: ReactNode;
  testId?: string;
  wide?: boolean;
  required?: boolean;
}

export function Fact({ label, value, testId, wide, required }: FactProps) {
  const { t } = useTranslation();
  const blank = value === null || value === undefined || value === '' || value === false;
  return (
    <div className={cn('min-w-0', wide && '@md:col-span-2')}>
      <dt className="text-sm text-foreground/70">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium" data-testid={testId}>
        {blank ? (
          required ? (
            <span className="text-warning-foreground">{t('ownerProfile.facts.missing')}</span>
          ) : (
            <span className="font-normal text-foreground/60">{t('ownerProfile.facts.empty')}</span>
          )
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

const METRIC_COLUMNS = { 1: '', 2: '@sm:grid-cols-2', 3: '@sm:grid-cols-3', 4: '@sm:grid-cols-4' } as const;

export function MetricRow({ columns, children, ...props }: HTMLAttributes<HTMLDListElement> & { columns: keyof typeof METRIC_COLUMNS }) {
  return (
    <dl {...props} className={cn('grid grid-cols-1 divide-y divide-border rounded-lg border border-border @sm:grid-rows-[auto_auto_auto] @sm:divide-x @sm:divide-y-0', METRIC_COLUMNS[columns])}>
      {children}
    </dl>
  );
}

interface MetricProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  detail?: string;
  testId?: string;
}

export function Metric({ icon: Icon, label, value, detail, testId }: MetricProps) {
  return (
    <div className="min-w-0 px-4 py-3 @sm:row-span-3 @sm:grid @sm:grid-rows-subgrid">
      <dt className="flex items-start gap-1.5 text-sm text-foreground/70">
        <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary-text" />
        <span className="min-w-0 break-words">{label}</span>
      </dt>
      <dd className="mt-1 break-words text-xl font-semibold tabular-nums tracking-tight" data-testid={testId}>
        {value}
      </dd>
      {detail ? <dd className="mt-0.5 break-words text-sm text-foreground/70">{detail}</dd> : null}
    </div>
  );
}

export function QuietNote({ icon: Icon, children, className, ...props }: HTMLAttributes<HTMLParagraphElement> & { icon: LucideIcon }) {
  return (
    <p {...props} className={cn('flex items-start gap-2 text-sm text-foreground/70', className)}>
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}
