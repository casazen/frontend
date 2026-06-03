import { Badge } from '@/components/ui/badge';

interface CinStatusBadgeProps {
  status: 'valid' | 'missing' | 'invalid';
}

const STATUS_MAP: Record<
  CinStatusBadgeProps['status'],
  { label: string; variant: 'default' | 'secondary' | 'destructive' }
> = {
  valid: { label: 'Valido', variant: 'default' },
  missing: { label: 'Mancante', variant: 'secondary' },
  invalid: { label: 'Non valido', variant: 'destructive' },
};

export function CinStatusBadge({ status }: CinStatusBadgeProps) {
  const { label, variant } = STATUS_MAP[status];
  return <Badge variant={variant}>{label}</Badge>;
}
