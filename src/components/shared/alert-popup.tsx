import { ArrowRight, Clock3 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertRemindDialog } from '@/components/shared/alert-remind-dialog';
import { Alert, type AlertVariant } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { isDemoMode } from '@/config/demo.config';
import { alertRoute, alertTypeKey } from '@/features/notifications/alert-model';
import { useAlertSignalr } from '@/hooks/use-alert-signalr';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/store/ui-store';
import type { AlertUrgency, PendingAlert } from '@/types/alert';

const VARIANT_OF: Record<AlertUrgency, AlertVariant> = { High: 'danger', Normal: 'warning', Low: 'info' };

const POSITION =
  'fixed inset-x-4 z-40 animate-in fade-in slide-in-from-bottom-4 duration-300 motion-reduce:animate-none md:inset-x-auto md:bottom-6 md:right-6 md:w-[26rem]';
const ABOVE_THE_BAR = 'max-md:bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px)+0.75rem)]';
const ABOVE_THE_BAR_AND_THE_PRIMARY_ACTION =
  'max-md:bottom-[calc(var(--bottom-nav-height)+var(--mobile-primary-height)+env(safe-area-inset-bottom,0px)+0.75rem)]';

interface AlertCardProps {
  alert: PendingAlert;
  busy: boolean;
  primaryActionIsThere: boolean;
  onDismiss: () => void;
  onRemind: (remindAt: Date) => void;
}

function AlertCard({ alert, busy, primaryActionIsThere, onDismiss, onRemind }: AlertCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [remindOpen, setRemindOpen] = useState(false);
  const route = alertRoute(alert);
  const onRemindMe = () => setRemindOpen(true);

  return (
    <div
      className={cn(POSITION, primaryActionIsThere ? ABOVE_THE_BAR_AND_THE_PRIMARY_ACTION : ABOVE_THE_BAR)}
      data-testid="alert-popup"
      data-urgency={alert.urgency}
    >
      <Alert
        variant={VARIANT_OF[alert.urgency]}
        title={t(alertTypeKey(alert.alertType))}
        className="shadow-lg"
        action={
          <>
            {route ? (
              <Button type="button" size="sm" disabled={busy} data-testid="alert-do-now" onClick={() => void navigate(route)}>
                {t('alert.popup.doNow')}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="outline" disabled={busy} data-testid="alert-remind" onClick={onRemindMe}>
              <Clock3 aria-hidden="true" className="size-4" />
              {t('alert.popup.remindMeLater')}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy} data-testid="alert-dismiss" onClick={onDismiss}>
              {t('alert.popup.dismiss')}
            </Button>
          </>
        }
      />
      <AlertRemindDialog
        open={remindOpen}
        onClose={() => setRemindOpen(false)}
        onRemind={(remindAt) => {
          setRemindOpen(false);
          onRemind(remindAt);
        }}
      />
    </div>
  );
}

function LiveAlertPopup({ userId, getAccessToken }: { userId: string; getAccessToken: () => Promise<string | undefined> }) {
  const { currentAlert, busy, dismissCurrent, remindCurrent } = useAlertSignalr({ userId, getAccessToken });
  const wizardOpen = useUiStore((state) => state.openWizards > 0);
  const primaryActionIsThere = useUiStore((state) => state.mobilePrimaryVisible);

  if (!currentAlert || wizardOpen) return null;
  return (
    <AlertCard
      key={currentAlert.alertId}
      alert={currentAlert}
      busy={busy}
      primaryActionIsThere={primaryActionIsThere}
      onDismiss={dismissCurrent}
      onRemind={remindCurrent}
    />
  );
}

export function AlertPopup() {
  const { isAuthenticated, kind, user, getAccessToken } = useAuth();
  const userId = user && 'sub' in user && typeof user.sub === 'string' ? user.sub : null;
  if (!isAuthenticated || kind !== 'auth0' || isDemoMode || userId === null) return null;
  return <LiveAlertPopup userId={userId} getAccessToken={getAccessToken} />;
}
