import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { getProblemMessage } from '@/lib/api-errors';
import { useFoundListings, useRefreshListings, useShortRentProperties } from '@/queries/use-octorate-mapping';
import { capacityText, detailsLine, listingAddress, listingName, listingStateHint } from './listing-labels';
import { ChannelList, ListingStateBadge, StepNotice, StepProblem } from './listing-parts';
import { forShortRent, shortRentIdsOf } from './mapping-model';
import type { ConnectPhase } from './use-octorate-connect';

/** A line of work in progress: the listings being read or shown (the spinner announces it). */
function Working({ message, testId }: { message: string; testId: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg bg-muted p-4 text-sm" data-testid={testId}>
      <Spinner size="sm" />
      <span className="min-w-0 break-words">{message}</span>
    </div>
  );
}

interface ChannelsFoundStepProps {
  /** Where the consent stands: the listings are asked for only once the channel manager is connected. */
  phase: ConnectPhase;
  /** Back to the consent, for the host who got here without it. */
  onBackToConsent: () => void;
}

/**
 * Step 4, "Canali trovati" (E02/F01/US02/T05, NF-28): what the channel manager holds, read-only. Each listing shows the one state it is
 * in, in simple words, and the channels it is on with their state. The channel manager is "il tuo channel manager" here, never by its
 * name (NF-12).
 *
 * Right after the consent nothing is stored yet, so a list that comes back empty is filled by reading the channel manager once, without
 * the host asking; "Aggiorna l'elenco" reads it again whenever they want (a listing added meanwhile). Listings already confirmed or
 * excluded are not touched by a read.
 */
export function ChannelsFoundStep({ phase, onBackToConsent }: ChannelsFoundStepProps) {
  const { t } = useTranslation();
  const connected = phase === 'connected';
  const listings = useFoundListings({ enabled: connected });
  // The proposal named under a listing is one the host can pick in the next step: the short-rent properties only.
  const properties = useShortRentProperties();
  const { mutate: readAgain, isPending: reading, isError: readFailed, error: readError } = useRefreshListings();
  // The channel manager has been read, by the step or by the host: the step never reads it again by itself.
  const asked = useRef(false);

  const stored = listings.isSuccess ? listings.data : null;
  useEffect(() => {
    if (stored === null || stored.length > 0 || asked.current) return;
    asked.current = true;
    readAgain();
  }, [stored, readAgain]);

  const readNow = () => {
    asked.current = true;
    readAgain();
  };

  if (phase === 'checking' || phase === 'completing') {
    return <Working message={t('octorate.connect.consent.checking')} testId="octorate-channels-checking" />;
  }

  if (!connected) {
    return (
      <StepNotice
        title={t('octorate.connect.channelsFound.notConnected.title')}
        text={t('octorate.connect.channelsFound.notConnected.text')}
        testId="octorate-channels-not-connected"
        action={
          <Button type="button" size="sm" onClick={onBackToConsent}>
            {t('octorate.connect.channelsFound.notConnected.action')}
          </Button>
        }
      />
    );
  }

  if (listings.isPending || properties.isPending) {
    return <Working message={t('octorate.connect.channelsFound.loading')} testId="octorate-channels-loading" />;
  }
  if (listings.isError) {
    return (
      <StepProblem
        title={t('octorate.connect.channelsFound.loadFailed')}
        error={listings.error}
        onRetry={() => void listings.refetch()}
        testId="octorate-channels-error"
      />
    );
  }

  const found = forShortRent(listings.data, shortRentIdsOf(properties.data));
  const refreshButton = (
    <Button type="button" variant="outline" size="sm" loading={reading} onClick={readNow} data-testid="octorate-channels-refresh">
      <RefreshCw aria-hidden="true" className="size-4" />
      {t('octorate.connect.channelsFound.refresh')}
    </Button>
  );

  return (
    <div className="space-y-4" data-testid="octorate-channels-step">
      {reading && found.length === 0 ? <Working message={t('octorate.connect.channelsFound.reading')} testId="octorate-channels-reading" /> : null}
      {readFailed ? (
        <Alert variant="danger" data-testid="octorate-channels-read-failed">
          {getProblemMessage(readError, t) ?? t('octorate.connect.channelsFound.readFailed')}
        </Alert>
      ) : null}

      {found.length === 0 ? (
        reading ? null : (
          <StepNotice
            title={t('octorate.connect.channelsFound.empty.title')}
            text={t('octorate.connect.channelsFound.empty.text')}
            testId="octorate-channels-empty"
            action={refreshButton}
          />
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 font-medium" data-testid="octorate-channels-count">
              {t('octorate.connect.channelsFound.count', { count: found.length })}
            </p>
            {refreshButton}
          </div>
          <ul className="space-y-3" role="list">
            {found.map((listing) => {
              const details = detailsLine(listingAddress(listing), capacityText(listing.maxGuests, t));
              const hint = listingStateHint(listing, t);
              return (
                <li
                  key={listing.octorateAccommodationId}
                  className="space-y-3 rounded-lg border p-4"
                  data-testid={`octorate-channels-listing-${listing.octorateAccommodationId}`}
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words font-semibold">{listingName(listing, t)}</h3>
                      {details ? <p className="break-words text-sm text-muted-foreground">{details}</p> : null}
                    </div>
                    <ListingStateBadge listing={listing} />
                  </div>
                  {hint ? <p className="break-words text-sm">{hint}</p> : null}
                  <ChannelList listing={listing} />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
