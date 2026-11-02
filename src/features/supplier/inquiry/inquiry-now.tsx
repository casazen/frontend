import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FocusBlock, PlainSection } from '@/components/shared/calm';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import { useNow } from '@/hooks/use-now';
import { useSendSupplierOffer, useSupplierRequestThread, useWithdrawSupplierOffer } from '@/queries/supplier/use-inquiry';
import type { SupplierServiceRequest } from '@/types/service-request';
import type { SendSupplierOfferBody } from '@/types/supplier-inquiry';
import { QuoteSummary } from '../requests/quote-summary';
import { phaseOf, requestPath } from '../requests/request-model';
import type { RequestActions } from '../requests/use-request-actions';
import { formatMoney } from '../services/lib/service-money';
import { negotiationViewOf, offerAsQuote, respondByLine, type NegotiationView } from './inquiry-model';
import { OfferSheet } from './offer-sheet';

const T = 'supplier.inquiry.now';
/** A button of the quiet row under the block: at least 44 px high, and a long label wraps instead of pushing the page sideways. */
const QUIET_BUTTON = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';
/** The countdown is read again every half minute: it is minutes that matter, and the page is not a clock. */
const TICK_MS = 30_000;

/** Whose turn it is and what the customer sees, in two lines (the same shape as the block of every other request). */
function TurnLines({ view }: { view: NegotiationView }) {
  const { t } = useTranslation();
  return (
    <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[auto_1fr]">
      <dt className="text-sm font-semibold text-foreground/70">{t('supplier.requests.now.label.you')}</dt>
      <dd className="min-w-0 break-words">{t(`${T}.${view}.you`)}</dd>
      <dt className="text-sm font-semibold text-foreground/70">{t('supplier.requests.now.label.client')}</dt>
      <dd className="min-w-0 break-words">{t(`${T}.${view}.client`)}</dd>
    </dl>
  );
}

/**
 * "Adesso" for a request on measure of the showcase (SP-08e): the one highlighted block of the page, as for any other request, with the time
 * left to answer and the way to answer (write in the conversation below, or send an offer); once the offer is sent, a quiet section that says
 * so, shows the offer as the customer reads it, and lets the supplier replace it or take it back. In the drawer of the list it is the block and
 * a link to the page: the conversation is not read there (reading marks the customer's messages as read, which belongs to the page).
 *
 * The time left, whether the supplier may answer and the state of the negotiation are the server's (`GET thread`): nothing here is a fixed
 * number, and nothing is promised for when the time is over.
 */
export function InquiryNow({ request, actions, inDrawer = false }: { request: SupplierServiceRequest; actions: RequestActions; inDrawer?: boolean }) {
  return inDrawer ? <InquiryNowInDrawer request={request} actions={actions} /> : <InquiryNowOnPage request={request} actions={actions} />;
}

function InquiryNowInDrawer({ request, actions }: { request: SupplierServiceRequest; actions: RequestActions }) {
  const { t, i18n } = useTranslation();
  const now = useNow(TICK_MS);
  const offerSent = phaseOf(request) === 'quotePending';
  const view: NegotiationView = offerSent ? 'offerSent' : 'awaiting';
  const open = { label: t(`${T}.open`), href: requestPath(request.id), testId: 'supplier-inquiry-open' };

  if (offerSent) {
    return (
      <PlainSection title={t(`${T}.offerSent.title`)} data-testid="supplier-request-now">
        <div className="text-sm sm:text-base">
          <TurnLines view={view} />
        </div>
        <Button asChild variant="outline" className={QUIET_BUTTON}>
          <Link to={open.href} data-testid={open.testId}>
            {open.label}
          </Link>
        </Button>
      </PlainSection>
    );
  }

  return (
    <FocusBlock
      data-testid="supplier-request-now"
      kicker={t('supplier.requests.now.kicker')}
      title={t(`${T}.${view}.title`)}
      when={(request.respondBy ? respondByLine(request.respondBy, now, i18n.language, t) : null) ?? undefined}
      body={<TurnLines view={view} />}
      then={t(`${T}.then`)}
      primary={open}
      secondary={{ label: t(`${T}.decline`), onClick: () => actions.askReject(request.id), disabled: actions.suspended || actions.busy, testId: 'supplier-request-reject' }}
    />
  );
}

function InquiryNowOnPage({ request, actions }: { request: SupplierServiceRequest; actions: RequestActions }) {
  const { t, i18n } = useTranslation();
  const now = useNow(TICK_MS);
  // The conversation below is the one that keeps the thread fresh (it polls); this block reads the same cache.
  const thread = useSupplierRequestThread(request.id);
  const send = useSendSupplierOffer(request.id);
  const withdraw = useWithdrawSupplierOffer(request.id);
  const [asking, setAsking] = useState<'offer' | 'withdraw' | null>(null);

  if (thread.isPending) return <SkeletonLine lines={4} label={t(`${T}.loading`)} />;
  if (thread.isError || !thread.data) {
    return <ErrorState testId="supplier-inquiry-error" title={t(`${T}.loadError`)} error={thread.error} onRetry={() => void thread.refetch()} />;
  }

  const data = thread.data;
  const view = negotiationViewOf(data.negotiation);
  const blocked = actions.suspended;
  const offer = data.offer ?? null;
  const money = (cents: number) => formatMoney(cents, i18n.language);

  let block: ReactNode;
  if (view === 'offerSent' && offer) {
    // Waiting for the customer: nothing the supplier has to do, so no highlight. It may still replace the offer or take it back.
    block = (
      <PlainSection title={t(`${T}.offerSent.title`)} data-testid="supplier-request-now">
        <div className="text-sm sm:text-base">
          <TurnLines view="offerSent" />
        </div>
        <QuoteSummary quote={offerAsQuote(offer, money)} showcase />
        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap" data-testid="supplier-inquiry-offer-actions">
          <Button type="button" variant="outline" className={QUIET_BUTTON} disabled={blocked || !data.canSendOffer} onClick={() => setAsking('offer')} data-testid="supplier-inquiry-replace-offer">
            {t(`${T}.replace`)}
          </Button>
          <Button type="button" variant="outline" className={QUIET_BUTTON} disabled={blocked} onClick={() => setAsking('withdraw')} data-testid="supplier-inquiry-withdraw-offer">
            {t(`${T}.withdraw`)}
          </Button>
        </div>
        {blocked ? <p className="text-sm text-foreground/70">{t('supplier.requests.suspendedHint')}</p> : null}
      </PlainSection>
    );
  } else if (data.canSendOffer) {
    block = (
      <FocusBlock
        data-testid="supplier-request-now"
        kicker={t('supplier.requests.now.kicker')}
        title={t(`${T}.${view === 'offerSent' ? 'conversation' : view}.title`)}
        when={(data.respondBy ? respondByLine(data.respondBy, now, i18n.language, t) : null) ?? undefined}
        body={<TurnLines view={view === 'offerSent' ? 'conversation' : view} />}
        then={t(`${T}.then`)}
        primary={{
          label: t(view === 'offerDeclined' ? `${T}.sendAnother` : `${T}.send`),
          onClick: () => setAsking('offer'),
          disabled: blocked,
          testId: 'supplier-inquiry-send-offer',
        }}
        secondary={{ label: t(`${T}.decline`), onClick: () => actions.askReject(request.id), disabled: blocked || actions.busy, testId: 'supplier-request-reject' }}
      />
    );
  } else {
    // The supplier cannot answer now (suspended, or the conversation closed meanwhile): the words, and no button that would be refused.
    block = (
      <PlainSection title={t(`${T}.quietTitle`)} data-testid="supplier-request-now">
        <p className="break-words text-sm sm:text-base">{t(`${T}.cannotAnswer`)}</p>
        {blocked ? <p className="text-sm text-foreground/70">{t('supplier.requests.suspendedHint')}</p> : null}
      </PlainSection>
    );
  }

  const submitOffer = async (body: SendSupplierOfferBody) => {
    await send.mutateAsync(body);
  };

  return (
    <>
      {block}
      {asking === 'offer' ? <OfferSheet offer={offer} onCancel={() => setAsking(null)} onSubmit={submitOffer} /> : null}
      {asking === 'withdraw' ? (
        <ConfirmationDialog
          open
          onOpenChange={(open) => {
            if (!open) setAsking(null);
          }}
          title={t(`${T}.withdrawDialog.title`)}
          description={t(`${T}.withdrawDialog.description`)}
          confirmLabel={t(`${T}.withdrawDialog.confirm`)}
          cancelLabel={t(`${T}.withdrawDialog.back`)}
          consequences={[t(`${T}.withdrawDialog.again`)]}
          isLoading={withdraw.isPending}
          onConfirm={() => withdraw.mutate(undefined, { onSettled: () => setAsking(null) })}
        />
      ) : null}
    </>
  );
}
