import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Integration, IntegrationStatus } from '../lib/use-integrations';

const STATUS_VARIANT: Record<Exclude<IntegrationStatus, 'loading' | 'unknown'>, NonNullable<BadgeProps['variant']>> = {
  active: 'success',
  pending: 'warning',
  inactive: 'outline',
};

/**
 * An integration CasaZen has today (Altre integrazioni, Le mie app): its name and what it is for, whether it is on, and the button
 * that leads to the page where it is set up. Which of the lines to show is the page's: `detail` says how it stands when it is on.
 */
export function IntegrationCard({ integration }: { integration: Integration }) {
  const { t } = useTranslation();
  const { id, icon: Icon, href, status, count } = integration;
  const key = `marketplace.integrations.items.${id}`;
  const on = status === 'active';

  return (
    <li className="flex h-full min-w-0 flex-col gap-3 rounded-lg border bg-card p-4" data-testid={`marketplace-integration-${id}`}>
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-text">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="break-words font-medium">{t(`${key}.title`)}</h3>
            {status !== 'loading' && status !== 'unknown' ? (
              <Badge variant={STATUS_VARIANT[status]} data-testid={`marketplace-integration-${id}-status`}>
                {t(`marketplace.integrations.status.${status}`)}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-foreground/70">{t(`${key}.summary`)}</p>
          {on ? <p className="text-sm font-medium">{t(`${key}.detail`, { count: count ?? 0 })}</p> : null}
        </div>
      </div>
      <Button asChild variant={on ? 'outline' : 'default'} size="sm" className="mt-auto self-start">
        <Link to={href}>{on ? t('marketplace.integrations.manage') : t('marketplace.integrations.activate')}</Link>
      </Button>
    </li>
  );
}
