import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ChoosePropertyFirstProps {
  onChoose: () => void;
}

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
