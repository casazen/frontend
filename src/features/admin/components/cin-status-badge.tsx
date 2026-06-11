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
  const mapped = STATUS_MAP[status] ?? STATUS_MAP.missing;
  return <Badge variant={mapped.variant}>{mapped.label}</Badge>;
}
