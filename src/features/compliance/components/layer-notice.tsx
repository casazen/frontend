import { useTranslation } from 'react-i18next';

export function LayerNotice({ textKey, testId }: { textKey: string; testId: string }) {
  const { t } = useTranslation();
  return (
    <p role="alert" className="text-sm text-foreground/70" data-testid={testId}>
      {t(textKey)}
    </p>
  );
}
