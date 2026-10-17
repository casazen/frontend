import { AlignedCard, CardTitle } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

interface AdminKpiCardProps {
  title: string;
  value: string | number;
  /** A line under the number. Give one to all the cards of a grid or to none: they line up row by row, so they need the same rows. */
  description?: string;
  icon: LucideIcon;
}

/**
 * A number of the admin dashboard. The card is a subgrid of its grid (`AlignedCard`): the title, the number and the line under it
 * are rows, so a title on two lines moves the number of all the cards of its row alike, not of its own card only.
 */
export function AdminKpiCard({ title, value, description, icon: Icon }: AdminKpiCardProps) {
  return (
    <AlignedCard rows={description ? 3 : 2}>
      {/* `self-start`: in a row as tall as the longest title, a shorter title stays at the top, as the first line of the others. */}
      <div className="mb-2 flex items-center justify-between self-start">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
    </AlignedCard>
  );
}
