import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { MarketplaceGroupId } from '@/types';
import { CHANNELS_PAGE_PATH } from '../lib/marketplace-paths';

/**
 * The test id of the section of each group. Home services and Partners keep the ids the sections of the old page had
 * (`marketplace-suppliers-section`, `marketplace-partners-section`), which the specs of the marketplace read.
 */
const GROUP_TEST_ID: Record<MarketplaceGroupId, string> = {
  salesChannels: 'marketplace-group-salesChannels',
  connectedTools: 'marketplace-group-connectedTools',
  channelManagerFunctions: 'marketplace-group-channelManagerFunctions',
  homeServices: 'marketplace-suppliers-section',
  partners: 'marketplace-partners-section',
};

/** One of the five groups of Scopri: its title, a line that says what it holds, and what it holds. */
export function MarketplaceGroup({ id, children }: { id: MarketplaceGroupId; children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <PlainSection title={t(`marketplace.groups.${id}.title`)} data-testid={GROUP_TEST_ID[id]}>
      <p className="text-sm text-foreground/70">{t(`marketplace.groups.${id}.description`)}</p>
      {children}
    </PlainSection>
  );
}

/** The cards of a group, side by side where there is room. */
export function MarketplaceCards({ children }: { children: ReactNode }) {
  return (
    <ul role="list" className="grid list-none gap-3 pt-2 sm:grid-cols-2 xl:grid-cols-3">
      {children}
    </ul>
  );
}

/** Instead of the cards of a group that waits for the channel manager: why there are none, and the page where it is connected. */
export function ChannelManagerOffNote({ groupId }: { groupId: MarketplaceGroupId }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2" data-testid={`marketplace-octorate-off-${groupId}`}>
      <p className="min-w-0 flex-1 text-sm">{t('marketplace.groups.octorateOff')}</p>
      <Button asChild variant="outline" size="sm">
        <Link to={CHANNELS_PAGE_PATH}>{t('marketplace.groups.connectChannels')}</Link>
      </Button>
    </div>
  );
}

/** A group whose cards could not be read: it says so, and the person can ask again. */
export function MarketplaceGroupError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <Alert
      variant="danger"
      className="mt-2"
      action={
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          {t('shared.errorState.retry')}
        </Button>
      }
    >
      {t('marketplace.groups.loadError')}
    </Alert>
  );
}
