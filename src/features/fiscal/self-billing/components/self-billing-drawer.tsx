import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { SelfBillingListItem } from '@/types';
import { DrawerBody } from './self-billing-drawer-body';

interface DrawerProps {
  id: string | null;
  onClose: () => void;
  mayCorrect: boolean;
  mayClose: boolean;
  closedIds: ReadonlySet<string>;
  onCorrect: (item: SelfBillingListItem) => void;
  onCloseNotDue: (item: SelfBillingListItem) => void;
  onRedoDrafts: (year: number, month: number) => void;
  onOpenReplacement: (id: string) => void;
}

/**
 * The detail of a TD17 in a drawer: the lines and the totals, the review before the issue and the issue, the discard of a draft, the correction of a rejected one, the closing of a kept replacement, and for an issued one its
 * files and its state towards the SDI. The original a correction discarded is history here too: «Sostituita», with the way to its replacement and no other action; so is a draft closed as «non più dovuta».
 */
export function SelfBillingDrawer({ id, onClose, mayCorrect, mayClose, closedIds, onCorrect, onCloseNotDue, onRedoDrafts, onOpenReplacement }: DrawerProps) {
  const { t } = useTranslation();
  return (
    <Sheet open={id !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl" data-testid="self-billing-drawer">
        {id !== null ? (
          <DrawerBody
            key={id}
            id={id}
            onClose={onClose}
            mayCorrect={mayCorrect}
            mayClose={mayClose}
            closedIds={closedIds}
            onCorrect={onCorrect}
            onCloseNotDue={onCloseNotDue}
            onRedoDrafts={onRedoDrafts}
            onOpenReplacement={onOpenReplacement}
          />
        ) : (
          <SheetHeader>
            <SheetTitle>{t('selfBilling.detail.title')}</SheetTitle>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}
