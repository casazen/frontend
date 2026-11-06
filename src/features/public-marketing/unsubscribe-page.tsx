import { CheckCircle2, Link2Off, MailX, TimerOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useSeoMeta } from '@/lib/seo-meta';
import { useUnsubscribe } from '@/queries/use-public-marketing';
import { linkFailureOf } from './link-failure';
import { MarketingLinkCard } from './marketing-link-card';
import { useSignedFragment } from './use-signed-fragment';

/** The values of the link of a campaign e-mail (`MarketingUnsubscribeLinks.Create`); the campaign is there only when the link comes from one. */
const LINK_FIELDS = {
  required: ['orgId', 'emailHash', 'expiresAt', 'signature'],
  optional: ['campaignId'],
} as const;

type UnsubscribeState = 'ask' | 'done' | 'expired' | 'invalid';

/**
 * `/unsubscribe`: the page the unsubscribe link of a marketing e-mail opens (CRM-08, NF-95). The signed values are in the fragment of the link; the page
 * takes them out of the address bar and asks for one explicit confirmation, so that a mail scanner that only loads the page cannot unsubscribe
 * anyone (and the fragment never reaches a server anyway). The button posts the values unchanged; the answer is the same on a repeat. Public and
 * never behind the CRM flag (an e-mail already sent must keep working), not indexed, with no menu, no link to an account and no analytics.
 */
export function UnsubscribePage() {
  const { t } = useTranslation();
  useSeoMeta({ title: t('marketing.unsubscribe.pageTitle'), noindex: true });
  const link = useSignedFragment(LINK_FIELDS);
  const unsubscribe = useUnsubscribe();

  // The unsubscribe endpoint never says `contact_not_found` nor `contact_suppressed`; a link the server refuses for any other reason does not work.
  const failure = unsubscribe.isError ? linkFailureOf(unsubscribe.error) : null;
  let state: UnsubscribeState = 'ask';
  if (unsubscribe.isSuccess) state = 'done';
  else if (link === null || failure === 'invalid' || failure === 'notFound' || failure === 'suppressed') state = 'invalid';
  else if (failure === 'expired') state = 'expired';

  const cards = {
    ask: { tone: 'ask', icon: MailX, title: t('marketing.unsubscribe.title'), description: t('marketing.unsubscribe.description') },
    done: { tone: 'done', icon: CheckCircle2, title: t('marketing.unsubscribe.done.title'), description: t('marketing.unsubscribe.done.description') },
    expired: { tone: 'broken', icon: TimerOff, title: t('marketing.unsubscribe.expired.title'), description: t('marketing.unsubscribe.expired.description') },
    invalid: { tone: 'broken', icon: Link2Off, title: t('marketing.unsubscribe.invalid.title'), description: t('marketing.unsubscribe.invalid.description') },
  } as const;

  return (
    <MarketingLinkCard state={state} testId="unsubscribe-page" {...cards[state]}>
      {state === 'ask' ? (
        <>
          {failure === 'retry' ? (
            <Alert variant="danger" data-testid="unsubscribe-retry">
              {t('marketing.unsubscribe.retry')}
            </Alert>
          ) : null}
          <Button
            block
            size="lg"
            loading={unsubscribe.isPending}
            onClick={() => {
              if (link) unsubscribe.mutate(link);
            }}
            data-testid="unsubscribe-confirm"
          >
            {t('marketing.unsubscribe.action')}
          </Button>
        </>
      ) : null}
    </MarketingLinkCard>
  );
}
