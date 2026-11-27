import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

export function LabeledField({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
