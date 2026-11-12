import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ChoosePropertyFirstProps {
  /** Goes back to the step where the properties are chosen. */
  onChoose: () => void;
}

/**
 * What a step says when the wizard is opened on it with no property chosen (an address typed by hand, a draft that was dropped): the way to the step
 * where they are chosen, inside the wizard. Nothing is asked of the server for no property.
 */
export function ChoosePropertyFirst({ onChoose }: ChoosePropertyFirstProps) {
  const { t } = useTranslation();

  return (
    <Alert
      variant="info"
      data-testid="activation-choose-first"
      action={
        <Button type="button" size="sm" className="min-h-11" onClick={onChoose} data-testid="activation-choose-first-button">
          {t('marketplace.activation.chooseFirst.action')}
        </Button>
      }
    >
      {t('marketplace.activation.chooseFirst.text')}
    </Alert>
  );
}
