import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PropertyModeChange } from '@/types/property-mode.types';
import { propertyDetailPath, type ModeArea } from '../paths';
import { useDayLabel } from '../use-mode-labels';
import { CancelModeChangeDialog } from './cancel-mode-change-dialog';

interface ScheduledChangePanelProps {
  propertyId: string;
  propertyName: string;
  area: ModeArea;
  /** The change that waits for its day. */
  change: PropertyModeChange;
  /** Where the person goes once the change is withdrawn: where they came from. */
  backTo: string;
}

/**
 * The wizard of a property that already has a change waiting: there is only one at a time, so instead of asking for a second
 * one the page says what is programmed and offers the one thing that can be done, withdraw it.
 */
export function ScheduledChangePanel({ propertyId, propertyName, area, change, backTo }: ScheduledChangePanelProps) {
  const { t } = useTranslation();
  const dayLabel = useDayLabel();
  const navigate = useNavigate();
  const [cancelling, setCancelling] = useState(false);
  const date = dayLabel(change.effectiveDate);

  return (
    <section className="space-y-6" aria-labelledby="property-mode-scheduled-title" data-testid="property-mode-scheduled">
      <div className="space-y-3">
        <CalendarClock aria-hidden="true" className="size-8 text-primary" />
        <h2 id="property-mode-scheduled-title" className="break-words text-xl font-semibold tracking-tight">
          {t('propertyMode.scheduled.title')}
        </h2>
        <p className="break-words">
          {t(change.toMode === 'Long' ? 'propertyMode.done.descriptionToLong' : 'propertyMode.done.descriptionToShort', {
            name: propertyName,
            date,
          })}
        </p>
        <p className="break-words text-sm text-muted-foreground">{t('propertyMode.scheduled.hint')}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          className="h-auto min-h-11 whitespace-normal py-2 text-center leading-tight"
          data-testid="property-mode-scheduled-cancel"
          onClick={() => setCancelling(true)}
        >
          {t('propertyMode.cancel.action')}
        </Button>
        <Button asChild variant="outline" className="h-auto min-h-11 whitespace-normal py-2 text-center leading-tight">
          <Link to={propertyDetailPath(area, propertyId)} data-testid="property-mode-scheduled-back">
            {t('propertyMode.scheduled.back')}
          </Link>
        </Button>
      </div>

      <CancelModeChangeDialog
        open={cancelling}
        onOpenChange={setCancelling}
        propertyId={propertyId}
        change={change}
        onCancelled={() => navigate(backTo)}
      />
    </section>
  );
}
