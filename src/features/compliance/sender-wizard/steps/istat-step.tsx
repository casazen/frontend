import { useId, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IstatCoverageNotice } from '@/features/compliance/components/istat-coverage-notice';
import { IstatCredentialsFields } from '@/features/compliance/components/istat-credentials-fields';
import type { IstatCredentialsErrors, IstatCredentialsField } from '@/features/compliance/components/istat-credentials-form';
import type { SetIstatCredentialsRequest } from '@/types/onboarding.types';

/** What the ISTAT part needs to show the regional ISTAT credentials: they are the same kind of thing as the police ones, and are held by the wizard in the same way. */
export interface IstatCredentialsStepProps {
  configured: boolean | null;
  /** What was typed: it lives in the wizard, like the police credentials, so that the main button of the wizard can save it and a change of step does not lose it. */
  values: SetIstatCredentialsRequest;
  errors: IstatCredentialsErrors;
  onChange: (field: IstatCredentialsField, value: string) => void;
  /** Sends the typed ISTAT credentials once (`PUT /properties/{id}/istat-credentials`): the button of the block and the Enter key. */
  onSave: () => void;
}

interface IstatStepProps {
  propertyId: string;
  istat: IstatCredentialsStepProps;
  busy: boolean;
  /** Enter in a field saves the credentials of the block (it never submits the form of the wizard, which would go on to the next step with them left behind). */
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

/**
 * The ISTAT part of the wizard (E20/F03/US02/T01, E21/F01/US02/T01): the regional ISTAT credentials, which CasaZen support opens only on a request of the host to link the ISTAT in the panel of
 * its channel manager. It starts with what the table says of the region of the property, before any credential is asked: whether the channel manager sends the ISTAT of the region (it is of no use to
 * save credentials for a link that the channel manager does not make), the deadline and the one thing to do next. What is typed is held by the wizard in its state only (see `CredentialsStep`).
 */
export function IstatStep({ propertyId, istat, busy, onKeyDown }: IstatStepProps) {
  const { t } = useTranslation();
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-4 border-t pt-4" data-testid="sender-istat-credentials">
      <div className="space-y-1">
        <h3 id={titleId} className="text-base font-semibold">
          {t('compliance.sender.credentials.istat.title')}
        </h3>
        <p className="text-sm text-foreground/70">{t('compliance.sender.credentials.istat.why')}</p>
      </div>

      <IstatCoverageNotice propertyId={propertyId} inWizard />

      {istat.configured !== null ? (
        <p className="flex items-center gap-2 text-sm" data-testid="sender-istat-status" data-configured={istat.configured}>
          {istat.configured ? (
            <>
              <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-success-foreground" />
              {t('compliance.sender.credentials.istat.saved')}
            </>
          ) : (
            <>
              <KeyRound aria-hidden="true" className="size-4 shrink-0" />
              {t('compliance.sender.credentials.istat.notSaved')}
            </>
          )}
        </p>
      ) : null}

      <div className="@container min-w-0 space-y-3" data-testid="sender-istat-fields" onKeyDown={onKeyDown}>
        <IstatCredentialsFields values={istat.values} errors={istat.errors} onChange={istat.onChange} disabled={busy} />
        <p className="text-xs text-muted-foreground">{t('istatCredentials.writeOnlyHint')}</p>
        <Button type="button" variant="outline" disabled={busy} onClick={istat.onSave} data-testid="sender-istat-save">
          {istat.configured ? t('istatCredentials.replace') : t('istatCredentials.save')}
        </Button>
      </div>
    </section>
  );
}
