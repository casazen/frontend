import { useTranslation } from 'react-i18next';

/** A line the layer says in place of its content (the day, the register), with nothing asked of the server, read out as an alert. `textKey` is an i18n key written out where the layer uses it. */
export function LayerNotice({ textKey, testId }: { textKey: string; testId: string }) {
  const { t } = useTranslation();
  return (
    <p role="alert" className="text-sm text-foreground/70" data-testid={testId}>
      {t(textKey)}
    </p>
  );
}
