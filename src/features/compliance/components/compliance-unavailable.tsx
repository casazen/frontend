import { useTranslation } from 'react-i18next';
import { FocusBlock } from '@/components/shared/calm';

interface ComplianceUnavailableProps {
  /** The heading of the card that asked ("Cosa succede ora", "Cosa fare ora"). */
  kicker: string;
  onRetry: () => void;
  retrying: boolean;
  /** The test id of the card, which the block keeps: its `data-next-step` says `complianceUnavailable`. */
  testId: string;
}

/**
 * What a card of «Cosa succede ora» says when the lights of the compliance could not be read (a 5xx, the network, a 403; a 404 is the traffic light off,
 * and then the card is what it always was): that it does not know, and a button to try again. Never «tutto in ordine»: a state that is not complete is
 * told as such, not as a success (NF-52).
 */
export function ComplianceUnavailable({ kicker, onRetry, retrying, testId }: ComplianceUnavailableProps) {
  const { t } = useTranslation();

  return (
    <FocusBlock
      data-testid={testId}
      data-next-step="complianceUnavailable"
      tone="neutral"
      kicker={kicker}
      title={t('compliance.lines.unavailable.title')}
      body={t('compliance.lines.unavailable.body')}
      primary={{ label: t('shared.errorState.retry'), onClick: onRetry, loading: retrying, testId: `${testId}-retry` }}
    />
  );
}
