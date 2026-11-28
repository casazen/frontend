import { useContext, useEffect, useState } from 'react';
import { UNSAFE_DataRouterContext, useBlocker } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AFTER_STEP, DONE_STEP } from './wizard-model';

interface DraftExitProps {
  hasPending: () => boolean;
  flush: () => Promise<boolean>;
  discard: () => void;
  stopped: boolean;
}

export function DraftExitGuard(props: DraftExitProps) {
  const router = useContext(UNSAFE_DataRouterContext);
  return router ? <RoutedDraftExit {...props} /> : null;
}

function RoutedDraftExit({ hasPending, flush, discard, stopped }: DraftExitProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    const nextStep = new URLSearchParams(nextLocation.search).get('step');
    const leavesDraft = nextLocation.pathname !== currentLocation.pathname || nextStep === String(AFTER_STEP) || nextStep === DONE_STEP;
    return !stopped && leavesDraft && hasPending();
  });
  useEffect(() => {
    if (stopped && blocker.state === 'blocked') blocker.reset();
  }, [blocker, stopped]);
  if (blocker.state !== 'blocked') return null;

  const stay = () => {
    if (saving) return;
    setFailed(false);
    blocker.reset();
  };

  const saveAndContinue = async () => {
    setSaving(true);
    const saved = await flush();
    setSaving(false);
    setFailed(!saved);
    if (saved) blocker.proceed();
  };

  if (stopped) return null;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) stay(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('leaseWizardGuide.exit.title')}</DialogTitle>
          <DialogDescription>{t('leaseWizardGuide.exit.description')}</DialogDescription>
        </DialogHeader>
        {failed && <p role="alert" className="text-sm text-destructive">{t('leaseWizardGuide.exit.failed')}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={stay} disabled={saving}>{t('leaseWizardGuide.exit.stay')}</Button>
          {failed && <Button type="button" variant="ghost" disabled={saving} onClick={() => {
            discard();
            blocker.proceed();
          }}>{t('leaseWizardGuide.exit.discard')}</Button>}
          <Button type="button" onClick={() => void saveAndContinue()} disabled={saving}>
            {t(saving ? 'leaseWizardGuide.exit.saving' : 'leaseWizardGuide.exit.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
