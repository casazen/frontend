import { useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, CircleHelp, ExternalLink, Info, Loader2, type LucideIcon } from 'lucide-react';
import { PlainSection } from '@/components/shared/calm';
import { STATUS_TONE_CLASSES } from '@/components/shared/status/status-view';
import { Button } from '@/components/ui/button';
import { getHttpStatus, getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { cn } from '@/lib/utils';
import type { StatusTone } from '@/lib/status-dictionary';
import { useGuestRegistration, useSetGuestRegistrationOverride } from '@/queries/guestRegistration';
import { certaintyView, isPlaceUnknown, isTicinoRegime, missingCodesOf, portalLink, regimeFacts } from '../lib/guest-registration-model';
import { GuestRegistrationDuty } from './guest-registration-duty';
import { RefreshFailedNotice } from './guest-registration-notice';
import { GuestRegistrationReadiness } from './guest-registration-readiness';

/** The 422 of the API for a property whose country the catalog has no regime for. */
const COUNTRY_NOT_SUPPORTED = 'guest_registration_country_not_supported';

const CERTAINTY_ICONS: Record<StatusTone, LucideIcon> = {
  success: CheckCircle2,
  info: Info,
  neutral: CircleHelp,
  warning: Info,
  danger: Info,
};

interface GuestRegistrationCardProps {
  propertyId: string;
  /**
   * `page`: the tab of the property, where the link to the official portal opens (in a new tab, only from here). `wizard`: a step in progress, which never sends the host
   * out of the process: no link leaves it, and what is missing is fixed inside it.
   */
  variant: 'page' | 'wizard';
  /** `property.write`: the answer and the structure number can be changed. The API asks the same permission. */
  canWrite: boolean;
  /** A wizard sends the host to its own step where the municipality is set. */
  onFixMunicipality?: () => void;
  /** A page opens the form of the property, where the municipality is set. */
  municipalityHref?: string;
  /** After the structure number is saved (a wizard reads its steps again). */
  onChanged?: () => void;
}

/** One line of the facts: what it is and what it says. */
function Fact({ label, children, testId }: { label: string; children: ReactNode; testId: string }) {
  return (
    <div className="grid min-w-0 gap-0.5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-x-4" data-testid={testId}>
      <dt className="text-sm font-medium text-foreground/70">{label}</dt>
      <dd className="min-w-0 break-words text-sm">{children}</dd>
    </div>
  );
}

/**
 * «Notifica degli ospiti nel tuo cantone» (E29/F02/US02/T01, NF-125, NF-129): what the canton of the property asks for the registration of the guests, in plain words,
 * how sure the sources are, what CasaZen does for it and what the host decides (`GET` and `PUT api/properties/{id}/guest-registration`). In Ticino it carries the field of the
 * structure number and what is still missing. It reads what the server says now: a read that fails is told as a failure and never as the answer it gave before, a 404 is
 * always «not found», and an answer the sources do not settle is the host's to give, never a red alarm. Nothing is sent to anybody from here.
 */
export function GuestRegistrationCard({ propertyId, variant, canWrite, onFixMunicipality, municipalityHref, onChanged }: GuestRegistrationCardProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const query = useGuestRegistration(propertyId);
  const answer = useSetGuestRegistrationOverride(propertyId);
  const [numberSaving, setNumberSaving] = useState(false);
  // The buttons of the card wait while ANY change of the card is on its way: the answer or the structure number.
  const busy = answer.isPending || numberSaving;
  const numberSaved = () => {
    // What the property lacks is told by the activation too: it reads its steps again.
    void queryClient.invalidateQueries({ queryKey: ['compliance', 'activation', propertyId] });
    onChanged?.();
  };
  const answerError = answer.isError ? (getProblemMessage(answer.error, t) ?? t('guestRegistration.duty.saveFailed')) : null;

  // Read `isError` before `data`: TanStack Query keeps the old data on an error, and a 404 or a 403 must not be told with it. What the server says about THIS property (404, 403, and the
  // 422 of a country with no regime) replaces the card. Any other failure (the network, a 5xx) is only a refresh that did not work: with a card on screen it stays, with the structure
  // number that is being typed, and a notice says that it may not be up to date.
  const status = query.isError ? getHttpStatus(query.error) : undefined;
  const code = query.isError && isAxiosError(query.error) ? getProblemCode(query.error.response?.data) : undefined;
  const unsupportedCountry = status === 422 && code === COUNTRY_NOT_SUPPORTED;
  const unreadable = query.isError && status !== 404 && status !== 403 && !unsupportedCountry;

  let body: ReactNode;
  if (query.isError && status === 404) {
    body = <p className="text-sm" data-testid="guest-registration-not-found">{t('guestRegistration.card.notFound')}</p>;
  } else if (query.isError && status === 403) {
    body = <p className="text-sm" data-testid="guest-registration-forbidden">{t('guestRegistration.card.forbidden')}</p>;
  } else if (query.isError && unsupportedCountry) {
    body = <p className="text-sm" data-testid="guest-registration-unsupported">{t('guestRegistration.card.unsupported')}</p>;
  } else if (unreadable && !query.data) {
    body = (
      <div className="space-y-2" role="alert" data-testid="guest-registration-error">
        <p className="text-sm text-destructive">{t('guestRegistration.card.loadFailed')}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
          {t('guestRegistration.card.retry')}
        </Button>
      </div>
    );
  } else if (!query.data) {
    body = (
      <p className="flex items-center gap-2 text-sm text-foreground/70" role="status" data-testid="guest-registration-loading">
        <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
        {t('guestRegistration.card.loading')}
      </p>
    );
  } else if (!query.data.regime) {
    body = <p className="text-sm" data-testid="guest-registration-unsupported">{t('guestRegistration.card.unsupported')}</p>;
  } else {
    const { regime, place } = query.data;
    const facts = regimeFacts(regime, t);
    const certainty = certaintyView(regime, t, i18n.language);
    const CertaintyIcon = CERTAINTY_ICONS[certainty.tone];
    const portal = portalLink(regime.portalUrl);
    const municipality = place && !place.ambiguous && place.municipalityName ? place.municipalityName : null;
    const canton = place?.cantonCode ?? regime.cantonCode;
    const missing = missingCodesOf(query.data.identifierMissing);

    body = (
      <>
        {unreadable ? <RefreshFailedNotice testId="guest-registration-refresh-error" retrying={query.isFetching} onRetry={() => void query.refetch()} /> : null}
        {municipality && canton ? (
          <p className="text-sm text-foreground/70" data-testid="guest-registration-place">
            {t('guestRegistration.card.place', { municipality, canton })}
          </p>
        ) : null}
        <p className="text-sm" data-testid="guest-registration-summary">{regime.summary}</p>

        <dl className="space-y-2" data-testid="guest-registration-facts">
          <Fact label={t('guestRegistration.facts.obligation')} testId="guest-registration-fact-obligation">
            {facts.obligation}
          </Fact>
          <Fact label={t('guestRegistration.facts.deadline')} testId="guest-registration-fact-deadline">
            {facts.deadline}
            {facts.deadlineNote ? <span className="block text-foreground/70">{facts.deadlineNote}</span> : null}
          </Fact>
          <Fact label={t('guestRegistration.facts.retention')} testId="guest-registration-fact-retention">
            {facts.retention}
          </Fact>
          <Fact label={t('guestRegistration.facts.channel')} testId="guest-registration-fact-channel">
            {facts.channel}
          </Fact>
          {portal ? (
            <Fact label={t('guestRegistration.facts.portal')} testId="guest-registration-fact-portal">
              {variant === 'page' ? (
                // The only way out of the card, and only from the page of the property: a step of a wizard that is in progress never leaves the process.
                <a
                  href={portal.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1 text-primary hover:underline sm:min-h-0"
                  data-testid="guest-registration-portal-link"
                >
                  {t('guestRegistration.card.openPortal')} ({portal.host})
                  <ExternalLink aria-hidden="true" className="size-3.5" />
                </a>
              ) : (
                <>
                  <span data-testid="guest-registration-portal-host">{portal.host}</span>
                  <span className="block text-foreground/70">{t('guestRegistration.card.portalLater')}</span>
                </>
              )}
            </Fact>
          ) : null}
          <Fact label={t('guestRegistration.facts.support')} testId="guest-registration-fact-support">
            {facts.support}
          </Fact>
        </dl>

        <div className="space-y-1" data-testid="guest-registration-certainty" data-certainty={certainty.certainty}>
          <span
            className={cn('inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', STATUS_TONE_CLASSES[certainty.tone])}
          >
            <CertaintyIcon aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="min-w-0 break-words">{certainty.label}</span>
          </span>
          <p className="text-sm text-foreground/70">{certainty.text}</p>
        </div>

        <GuestRegistrationDuty
          duty={query.data.effectiveDuty}
          override={query.data.override}
          canWrite={canWrite}
          saving={answer.isPending}
          savingValue={answer.variables}
          busy={busy}
          error={answerError}
          placeKnown={!isPlaceUnknown(missing)}
          onAnswer={(override) => answer.mutate(override)}
        />

        <GuestRegistrationReadiness
          propertyId={propertyId}
          missing={missing}
          ticino={isTicinoRegime(regime)}
          canWrite={canWrite}
          busy={busy}
          onPendingChange={setNumberSaving}
          onFixMunicipality={onFixMunicipality}
          municipalityHref={municipalityHref}
          onSaved={numberSaved}
        />
      </>
    );
  }

  return (
    <PlainSection title={t('guestRegistration.card.title')} data-testid="guest-registration-card" data-variant={variant}>
      <div className="space-y-3">{body}</div>
    </PlainSection>
  );
}
