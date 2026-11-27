import { AlignedCard, CardTitle } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

interface AdminKpiCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
}

export function AdminKpiCard({ title, value, description, icon: Icon }: AdminKpiCardProps) {
  return (
    <AlignedCard rows={description ? 3 : 2}>
      <div className="mb-2 flex items-center justify-between gap-2 self-start">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon aria-hidden="true" className="size-9 shrink-0 rounded-lg bg-primary-soft p-2 text-primary-text" />
      </div>
      <div className="text-2xl font-bold tabular-nums tracking-tight lg:text-3xl">{value}</div>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
    </AlignedCard>
  );
}
