import { useTranslation } from 'react-i18next';

export function MrzPositionIllustration() {
  const { t } = useTranslation();

  return (
    <svg
      role="img"
      aria-label={t('checkin.identity.document.back.illustration')}
      viewBox="0 0 320 200"
      className="mx-auto h-auto w-full max-w-xs text-muted-foreground"
      data-testid="checkin-identity-mrz-illustration"
    >
      <rect x="4" y="4" width="312" height="192" rx="14" fill="none" stroke="currentColor" strokeWidth="3" />
      <rect x="22" y="22" width="64" height="44" rx="6" fill="currentColor" opacity="0.25" />
      <rect x="104" y="26" width="150" height="8" rx="4" fill="currentColor" opacity="0.25" />
      <rect x="104" y="44" width="190" height="8" rx="4" fill="currentColor" opacity="0.25" />
      <rect x="22" y="80" width="272" height="8" rx="4" fill="currentColor" opacity="0.2" />
      <rect x="22" y="98" width="220" height="8" rx="4" fill="currentColor" opacity="0.2" />
      <rect x="14" y="124" width="292" height="62" rx="8" fill="none" className="stroke-primary" strokeWidth="3" strokeDasharray="8 5" />
      <g fill="currentColor" opacity="0.8">
        <rect x="24" y="134" width="272" height="9" rx="2" />
        <rect x="24" y="149" width="272" height="9" rx="2" />
        <rect x="24" y="164" width="272" height="9" rx="2" />
      </g>
    </svg>
  );
}
