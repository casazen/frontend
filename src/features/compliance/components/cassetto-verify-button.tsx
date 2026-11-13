import { useState } from 'react';
import type { TFunction } from 'i18next';
import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { HANDOFF_ERROR } from '@/api/compliance-handoff.api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { complianceArchiveErrorCode } from '@/api/compliance-archive.api';
import { getHttpStatus } from '@/lib/api-errors';
import { useStartCassettoHandoff } from '@/queries/compliance-handoff';
import type { CassettoHandoff, CassettoTopic } from '@/types';
import { formatPeriod } from '../lib/archive-model';
import { isSafeDestination, sameTabNavigation, useCassettoAvailable } from '../lib/cassetto';

interface CassettoVerifyButtonProps {
  topic: CassettoTopic;
  propertyId: string;
  /** The stay the check starts from, when it starts from a booking. */
  bookingId?: string | null;
  /** The month (`yyyy-MM`) or the day (`yyyy-MM-dd`) the check is about, when it is about a period. */
  period?: string | null;
  size?: 'default' | 'sm';
  variant?: 'default' | 'outline' | 'soft';
  /** The control stays still while something else of the same card is under way. */
  disabled?: boolean;
  testId?: string;
}

/**
 * «Verifica nel tuo Cassetto Compliance» (CHK-15): the one way from CasaZen to the area of the channel manager that holds an Alloggiati or ISTAT
 * outcome. It asks the server where to go (the address is never built here, and nothing is read from the channel manager), then opens a CasaZen
 * dialog that says which property, which stay or period, where to look and what to check, and only on «Continua la verifica» leaves, in the same tab:
 * no new window, no frame. Coming back is the browser's Back, which finds the same page and the same filters (the address of the page carries them).
 * It creates no proof, asks nobody to say it went well and changes no light. While the call is under way the button waits; when it fails the host
 * stays in CasaZen with the way to do it by hand and a retry.
 */
export function CassettoVerifyButton({ topic, propertyId, bookingId, period, size = 'sm', variant = 'outline', disabled = false, testId }: CassettoVerifyButtonProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const available = useCassettoAvailable();
  const start = useStartCassettoHandoff();
  const [handoff, setHandoff] = useState<CassettoHandoff | null>(null);

  if (!available) return null;

  const open = () => {
    setHandoff(null);
    start.mutate(
      {
        topic,
        propertyId,
        ...(bookingId ? { bookingId } : {}),
        ...(period ? { period } : {}),
        returnPath: `${location.pathname}${location.search}`,
      },
      { onSuccess: (prepared) => setHandoff(isSafeDestination(prepared.destinationUrl) ? prepared : null) },
    );
  };
  const refusedDestination = start.isSuccess && handoff === null;

  return (
    <div className="flex min-w-0 flex-col items-start gap-2">
      <Button
        type="button"
        size={size}
        variant={variant}
        loading={start.isPending}
        disabled={disabled}
        onClick={open}
        data-testid={testId ?? 'cassetto-verify'}
        className="min-h-11"
      >
        <ShieldCheck className="size-4" aria-hidden="true" />
        {t('complianceArchive.cassetto.verify')}
      </Button>

      {start.isError || refusedDestination ? (
        <Alert variant="warning" role="alert" data-testid="cassetto-verify-error" title={t('complianceArchive.cassetto.startFailedTitle')}>
          <p>{refusedDestination ? t('complianceArchive.cassetto.destinationUnavailable') : failureText(t, start.error)}</p>
          <p className="mt-1">{t('complianceArchive.cassetto.fallbackGuide')}</p>
        </Alert>
      ) : null}

      <Dialog open={handoff !== null} onOpenChange={(next) => !next && setHandoff(null)}>
        {handoff ? <CassettoDialogContent handoff={handoff} onCancel={() => setHandoff(null)} /> : null}
      </Dialog>
    </div>
  );
}

/** What went wrong, in plain words: the stay or property that is not the caller's, a property not connected, no destination, anything else. */
function failureText(t: TFunction, error: unknown): string {
  switch (complianceArchiveErrorCode(error)) {
    case HANDOFF_ERROR.targetNotFound:
      return t('complianceArchive.cassetto.targetNotFound');
    case HANDOFF_ERROR.propertyNotMapped:
      return t('complianceArchive.cassetto.propertyNotMapped');
    case HANDOFF_ERROR.destinationUnavailable:
      return t('complianceArchive.cassetto.destinationUnavailable');
    default:
      return getHttpStatus(error) === 404 ? t('complianceArchive.cassetto.notAvailable') : t('complianceArchive.cassetto.startFailed');
  }
}

function CassettoDialogContent({ handoff, onCancel }: { handoff: CassettoHandoff; onCancel: () => void }) {
  const { t, i18n } = useTranslation();
  const { context, guide } = handoff;
  const target = context.period
    ? { label: t('complianceArchive.cassetto.periodLabel'), value: formatPeriod(context.period, i18n.language) }
    : context.bookingCode
      ? { label: t('complianceArchive.cassetto.stayLabel'), value: context.bookingCode }
      : null;

  // The same tab: the address was checked by the server and by `isSafeDestination`, and nothing opens a window.
  const proceed = () => sameTabNavigation.to(handoff.destinationUrl);

  return (
    <DialogContent data-testid="cassetto-dialog" className="max-w-lg">
      <DialogHeader>
        <DialogTitle>{t('complianceArchive.cassetto.title')}</DialogTitle>
        <DialogDescription>{t(`complianceArchive.cassetto.intro.${handoff.topic}`)}</DialogDescription>
      </DialogHeader>

      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
        <dt className="text-muted-foreground">{t('complianceArchive.cassetto.propertyLabel')}</dt>
        <dd className="min-w-0 break-words font-medium">{context.propertyName}</dd>
        {target ? (
          <>
            <dt className="text-muted-foreground">{target.label}</dt>
            <dd className="min-w-0 break-words font-medium">{target.value}</dd>
          </>
        ) : null}
        {context.octorateListingName ? (
          <>
            <dt className="text-muted-foreground">{t('complianceArchive.cassetto.listingLabel')}</dt>
            <dd className="min-w-0 break-words font-medium">{context.octorateListingName}</dd>
          </>
        ) : null}
        <dt className="text-muted-foreground">{t('complianceArchive.cassetto.menuPathLabel')}</dt>
        <dd className="min-w-0 break-words">{guide.menuPath}</dd>
        <dt className="text-muted-foreground">{t('complianceArchive.cassetto.checkLabel')}</dt>
        <dd className="min-w-0 break-words">{guide.check}</dd>
      </dl>

      <details className="text-sm text-muted-foreground">
        <summary className="min-h-11 cursor-pointer py-3">{t('complianceArchive.cassetto.disclosureTitle')}</summary>
        <p className="pb-2">{t('complianceArchive.cassetto.disclosureBody')}</p>
      </details>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} data-testid="cassetto-cancel">
          {t('complianceArchive.cassetto.cancel')}
        </Button>
        <Button type="button" onClick={proceed} data-testid="cassetto-continue">
          {t('complianceArchive.cassetto.continue')}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
