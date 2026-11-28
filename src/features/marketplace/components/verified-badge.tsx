import { BadgeCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

export function VerifiedBadge() {
  const { t } = useTranslation();
  return (
    <Badge variant="success" className="shrink-0 gap-1" data-testid="marketplace-verified-badge">
      <BadgeCheck aria-hidden="true" className="size-3.5" />
      {t('marketplace.verified')}
    </Badge>
  );
}
