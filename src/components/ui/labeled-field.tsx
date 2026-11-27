import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

/** A label tied to its control (`htmlFor`), with the control under it. The full form field (hint, error, "optional") is `Field`. */
export function LabeledField({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
