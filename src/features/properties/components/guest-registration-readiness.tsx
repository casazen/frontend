import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CircleCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TicinoStructureIdForm } from '@/features/compliance/ticino/ticino-structure-id-form';
import { getHttpStatus } from '@/lib/api-errors';
import { usePropertyDetail } from '@/queries/use-properties';
import { missingTextKey } from '../lib/guest-registration-model';
import { RefreshFailedNotice } from './guest-registration-notice';

interface GuestRegistrationReadinessProps {
  propertyId: string;
  /** What the property still lacks, as the server lists it (`swiss_municipality_missing`, `ticino_structure_id_missing`); empty when nothing is. */
  missing: readonly string[];
  /** The property is in Ticino: its notification starts with the structure number, so the field is here. */
  ticino: boolean;
  /** `property.write`: the number can be changed and the way to the municipality is offered. */
  canWrite: boolean;
  /** Another change of the same card is on its way: nothing here can be pressed until it is over. */
  busy?: boolean;
  /** Told with `true` while the structure number is being saved and with `false` when it is over, so the rest of the card waits for it. */
  onPendingChange?: (pending: boolean) => void;
  /** A wizard sends the host to its own step where the municipality is set, without leaving the process. */
  onFixMunicipality?: () => void;
  /** A page opens the form of the property, where the municipality is set. A wizard that has no such step offers neither. */
  municipalityHref?: string;
  /** After the structure number is saved (the activation reads its steps again). */
  onSaved?: () => void;
}

/**
 * What a Swiss property still lacks to be notified, and the field of the structure number of Ticino (E29/F02/US02/T01, NF-129): the same rule as the activation of the
 * property, the onboarding part and `identifierMissing` of the card. Each missing item is told as «to complete», never as a success; the field waits for the number the
 * property has, so a number that is stored is never replaced by an empty one.
 */
export function GuestRegistrationReadiness({
  propertyId,
  missing,
  ticino,
  canWrite,
  busy = false,
  onPendingChange,
  onFixMunicipality,
  municipalityHref,
  onSaved,
}: GuestRegistrationReadinessProps) {
  const { t } = useTranslation();
  // Where the municipality is set: a wizard keeps the host inside its own step, a page opens the form of the property; who may not write is offered neither.
  const fixMunicipality = !canWrite ? null : onFixMunicipality ? (
    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onFixMunicipality} data-testid="guest-registration-fix-municipality">
      {t('guestRegistration.missing.fixMunicipality')}
    </Button>
  ) : municipalityHref ? (
    <Button asChild variant="outline" size="sm">
      <Link to={municipalityHref} data-testid="guest-registration-fix-municipality">
        {t('guestRegistration.missing.fixMunicipality')}
      </Link>
    </Button>
  ) : null;

  return (
    <div className="space-y-3" data-testid="guest-registration-readiness">
      {missing.length > 0 ? (
        <div className="space-y-2" data-testid="guest-registration-missing">
          <h3 className="text-sm font-semibold">{t('guestRegistration.missing.title')}</h3>
          <ul className="space-y-2">
            {missing.map((code) => (
              <li key={code} data-code={code} className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1 text-sm">
                <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
                <span className="min-w-0 flex-1 break-words">{t(missingTextKey(code))}</span>
                {code === 'swiss_municipality_missing' ? fixMunicipality : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {ticino ? (
        <StructureIdBlock propertyId={propertyId} canWrite={canWrite} busy={busy} onPendingChange={onPendingChange} onSaved={onSaved} />
      ) : null}
    </div>
  );
}

interface StructureIdBlockProps {
  propertyId: string;
  canWrite: boolean;
  busy: boolean;
  onPendingChange?: (pending: boolean) => void;
  onSaved?: () => void;
}

/** The number of the structure: the field for who may write, its value for who may not. It reads what the property has first, and says so when it cannot. */
function StructureIdBlock({ propertyId, canWrite, busy, onPendingChange, onSaved }: StructureIdBlockProps) {
  const { t } = useTranslation();
  const detail = usePropertyDetail(propertyId);

  // A read that failed is not the old answer: TanStack Query keeps the data it had. What the server says about the property (404, 403), or no number to show at all, is told as a failure
  // and replaces the field. A refresh that did not work (the network, a 5xx) with the number on screen does not: the field stays with what is being typed, and a notice says that what is
  // shown may not be up to date.
  const status = detail.isError ? getHttpStatus(detail.error) : undefined;
  if (detail.isError && (!detail.data || status === 404 || status === 403)) {
    return (
      <div className="space-y-2" role="alert" data-testid="guest-registration-structure-error">
        <p className="text-sm text-destructive">{t('guestRegistration.card.loadFailed')}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void detail.refetch()}>
          {t('guestRegistration.card.retry')}
        </Button>
      </div>
    );
  }
  if (!detail.data) {
    return (
      <p className="text-sm text-foreground/70" role="status" data-testid="guest-registration-structure-loading">
        {t('guestRegistration.structureId.loading')}
      </p>
    );
  }

  const notice = detail.isError ? (
    <RefreshFailedNotice testId="guest-registration-structure-refresh-error" retrying={detail.isFetching} onRetry={() => void detail.refetch()} />
  ) : null;
  const stored = detail.data.ticinoStructureId ?? null;
  if (!canWrite) {
    return (
      <>
        {notice}
        <p className="flex items-start gap-2 text-sm" data-testid="guest-registration-structure-value">
          {stored ? <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success-foreground" /> : null}
          <span>{stored ? t('guestRegistration.structureId.value', { value: stored }) : t('swiss.property.noId')}</span>
        </p>
      </>
    );
  }

  // The form starts from the number the property has: it is made again only when that number changes under it (saved, or changed on another device), never while it is typed in.
  return (
    <>
      {notice}
      <fieldset disabled={busy} className="min-w-0 border-0 p-0" data-testid="guest-registration-structure">
        <TicinoStructureIdForm key={stored ?? ''} propertyId={propertyId} value={stored} onSaved={onSaved} onPendingChange={onPendingChange} />
      </fieldset>
    </>
  );
}
