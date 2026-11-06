import { CheckCircle2, Link2Off, MailCheck, MailX, SearchX, TimerOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useSeoMeta } from '@/lib/seo-meta';
import { useConfirmSubscription } from '@/queries/use-public-marketing';
import { linkFailureOf } from './link-failure';
import { MarketingLinkCard } from './marketing-link-card';
import { useSignedFragment } from './use-signed-fragment';

/** The values of the link of the confirmation e-mail (`MarketingConfirmationLinks.Create`): the contact and the expiry, never the address. */
const LINK_FIELDS = {
  required: ['contactId', 'expiresAt', 'signature'],
} as const;

type ConfirmState = 'ask' | 'done' | 'expired' | 'invalid' | 'notFound' | 'suppressed';

/**
 * `/marketing/confirm`: the page the link of the confirmation e-mail opens (CRM-03, NF-90, the double opt-in). The signed values are in the
 * fragment of the link; the page takes them out of the address bar and shows one button, «Conferma iscrizione», which posts them unchanged. A
 * subscription that was already confirmed is told as confirmed; a person who opted out meanwhile (409 `contact_suppressed`) is told that
 * nothing was confirmed, with no button, since the answer would be the same every time. Public and never behind the CRM flag (an e-mail
 * already sent must keep working), not indexed, with no menu, no link to an account and no analytics.
 */
export function ConfirmPage() {
  const { t } = useTranslation();
  useSeoMeta({ title: t('marketing.confirm.pageTitle'), noindex: true });
  const link = useSignedFragment(LINK_FIELDS);
  const confirm = useConfirmSubscription();

  const failure = confirm.isError ? linkFailureOf(confirm.error) : null;
  let state: ConfirmState = 'ask';
  if (confirm.isSuccess) state = 'done';
  else if (link === null || failure === 'invalid') state = 'invalid';
  else if (failure === 'expired') state = 'expired';
  else if (failure === 'notFound') state = 'notFound';
  else if (failure === 'suppressed') state = 'suppressed';

  const cards = {
    ask: { tone: 'ask', icon: MailCheck, title: t('marketing.confirm.title'), description: t('marketing.confirm.description') },
    done: { tone: 'done', icon: CheckCircle2, title: t('marketing.confirm.done.title'), description: t('marketing.confirm.done.description') },
    expired: { tone: 'broken', icon: TimerOff, title: t('marketing.confirm.expired.title'), description: t('marketing.confirm.expired.description') },
    invalid: { tone: 'broken', icon: Link2Off, title: t('marketing.confirm.invalid.title'), description: t('marketing.confirm.invalid.description') },
    notFound: { tone: 'broken', icon: SearchX, title: t('marketing.confirm.notFound.title'), description: t('marketing.confirm.notFound.description') },
    suppressed: { tone: 'broken', icon: MailX, title: t('marketing.confirm.suppressed.title'), description: t('marketing.confirm.suppressed.description') },
  } as const;

  return (
    <MarketingLinkCard state={state} testId="marketing-confirm-page" {...cards[state]}>
      {state === 'ask' ? (
        <>
          {failure === 'retry' ? (
            <Alert variant="danger" data-testid="marketing-confirm-retry">
              {t('marketing.confirm.retry')}
            </Alert>
          ) : null}
          <Button
            block
            size="lg"
            loading={confirm.isPending}
            onClick={() => {
              if (link) confirm.mutate(link);
            }}
            data-testid="marketing-confirm-submit"
          >
            {t('marketing.confirm.action')}
          </Button>
        </>
      ) : null}
    </MarketingLinkCard>
  );
}
