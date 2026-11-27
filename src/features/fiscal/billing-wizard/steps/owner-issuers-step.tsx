import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SkeletonCard } from '@/components/ui/skeleton';
import { OwnerAccountingError } from '@/features/owner-accounting/components/owner-accounting-error';
import { shortId } from '@/features/owner-accounting/owner-accounting-model';
import { OwnerIssuerProfileForm } from '@/features/owners/components/owner-issuer-profile-form';
import { isItalianProfile, issuerStateOf, missingFieldsOf } from '@/features/owners/owner-issuer-model';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { useOwnerNames } from '@/queries/use-owner-accounting';
import { OwnerDataMaskedError, useCreateOwnerIssuerFromOwnerData, useOwnerIssuerProfile } from '@/queries/use-owner-issuer-profile';
import type { OwnerIssuerProfile, PropertyOwnerSummary } from '@/types';

const VISIBLE_OWNERS = 20;

const nameOf = (owner: PropertyOwnerSummary, unnamed: (id: string) => string): string => `${owner.firstName} ${owner.lastName}`.trim() || unnamed(shortId(owner.id));

interface OwnerIssuersStepProps {
  missing: number;
}

/**
 * Step «Proprietari che emettono» (E17/F03/US01/T01, NF-116, NF-118, only for an agency whose Italian owners issue the documents of their stays): in Italy the owner of a property issues the document of the stay
 * (a receipt for a private owner, an invoice for a company), so each owner needs an issuer profile with its data and its own sezionale. The step lists the owners of the registry with where each one stands
 * (no profile, a profile that misses something and what, a profile that can issue), makes the profile from what CasaZen already knows of the owner («Crea dai dati del proprietario») and opens the same form of
 * the owner page in a layer to complete it, so the person never leaves the wizard. How many owners still miss one is the count of the billing setup: a missing item of this step reopens it. A row that could not
 * be read says so (with a retry), never «no profile»; the person who may not change a profile reads it and finds no button.
 */
export function OwnerIssuersStep({ missing }: OwnerIssuersStepProps) {
  const { t } = useTranslation();
  const owners = useOwnerNames();
  const [showAll, setShowAll] = useState(false);

  let list;
  if (owners.isPending) {
    list = <SkeletonCard lines={3} label={t('billingWizard.ownerIssuers.loading')} />;
  } else if (owners.isError || !owners.data || getHttpStatus(owners.error) === 404) {
    list = <OwnerAccountingError error={owners.error} title={t('billingWizard.ownerIssuers.loadError')} onRetry={() => void owners.refetch()} />;
  } else if (owners.data.length === 0) {
    list = (
      <p className="break-words text-sm text-foreground/70" data-testid="billing-owner-issuers-empty">
        {t('billingWizard.ownerIssuers.empty')}
      </p>
    );
  } else {
    const shown = showAll ? owners.data : owners.data.slice(0, VISIBLE_OWNERS);
    list = (
      <>
        <ul role="list" className="divide-y divide-border" data-testid="billing-owner-issuers-list">
          {shown.map((owner) => (
            <OwnerIssuerRow key={owner.id} owner={owner} />
          ))}
        </ul>
        {owners.data.length > VISIBLE_OWNERS ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll((current) => !current)} data-testid="billing-owner-issuers-show-all">
            {showAll ? t('billingWizard.ownerIssuers.showLess') : t('billingWizard.ownerIssuers.showAll', { count: owners.data.length })}
          </Button>
        ) : null}
      </>
    );
  }

  return (
    <>
      <p className="text-sm text-foreground/80">{t('billingWizard.ownerIssuers.intro')}</p>
      {missing > 0 ? (
        <Alert variant="warning" data-testid="billing-owner-issuers-missing">
          {t('billingWizard.ownerIssuers.missing', { count: missing })}
        </Alert>
      ) : (
        <Alert variant="success" data-testid="billing-owner-issuers-complete">
          {t('billingWizard.ownerIssuers.complete')}
        </Alert>
      )}
      {list}
      <p className="text-sm text-foreground/70">{t('billingWizard.ownerIssuers.note')}</p>
    </>
  );
}

function OwnerIssuerRow({ owner }: { owner: PropertyOwnerSummary }) {
  const { t } = useTranslation();
  const profile = useOwnerIssuerProfile(owner.id);
  const create = useCreateOwnerIssuerFromOwnerData(owner);
  const [editing, setEditing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const name = nameOf(owner, (id) => t('ownerAccounting.owner.unnamed', { id }));
  const gone = getHttpStatus(profile.error) === 404;
  const data = profile.isError ? undefined : profile.data;
  // The form in the layer follows the last answer that was read, even if a later read failed (a read that fails does not take the form from under the person's hands), but never the one of a profile that is not found.
  const editable = gone ? undefined : profile.data;
  const state = data ? issuerStateOf(data) : null;
  const missingFields = data ? missingFieldsOf(data) : [];

  const createFromData = async () => {
    setProblem(null);
    try {
      const saved = await create.mutateAsync();
      toast.success(saved.canIssue ? t('billingWizard.ownerIssuers.row.createdReady', { owner: name }) : t('billingWizard.ownerIssuers.row.createdIncomplete', { owner: name }));
    } catch (error) {
      setProblem(error instanceof OwnerDataMaskedError ? t('billingWizard.ownerIssuers.row.masked') : (getProblemMessage(error, t) ?? t('billingWizard.ownerIssuers.row.createFailed')));
    }
  };

  let status;
  if (gone) {
    status = <span data-testid="billing-owner-issuer-gone">{t('billingWizard.ownerIssuers.row.gone')}</span>;
  } else if (profile.isPending) {
    status = <span>{t('billingWizard.ownerIssuers.row.loading')}</span>;
  } else if (profile.isError || data === undefined) {
    status = (
      <span role="alert" data-testid="billing-owner-issuer-error">
        {t('billingWizard.ownerIssuers.row.error')}{' '}
        <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => void profile.refetch()}>
          {t('shared.errorState.retry')}
        </Button>
      </span>
    );
  } else if (data === null) {
    status = <span data-testid="billing-owner-issuer-not-for-you">{t('billingWizard.ownerIssuers.row.notForYou')}</span>;
  } else {
    status = <OwnerIssuerStateBadge profile={data} />;
  }

  const canChange = data !== null && data !== undefined && !data.masked && isItalianProfile(data);
  const busy = create.isPending;

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between" data-testid="billing-owner-issuer-row" data-owner={owner.id} data-state={state ?? undefined}>
      <div className="min-w-0 space-y-1">
        <h3 className="break-words text-base font-semibold" data-testid="billing-owner-issuer-name">
          {name}
        </h3>
        <div className="break-words text-sm text-foreground/70">{status}</div>
        {data && state === 'incomplete' ? (
          <p className="break-words text-sm text-foreground/70" data-testid="billing-owner-issuer-missing-fields">
            {missingFields.length > 0 ? t('billingWizard.ownerIssuers.row.missing', { fields: missingFields.map((field) => t(`ownerIssuer.fields.${field}.label`)).join(', ') }) : t('billingWizard.ownerIssuers.row.missingUnknown')}
          </p>
        ) : null}
        {problem ? (
          <p role="alert" className="break-words text-sm text-destructive" data-testid="billing-owner-issuer-problem">
            {problem}
          </p>
        ) : null}
      </div>
      {canChange && data ? (
        <div className="flex flex-wrap items-center gap-2 self-start">
          {state === 'none' ? (
            <Button type="button" size="sm" loading={create.isPending} disabled={busy} onClick={() => void createFromData()} aria-label={t('billingWizard.ownerIssuers.row.createLabel', { owner: name })} data-testid="billing-owner-issuer-create">
              {t('billingWizard.ownerIssuers.row.create')}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant={state === 'none' ? 'outline' : state === 'incomplete' ? 'default' : 'outline'}
            disabled={busy}
            onClick={() => setEditing(true)}
            aria-label={t(state === 'none' ? 'billingWizard.ownerIssuers.row.fillLabel' : state === 'incomplete' ? 'billingWizard.ownerIssuers.row.completeLabel' : 'billingWizard.ownerIssuers.row.editLabel', { owner: name })}
            data-testid="billing-owner-issuer-open"
          >
            {t(state === 'none' ? 'billingWizard.ownerIssuers.row.fill' : state === 'incomplete' ? 'billingWizard.ownerIssuers.row.complete' : 'billingWizard.ownerIssuers.row.edit')}
          </Button>
        </div>
      ) : null}
      {editing && editable ? <OwnerIssuerDialog ownerId={owner.id} ownerName={name} profile={editable} onClose={() => setEditing(false)} /> : null}
    </li>
  );
}

function OwnerIssuerStateBadge({ profile }: { profile: OwnerIssuerProfile }) {
  const { t } = useTranslation();
  const state = issuerStateOf(profile);
  return (
    <Badge variant={state === 'ready' ? 'success' : state === 'incomplete' ? 'warning' : 'outline'} data-testid="billing-owner-issuer-state" data-state={state}>
      {t(`billingWizard.ownerIssuers.row.state.${state}`)}
    </Badge>
  );
}

interface OwnerIssuerDialogProps {
  ownerId: string;
  ownerName: string;
  profile: OwnerIssuerProfile;
  onClose: () => void;
}

function OwnerIssuerDialog({ ownerId, ownerName, profile, onClose }: OwnerIssuerDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" data-testid="billing-owner-issuer-dialog">
        <DialogHeader>
          <DialogTitle>{t('billingWizard.ownerIssuers.dialog.title', { owner: ownerName })}</DialogTitle>
          <DialogDescription>{t('billingWizard.ownerIssuers.dialog.description')}</DialogDescription>
        </DialogHeader>
        <OwnerIssuerProfileForm ownerId={ownerId} profile={profile} onSaved={onClose} onCancel={onClose} />
      </DialogContent>
    </Dialog>
  );
}
