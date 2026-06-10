import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CinStatus } from '@/types';

interface PropertyCinDialogProps {
  propertyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cinStatus: CinStatus;
  cinCode?: string | null;
  onSave: (cinCode: string | null) => Promise<void>;
  isSaving?: boolean;
}

export function PropertyCinDialog({
  open,
  onOpenChange,
  cinStatus,
  cinCode,
  onSave,
  isSaving,
}: PropertyCinDialogProps) {
  const [value, setValue] = useState(cinCode ?? '');

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setValue(cinCode ?? '');
    }
    onOpenChange(next);
  };

  const handleSave = async () => {
    const trimmed = value.trim();
    await onSave(trimmed.length > 0 ? trimmed : null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Codice CIN</DialogTitle>
          <DialogDescription>
            Inserisci il Codice Identificativo Nazionale (formato IT-XXXXX-XXXXXXXXXX) per la
            conformità BDSR (D.L. 145/2023).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="cin-code">Codice CIN</Label>
          <Input
            id="cin-code"
            value={value}
            onChange={(e) => setValue(e.target.value.toUpperCase())}
            placeholder="IT-12345-6789012345"
            aria-invalid={cinStatus === 'Invalid'}
          />
          <p className="text-xs text-muted-foreground">
            Lascia vuoto per rimuovere il CIN registrato.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Salvataggio...' : 'Salva CIN'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
