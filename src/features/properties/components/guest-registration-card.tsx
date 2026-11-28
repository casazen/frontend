import { useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { Archive, CheckCircle2, CircleHelp, Clock, ExternalLink, Globe, Info, Landmark, Loader2, MapPin, Scale, Upload, type LucideIcon } from 'lucide-react';
import { Figure, Figures, IconFact, IconFacts, InfoCard } from '@/components/shared/calm';
import { ManualHint } from '@/components/shared/manual-hint';
import { StatusPill } from '@/components/shared/status/status-pill';
import { Button } from '@/components/ui/button';
import { HelpTip } from '@/components/ui/help-tip';
import { getHttpStatus, getProblemCode, getProblemMessage } from '@/lib/api-errors';
import type { StatusTone } from '@/lib/status-dictionary';
import { useGuestRegistration, useSetGuestRegistrationOverride } from '@/queries/guestRegistration';
import { certaintyView, isPlaceUnknown, isTicinoRegime, missingCodesOf, portalLink, regimeFacts } from '../lib/guest-registration-model';
import { GuestRegistrationDuty } from './guest-registration-duty';
import { GuestRegistrationLayers } from './guest-registration-layers';
import { RefreshFailedNotice } from './guest-registration-notice';
import { GuestRegistrationReadiness } from './guest-registration-readiness';

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
  variant: 'page' | 'wizard';
  canWrite: boolean;
  onFixMunicipality?: () => void;
  municipalityHref?: string;
  onChanged?: () => void;
  className?: string;
}

export function GuestRegistrationCard({ propertyId, variant, canWrite, onFixMunicipality, municipalityHref, onChanged, className }: GuestRegistrationCardProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const query = useGuestRegistration(propertyId);
  const answer = useSetGuestRegistrationOverride(propertyId);
  const [numberSaving, setNumberSaving] = useState(false);
  const busy = answer.isPending || numberSaving;
  const numberSaved = () => {
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
  let state: ReactNode;
  let hint: ReactNode;
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
    const portal = portalLink(regime.portalUrl);
    const municipality = place && !place.ambiguous && place.municipalityName ? place.municipalityName : null;
    const canton = place?.cantonCode ?? regime.cantonCode;
    const missing = missingCodesOf(query.data.identifierMissing);

    state = (
      <StatusPill tone={certainty.tone} icon={CERTAINTY_ICONS[certainty.tone]} data-testid="guest-registration-certainty" data-certainty={certainty.certainty}>
        {certainty.label}
      </StatusPill>
    );
    hint =
      variant === 'page' ? (
        <ManualHint page="cin-identificazione-ticino" anchor="svizzera-e-ticino-notifica-degli-ospiti" title={t('guestRegistration.card.title')}>
          {certainty.text}
        </ManualHint>
      ) : (
        <HelpTip title={t('guestRegistration.card.title')}>{certainty.text}</HelpTip>
      );

    body = (
      <>
        {unreadable ? <RefreshFailedNotice testId="guest-registration-refresh-error" retrying={query.isFetching} onRetry={() => void query.refetch()} /> : null}
        {municipality && canton ? (
          <IconFacts>
            <IconFact icon={MapPin} data-testid="guest-registration-place">
              {t('guestRegistration.card.place', { municipality, canton })}
            </IconFact>
          </IconFacts>
        ) : null}

        <Figures className="grid-cols-2 @2xl:grid-cols-4" data-testid="guest-registration-facts">
          <Figure icon={Scale} label={t('guestRegistration.facts.obligation')} size="sm" data-testid="guest-registration-fact-obligation">
            {facts.obligation}
          </Figure>
          <Figure icon={Clock} label={t('guestRegistration.facts.deadline')} size="sm" data-testid="guest-registration-fact-deadline">
            {facts.deadline}
            {facts.deadlineNote ? <span className="sr-only">. {facts.deadlineNote}</span> : null}
          </Figure>
          <Figure icon={Archive} label={t('guestRegistration.facts.retention')} size="sm" data-testid="guest-registration-fact-retention">
            {facts.retention}
          </Figure>
          <Figure icon={Upload} label={t('guestRegistration.facts.channel')} size="sm" data-testid="guest-registration-fact-channel">
            {facts.channel}
          </Figure>
        </Figures>

        {portal ? (
          <div data-testid="guest-registration-fact-portal">
            {variant === 'page' ? (
              <Button asChild variant="outline" size="sm">
                <a href={portal.href} target="_blank" rel="noopener noreferrer" data-testid="guest-registration-portal-link">
                  {t('guestRegistration.card.openPortal')}
                  <ExternalLink aria-hidden="true" className="size-4" />
                  <span className="sr-only">({portal.host})</span>
                </a>
              </Button>
            ) : (
              <IconFacts>
                <IconFact icon={Globe} label={t('guestRegistration.facts.portal')}>
                  <span data-testid="guest-registration-portal-host">{portal.host}</span>
                </IconFact>
              </IconFacts>
            )}
          </div>
        ) : null}

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

        {variant === 'page' ? <GuestRegistrationLayers propertyId={propertyId} regime={regime} effectiveDuty={query.data.effectiveDuty} /> : null}
      </>
    );
  }

  return (
    <InfoCard
      icon={Landmark}
      title={t('guestRegistration.card.title')}
      status={state}
      hint={hint}
      className={className}
      data-testid="guest-registration-card"
      data-variant={variant}
    >
      <div className="@container space-y-3">{body}</div>
    </InfoCard>
  );
}
