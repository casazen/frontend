import { useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { formatDate } from '@/lib/utils';
import type { SiteConnection } from '@/types/site-connection.types';
import { useRevokeSiteConnection, useSiteConnections } from './use-site-connections';

interface EmbedConnectedSitesProps {
  orgId: string;
}

/**
 * The sites connected to the agency account through the plugin for WordPress (PLG-FE-CONSOLE, NF-203), in one quiet block of «Incorpora nel tuo sito»: the address of each site, when it
 * was connected and when it was last used, with «Scollega» (after a confirmation) that revokes the connection. It is a list and not a dashboard: no counters, no filters. Nothing is
 * shown from an older read when the last one failed, and every «Scollega» is off while one is on its way, so a connection is revoked once. The confirmation sits outside any form.
 */
export function EmbedConnectedSites({ orgId }: EmbedConnectedSitesProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const revokedRef = useRef(false);
  const sites = useSiteConnections(orgId);
  const revoke = useRevokeSiteConnection(orgId);
  // The site the dialog asks about stays after the dialog has closed, so that its title does not change while it fades out.
  const [target, setTarget] = useState<SiteConnection | null>(null);
  const [asking, setAsking] = useState(false);

  const confirmRevoke = async () => {
    if (!target) return;
    try {
      await revoke.mutateAsync(target.id);
      revokedRef.current = true;
    } catch {
      // Told by the mutation (a toast); the row is still there and takes the focus back.
    }
  };

  let body: ReactNode;
  if (sites.isError) {
    body = (
      <Alert
        variant="danger"
        data-testid="embed-sites-error"
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => void sites.refetch()}>
            {t('embed.settings.retry')}
          </Button>
        }
      >
        {t('embed.settings.sites.loadError')}
      </Alert>
    );
  } else if (sites.data === undefined) {
    body = (
      <div data-testid="embed-sites-loading">
        <SkeletonLine lines={2} lineClassName="h-10" label={t('embed.settings.sites.loading')} />
      </div>
    );
  } else if (sites.data.length === 0) {
    body = (
      <p className="text-sm text-muted-foreground" data-testid="embed-sites-empty">
        {t('embed.settings.sites.empty')}
      </p>
    );
  } else {
    body = (
      <ul className="divide-y text-sm" data-testid="embed-sites-list">
        {sites.data.map((site) => (
          <li key={site.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3" data-testid="embed-site" data-site-id={site.id}>
            <div className="min-w-0">
              <p className="break-words font-medium" data-testid="embed-site-address">
                {site.siteUrl}
              </p>
              <p className="text-muted-foreground" data-testid="embed-site-dates">
                {t('embed.settings.sites.linked', { date: formatDate(site.createdAt) })}
                {' · '}
                {site.lastUsedAt ? t('embed.settings.sites.lastUsed', { date: formatDate(site.lastUsedAt) }) : t('embed.settings.sites.lastUsedNever')}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={revoke.isPending}
              aria-label={t('embed.settings.sites.revokeLabel', { site: site.siteUrl })}
              onClick={() => {
                setTarget(site);
                setAsking(true);
              }}
              data-testid="embed-site-revoke"
            >
              {t('embed.settings.sites.revoke')}
            </Button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="space-y-3" aria-labelledby={titleId} data-testid="embed-sites">
      <h2 id={titleId} ref={titleRef} tabIndex={-1} className="text-sm font-semibold focus:outline-none">
        {t('embed.settings.sites.title')}
      </h2>
      <p className="text-sm text-muted-foreground">{t('embed.settings.sites.description')}</p>
      {body}
      <ConfirmationDialog
        open={asking}
        onOpenChange={setAsking}
        title={t('embed.settings.sites.revokeConfirm.title', { site: target?.siteUrl ?? '' })}
        description={t('embed.settings.sites.revokeConfirm.description')}
        confirmLabel={t('embed.settings.sites.revokeConfirm.confirm')}
        variant="destructive"
        isLoading={revoke.isPending}
        onConfirm={confirmRevoke}
        onCloseAutoFocus={(event) => {
          if (!revokedRef.current) return;
          revokedRef.current = false;
          event.preventDefault();
          titleRef.current?.focus();
        }}
      />
    </section>
  );
}
