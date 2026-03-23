import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface SyncAllDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
  platformCount?: number;
}

export function SyncAllDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  platformCount = 0,
}: SyncAllDialogProps) {
  const handleConfirm = async () => {
    await onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sync All Platforms</DialogTitle>
          <DialogDescription>
            This will synchronize bookings from all {platformCount} connected OTA platforms.
            This may take a few minutes.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="rounded-lg bg-muted p-4">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">What will happen:</p>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                  <li>• Fetch latest bookings from all platforms</li>
                  <li>• Update existing bookings if changed</li>
                  <li>• Create new bookings automatically</li>
                  <li>• Avoid duplicates with smart matching</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? 'Syncing...' : 'Start Sync'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
