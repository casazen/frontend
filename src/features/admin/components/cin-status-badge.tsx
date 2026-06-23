import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';

interface CinStatusBadgeProps {
  status: 'valid' | 'missing' | 'invalid';
}

const STATUS_VARIANT: Record<
  CinStatusBadgeProps['status'],
  'default' | 'secondary' | 'destructive'
> = {
  valid: 'default',
  missing: 'secondary',
  invalid: 'destructive',
};

export function CinStatusBadge({ status }: CinStatusBadgeProps) {
  const { t } = useTranslation();
  const variant = STATUS_VARIANT[status] ?? 'secondary';
  return <Badge variant={variant}>{t(`admin.badges.cin.${status}`)}</Badge>;
}
