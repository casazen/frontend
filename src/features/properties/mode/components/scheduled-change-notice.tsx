import { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getArea } from '@/config/areas';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { formatStayDate, parseStayDate } from '@/lib/stay-dates';
import { usePropertyModeState } from '@/queries/use-property-mode';
import { areaOfMode, type ModeArea } from '../paths';
import { usePropertyModeEnabled } from '../use-mode-entry';
import { CancelModeChangeDialog } from './cancel-mode-change-dialog';

interface ScheduledChangeNoticeProps {
  area: ModeArea;
  propertyId: string;
}

/**
 * The row of status on the page of a property: "Passaggio all'affitto lungo il 1 dicembre", with "Annulla il passaggio" for who
 * may write the property. Nothing at all when no change waits for its day, and nothing (not even the request) while the flag is
 * off: the page is then exactly what it was.
 */
export function ScheduledChangeNotice(props: ScheduledChangeNoticeProps) {
  return usePropertyModeEnabled() ? <ScheduledChangeRow {...props} /> : null;
}

function ScheduledChangeRow({ area, propertyId }: ScheduledChangeNoticeProps) {
  const { t, i18n } = useTranslation();
  const workspace = useContext(WorkspaceContext);
  const state = usePropertyModeState(propertyId);
  const [cancelling, setCancelling] = useState(false);

  const change = state.data?.scheduledChange;
  // A failed read shows nothing: the page works without this row, and the wizard says why when it is opened.
  if (!change) return null;

  const canCancel = workspace?.hasPermission(area, 'property.write') ?? false;
  const toLong = change.toMode === 'Long';
  const date = formatStayDate(parseStayDate(change.effectiveDate), i18n.language);

  return (
    <>
      <Alert
        variant="info"
        icon={CalendarClock}
        data-testid="property-mode-notice"
        title={t(toLong ? 'propertyMode.notice.toLong' : 'propertyMode.notice.toShort', { date })}
        action={
          canCancel ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="max-md:min-h-11"
              data-testid="property-mode-notice-cancel"
              onClick={() => setCancelling(true)}
            >
              {t('propertyMode.cancel.action')}
            </Button>
          ) : undefined
        }
      >
        {t('propertyMode.notice.until', { area: t(getArea(areaOfMode(change.fromMode)).nameKey) })}
      </Alert>
      {canCancel && (
        <CancelModeChangeDialog open={cancelling} onOpenChange={setCancelling} propertyId={propertyId} change={change} />
      )}
    </>
  );
}
