import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Sun, type LucideIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LONG_RENT_PROPERTY_CREATE_PATH } from '@/features/properties/long-rent/paths';
import { PROPERTY_CREATE_PATH } from '@/features/properties/properties-paths';
import type { AccountPropertyRights } from './account-properties-model';

interface ModeLinkProps {
  to: string;
  icon: LucideIcon;
  title: string;
  text: string;
  testId: string;
}

/** One of the two ways to let a property: a card that is a link to the creation in its section. */
function ModeLink({ to, icon: Icon, title, text, testId }: ModeLinkProps) {
  return (
    <Link
      to={to}
      data-testid={testId}
      className="flex min-h-11 min-w-0 items-start gap-3 rounded-xl border bg-background p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block break-words font-semibold leading-snug">{title}</span>
        <span className="mt-1 block break-words text-sm text-foreground/70">{text}</span>
      </span>
    </Link>
  );
}

interface AddPropertyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rights: AccountPropertyRights;
}

/**
 * «Aggiungi un immobile» (AM-13): which way it will be let decides the section that creates it, and each section has its own form
 * (there is no second wizard here). Only the sections the person may write are offered.
 */
export function AddPropertyDialog({ open, onOpenChange, rights }: AddPropertyDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('accountProperties.add.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('accountProperties.add.dialogDescription')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {rights.shortWrite ? (
            <ModeLink to={PROPERTY_CREATE_PATH} icon={Sun} title={t('accountProperties.add.short.title')} text={t('accountProperties.add.short.text')} testId="add-property-short" />
          ) : null}
          {rights.longWrite ? (
            <ModeLink to={LONG_RENT_PROPERTY_CREATE_PATH} icon={Home} title={t('accountProperties.add.long.title')} text={t('accountProperties.add.long.text')} testId="add-property-long" />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
