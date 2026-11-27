import { useState } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { BillingSetupSection, PortalTouristTaxComune } from '@/types';
import { comuneNamesOf, portalComuniFailureOf, type ItalianTouristTaxView, type PortalComuniChange, type PortalComuniFailure } from '../billing-wizard-model';
import { PORTAL_SOURCES } from '../billing-wizard-schema';

/** What the block needs of the page. */
export interface PortalTouristTaxProps {
  /** What the setup says of the portals that collect the tourist tax in the Italian comuni (`italianTouristTaxOf`). */
  view: ItalianTouristTaxView;
  /**
   * The confirmation of the portals (`PUT api/billing-setup/touristTax/portal-comuni`), which the page owns: it knows when a request of the wizard is on its way. It takes what the person did
   * and makes the whole list itself, from the setup read again just before the call: what this block shows may be old, and a list made from it could take confirmations away.
   */
  confirm: UseMutationResult<BillingSetupSection, unknown, PortalComuniChange>;
  /** A request of the wizard is on its way (this one included): every button of the block waits for it. */
  busy: boolean;
  /** The server said the reach of the person is only some of the properties: the wizard turns read-only, as it does for every other save. */
  onRefused: () => void;
}

interface PortalTouristTaxBlockProps extends PortalTouristTaxProps {
  /** The properties of the organization: the name they carry for the ISTAT code of a comune names a pair that was confirmed. */
  properties: ReadonlyArray<{ city?: string | null; comuneIstatCode?: string | null }>;
}

/** What a pair is called in this block's state: the portal and the comune. */
const keyOf = (pair: PortalTouristTaxComune) => `${pair.channel}|${pair.comuneIstat}`;

/** The id a pair has in the test ids: the portal and the six digits of the comune. */
const idOf = (pair: PortalTouristTaxComune) => `${pair.channel}-${pair.comuneIstat}`;

/**
 * The tourist tax of the portals in the Italian comuni (decision 2 of the fiscal decisions of 2026-11-20, research R2): for each comune of the properties where the server proposes
 * that a portal collects and pays it, a question with two answers («Sì, confermo» and «Non ora»), and the portals already confirmed, each with a way to take the confirmation away. It
 * is never an answer by itself: nothing is preselected, «Non ora» changes nothing and sends nothing, and only «Sì, confermo» sends the confirmation. A confirmation or a removal sends the
 * WHOLE list of the confirmed pairs (the server replaces the list it had), made from the setup read again just before it and never from what this block shows (see `confirm`): when that
 * list cannot be made nothing is sent. Every refusal and failure is told in its own words where it happened, never as a page of its own: a 403 is a refusal in words (never the no-access
 * page), a call whose outcome is not known says so and is read again before it can be tried again, and an answer that is not the saved section is a failure, never a success.
 */
export function PortalTouristTax({ view, properties, confirm, busy, onRefused }: PortalTouristTaxBlockProps) {
  const { t } = useTranslation();
  // «Non ora» is a thing of this visit to the step: nothing is sent and nothing is kept, so the question comes back the next time the step opens.
  const [deferred, setDeferred] = useState<ReadonlySet<string>>(() => new Set());
  // The names of the comuni of the proposals the person confirmed: the server stops proposing a confirmed pair, and its comune must still be named.
  const [remembered, setRemembered] = useState<ReadonlyMap<string, string>>(() => new Map());
  const [sending, setSending] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<{ change: PortalComuniChange; comune: string } | null>(null);
  const [failure, setFailure] = useState<PortalComuniFailure | null>(null);
  const [done, setDone] = useState<{ kind: 'confirmed' | 'removed'; comune: string } | null>(null);

  const confirmed = view.confirmed ?? [];
  const names = comuneNamesOf(properties, view.proposals, remembered);
  const comuneOf = (code: string) => names.get(code) ?? code;
  const portalOf = (channel: string) => ((PORTAL_SOURCES as readonly string[]).includes(channel) ? t(`booking.source.${channel}`) : channel);
  // Every button waits for the request in flight, and the one that sent it says so: nothing is sent twice and nothing is sent over another answer.
  const locked = busy || sending !== null;

  const send = async (change: PortalComuniChange, comune: string) => {
    if (locked) return;
    const target = 'add' in change ? change.add : change.remove;
    setAttempt({ change, comune });
    setFailure(null);
    setDone(null);
    setSending(keyOf(target));
    if ('add' in change) setRemembered((previous) => new Map(previous).set(target.comuneIstat, comune));
    try {
      // The mutation reads the setup again and makes the whole list from that reading: it can say «not sent», and «Riprova» reads again.
      await confirm.mutateAsync(change);
      setDone({ kind: 'add' in change ? 'confirmed' : 'removed', comune });
    } catch (error) {
      // The failure is told below, in its own words: nothing is claimed as saved.
      const kind = portalComuniFailureOf(error);
      setFailure(kind);
      if (kind === 'wholeOrg') onRefused();
    } finally {
      setSending(null);
    }
  };

  const defer = (key: string, deferring: boolean) =>
    setDeferred((previous) => {
      const next = new Set(previous);
      if (deferring) next.add(key);
      else next.delete(key);
      return next;
    });

  const failureText = (kind: PortalComuniFailure): string => {
    switch (kind) {
      case 'wholeOrg':
        return t('billingWizard.touristTax.italy.portals.failure.wholeOrg');
      case 'forbidden':
        return t('billingWizard.touristTax.italy.portals.failure.forbidden');
      case 'invalid':
        return t('billingWizard.touristTax.italy.portals.failure.invalid');
      case 'profile':
        return t('billingWizard.touristTax.italy.portals.failure.profile');
      case 'notSent':
        return t('billingWizard.touristTax.italy.portals.failure.notSent');
      case 'failed':
        return t('billingWizard.touristTax.italy.portals.failure.failed');
    }
  };

  // Nothing to ask, nothing confirmed, no hint, nothing that just happened: the step is what it was.
  if (!view.conflict && view.proposals.length === 0 && confirmed.length === 0 && failure === null && done === null) return null;

  return (
    <section className="flex min-w-0 flex-col gap-4" aria-labelledby="billing-portal-tax-title" data-testid="billing-portal-tax">
      <h3 id="billing-portal-tax-title" className="text-base font-semibold">
        {t('billingWizard.touristTax.italy.portals.title')}
      </h3>

      {/* A calm hint, once: no alert and no «Da fare». What it points at is the confirmed portals and the questions below it. */}
      {view.conflict ? (
        <p className="text-sm text-foreground/80" data-testid="billing-portal-tax-conflict">
          {t('billingWizard.touristTax.italy.portals.hint')}
        </p>
      ) : null}

      {view.proposals.length > 0 ? (
        <ul className="flex min-w-0 flex-col gap-3" data-testid="billing-portal-proposals">
          {view.proposals.map((proposal) => {
            const pair = { channel: proposal.channel, comuneIstat: proposal.comuneIstat };
            const key = keyOf(pair);
            const comune = comuneOf(proposal.comuneIstat);
            const portal = portalOf(proposal.channel);

            return deferred.has(key) ? (
              <li key={key} className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md bg-muted p-3 text-sm" data-testid="billing-portal-deferred" data-comune={proposal.comuneIstat}>
                <span className="min-w-0 break-words text-foreground/80">{t('billingWizard.touristTax.italy.portals.proposal.deferred', { comune })}</span>
                <Button type="button" variant="ghost" size="sm" disabled={locked} onClick={() => defer(key, false)} data-testid={`billing-portal-answer-${idOf(pair)}`}>
                  {t('billingWizard.touristTax.italy.portals.answerNow')}
                </Button>
              </li>
            ) : (
              <li key={key} className="flex min-w-0 flex-col gap-3 rounded-md border p-4" data-testid="billing-portal-proposal" data-comune={proposal.comuneIstat}>
                <p className="min-w-0 break-words font-medium">{t('billingWizard.touristTax.italy.portals.proposal.question', { portal, comune })}</p>
                <p className="min-w-0 break-words text-sm text-foreground/70">
                  {proposal.channel === 'Airbnb' ? t('billingWizard.touristTax.italy.portals.proposal.whereAirbnb') : t('billingWizard.touristTax.italy.portals.proposal.whereOther', { portal })}
                </p>
                <p className="min-w-0 break-words text-sm text-foreground/70">{t('billingWizard.touristTax.italy.portals.proposal.effect', { portal })}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    loading={sending === key}
                    disabled={locked && sending !== key}
                    onClick={() => void send({ add: pair }, comune)}
                    data-testid={`billing-portal-confirm-${idOf(pair)}`}
                  >
                    {t('billingWizard.touristTax.italy.portals.proposal.confirm', { comune })}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={locked}
                    onClick={() => defer(key, true)}
                    aria-label={t('billingWizard.touristTax.italy.portals.proposal.notNowFor', { comune })}
                    data-testid={`billing-portal-not-now-${idOf(pair)}`}
                  >
                    {t('billingWizard.touristTax.italy.portals.proposal.notNow')}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {confirmed.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-2" data-testid="billing-portal-confirmed">
          <h4 className="text-sm font-semibold">{t('billingWizard.touristTax.italy.portals.confirmed.title')}</h4>
          <p className="text-sm text-foreground/70">{t('billingWizard.touristTax.italy.portals.confirmed.effect')}</p>
          <ul className="divide-y rounded-md border">
            {confirmed.map((pair) => {
              const key = keyOf(pair);
              const comune = comuneOf(pair.comuneIstat);
              return (
                <li key={key} className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 text-sm" data-testid="billing-portal-confirmed-item" data-comune={pair.comuneIstat}>
                  <span className="min-w-0 break-words font-medium">{t('billingWizard.touristTax.italy.portals.confirmed.item', { portal: portalOf(pair.channel), comune })}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    loading={sending === key}
                    disabled={locked && sending !== key}
                    onClick={() => void send({ remove: pair }, comune)}
                    data-testid={`billing-portal-remove-${idOf(pair)}`}
                  >
                    {t('billingWizard.touristTax.italy.portals.confirmed.remove', { comune })}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/* What happened, only once the server has said so: the answer that was saved, never a success that nobody confirmed. */}
      {done ? (
        <p role="status" className="text-sm font-medium" data-testid="billing-portal-done">
          {done.kind === 'confirmed'
            ? t('billingWizard.touristTax.italy.portals.done.confirmed', { comune: done.comune })
            : t('billingWizard.touristTax.italy.portals.done.removed', { comune: done.comune })}
        </p>
      ) : null}

      {failure ? (
        <Alert
          variant="danger"
          data-testid="billing-portal-failure"
          data-failure={failure}
          action={
            (failure === 'failed' || failure === 'notSent') && attempt ? (
              <Button type="button" size="sm" variant="outline" disabled={locked} onClick={() => void send(attempt.change, attempt.comune)} data-testid="billing-portal-retry">
                {t('billingWizard.touristTax.italy.portals.failure.retry')}
              </Button>
            ) : undefined
          }
        >
          {failureText(failure)}
        </Alert>
      ) : null}
    </section>
  );
}
