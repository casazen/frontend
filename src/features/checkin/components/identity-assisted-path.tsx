import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface AssistedPathProps {
  busy: boolean;
  /** The guest asks for a person (GDPR art. 22): the operators are told and the step is over for the guest. */
  onChoose: () => void;
}

/**
 * The way to a person on every sub-step of the self-hosted identity step (E70/F03/US01/T01, NF-188, GDPR art. 22): a secondary button under the document and under the selfie, so that the guest who changes their
 * mind, or whose browser does not do what the step asks, never has to look for it. It is the same request the screens of a refusal and of a retry make; the automatic check is a choice, not a duty.
 */
export function AssistedPathButton({ busy, onChoose }: AssistedPathProps) {
  const { t } = useTranslation();

  return (
    <div className="border-t pt-4" data-testid="checkin-identity-assisted">
      <Button type="button" size="lg" variant="outline" disabled={busy} onClick={onChoose} data-testid="checkin-identity-assisted-path">
        {t('checkin.identity.choice.assisted.switch')}
      </Button>
    </div>
  );
}

/**
 * What the guest sees at a step of the API this page has no screen for (`presence` before the capture of the presence reaches the page, or a step of the future): the way to a person, in words, instead of a
 * blank screen. The step cannot be left any other way, so the button is the main one here.
 */
export function UnsupportedIdentityStep({ busy, onChoose }: AssistedPathProps) {
  const { t } = useTranslation();
  const titleId = useId();

  return (
    <section className="space-y-4" aria-labelledby={titleId} data-testid="checkin-identity-unsupported">
      <h4 id={titleId} className="text-base font-semibold">
        {t('checkin.identity.unsupported.title')}
      </h4>
      <p className="text-sm">{t('checkin.identity.unsupported.text')}</p>
      <Button type="button" size="lg" disabled={busy} loading={busy} onClick={onChoose} data-testid="checkin-identity-unsupported-ask">
        {t('checkin.identity.choice.assisted.label')}
      </Button>
    </section>
  );
}
