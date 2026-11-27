import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { WIZARD_LINK_CLASS } from '../../components/wizard-frame';
import { CHANNELS_PAGE_PATH } from '../../lib/marketplace-paths';
import { licensedProblemOf } from '../licensed-request-model';

interface LicenseProblemProps {
  /** What stopped the read of the license of the property. */
  error: unknown;
  /** Reads it again. */
  onRetry: () => void;
}

/**
 * What a read of the license that failed says, in simple words and never as a raw error: a property with no confirmed listing on the channel manager, or an
 * organization whose channel manager is not connected, leads to the Channels page (the connect and mapping wizard starts there, the one place besides the
 * Marketplace this wizard lets the person go to); anything else can be tried again.
 */
export function LicenseProblem({ error, onRetry }: LicenseProblemProps) {
  const { t } = useTranslation();
  const problem = licensedProblemOf(error);

  if (problem === 'notLinked' || problem === 'notConnected') {
    return (
      <Alert variant="warning" data-testid={problem === 'notLinked' ? 'licensed-not-linked' : 'licensed-not-connected'}>
        <p>{t(problem === 'notLinked' ? 'marketplace.licensed.problem.notLinked' : 'marketplace.licensed.problem.notConnected')}</p>
        <Link to={CHANNELS_PAGE_PATH} className={WIZARD_LINK_CLASS} data-testid="licensed-channels-link">
          {t(problem === 'notLinked' ? 'marketplace.licensed.problem.notLinkedLink' : 'marketplace.licensed.problem.notConnectedLink')}
        </Link>
      </Alert>
    );
  }

  return (
    <Alert
      variant="danger"
      data-testid="licensed-read-error"
      action={
        <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={onRetry}>
          {t('marketplace.licensed.problem.retry')}
        </Button>
      }
    >
      {t('marketplace.licensed.problem.generic')}
    </Alert>
  );
}
