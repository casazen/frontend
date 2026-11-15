import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Hourglass } from 'lucide-react';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeleton';
import { shortId } from '@/features/owner-accounting/owner-accounting-model';
import { useOwnerNames } from '@/queries/use-owner-accounting';
import { useSdiIssuers } from '@/queries/use-fiscal-documents';
import { useCurrentUser } from '@/queries/use-users';
import type { PropertyOwnerSummary, SdiIssuerRegistration } from '@/types';
import { sdiConnectionOf } from '../billing-wizard-model';

interface SdiStepProps {
  /** The organization is on the agency plan and the person is its administrator: the owners are theirs to read (anyone else is refused the registry, so nothing is asked). */
  agency: boolean;
}

/** The registration of an issuer at the channel, in a word with the colour of the state: the word says it to everyone and the colour at a glance. */
function RegistrationBadge({ state }: { state: string }) {
  const { t, i18n } = useTranslation();
  const known = i18n.exists(`billingWizard.sdi.registration.${state}.label`);
  return (
    <Badge variant={state === 'registered' ? 'success' : state === 'pending' ? 'warning' : 'outline'} data-testid="billing-sdi-registration" data-state={state}>
      {known ? t(`billingWizard.sdi.registration.${state}.label`) : t('billingWizard.sdi.registration.other', { state })}
    </Badge>
  );
}

/**
 * Step «Invio allo SDI» (E17/F03/US01/T02, NF-116, D13, only for an Italian issuer while the sending to the SDI is on): how the electronic invoices reach the SDI. It reads and sets nothing: the state of the
 * connection is the server's, in one of three ways: CONNECTED (a channel is connected: the invoices go by themselves and the answers come back), WAITING FOR THE CREDENTIALS (the sending is on and the channel
 * has no credentials yet: the invoices wait «da inviare», and the issuer uploads the XML by hand to the portal of the tax agency and declares it), and, for each issuer with a VAT number (the organization, and every
 * owner who issues), where its registration at the channel stands (registered, waiting for the channel to enable its VAT number, or not asked yet): a registration that waits is nothing the person has to do. A read
 * that failed is told as such, with a retry, and never as «connected». The texts never name the channel.
 */
export function SdiStep({ agency }: SdiStepProps) {
  const { t } = useTranslation();
  const issuers = useSdiIssuers(true);
  const owners = useOwnerNames(agency);
  const { org } = useCurrentUser();

  if (issuers.isPending) return <SkeletonCard lines={3} label={t('billingWizard.sdi.loading')} />;
  // A failed read keeps the old answer: the connection is never told from data that is no longer the server's.
  if (issuers.isError || !issuers.data) return <ErrorState title={t('billingWizard.sdi.loadError')} error={issuers.error} onRetry={() => void issuers.refetch()} testId="billing-sdi-error" />;

  const { providerConfigured, issuers: list } = issuers.data;
  const connection = sdiConnectionOf({ providerConfigured, sendingOn: true });
  const nameOf = (issuer: SdiIssuerRegistration): string => {
    if (issuer.propertyOwnerId === null) return org?.name?.trim() || t('billingWizard.sdi.issuers.organization');
    const owner: PropertyOwnerSummary | undefined = owners.data?.find((candidate) => candidate.id === issuer.propertyOwnerId);
    return (owner ? `${owner.firstName} ${owner.lastName}`.trim() : '') || t('ownerAccounting.owner.unnamed', { id: shortId(issuer.propertyOwnerId) });
  };

  return (
    <>
      <p className="text-sm text-foreground/80">{t('billingWizard.sdi.intro')}</p>

      {connection === 'connected' ? (
        <Alert variant="success" icon={CheckCircle2} title={t('billingWizard.sdi.state.connected.title')} data-testid="billing-sdi-connection" data-connection={connection}>
          {t('billingWizard.sdi.state.connected.body')}
        </Alert>
      ) : (
        <Alert variant="info" icon={Hourglass} title={t('billingWizard.sdi.state.waitingCredentials.title')} data-testid="billing-sdi-connection" data-connection={connection}>
          {t('billingWizard.sdi.state.waitingCredentials.body')}
        </Alert>
      )}

      <section className="space-y-2" aria-labelledby="billing-sdi-issuers-title">
        <h3 id="billing-sdi-issuers-title" className="text-sm font-semibold">
          {t('billingWizard.sdi.issuers.title')}
        </h3>
        {list.length === 0 ? (
          <p className="break-words text-sm text-foreground/70" data-testid="billing-sdi-issuers-empty">
            {t('billingWizard.sdi.issuers.empty')}
          </p>
        ) : (
          <ul role="list" className="divide-y divide-border" data-testid="billing-sdi-issuers">
            {list.map((issuer) => (
              <li key={issuer.issuerProfileId} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between" data-testid="billing-sdi-issuer" data-state={issuer.state}>
                <div className="min-w-0 space-y-1">
                  <p className="break-words font-medium" data-testid="billing-sdi-issuer-name">
                    {nameOf(issuer)}
                  </p>
                  <p className="break-words text-sm text-foreground/70">{registrationText(t, issuer.state)}</p>
                </div>
                <RegistrationBadge state={issuer.state} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm text-foreground/70">{t('billingWizard.sdi.note')}</p>
    </>
  );
}

/** What a registration state means, in one sentence; a state this client does not know (the server is newer) says nothing that is not true. */
function registrationText(t: TFunction, state: string): string {
  return state === 'registered' || state === 'pending' || state === 'unknown' ? t(`billingWizard.sdi.registration.${state}.text`) : t('billingWizard.sdi.registration.otherText');
}
