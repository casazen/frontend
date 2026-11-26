import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getContextNav, type AppContextKey } from '@/config/route-manifest';
import { useCommercialRouteAccess } from '@/hooks/use-commercial-profile';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { PHONE_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { useWorkspace } from '@/hooks/use-workspace';
import { getNavGroupLabel, getNavLabel } from '@/lib/nav-labels';
import { DEFAULT_WORKSPACE_VIEW, useUiStore } from '@/store/ui-store';

export function WorkspaceViewDialog({ contextKey, viewKey, onClose }: { contextKey: AppContextKey; viewKey: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const { flags } = useFeatureFlags();
  const canOpenPath = useCommercialRouteAccess();
  const phone = useMediaQuery(PHONE_QUERY);
  const { sections } = getContextNav(contextKey, hasPermission, flags, { canOpenPath, withoutBottom: phone });
  const view = useUiStore(state => state.workspaceViews[viewKey] ?? DEFAULT_WORKSPACE_VIEW);
  const update = useUiStore(state => state.updateWorkspaceView);
  function togglePath(path: string) {
    update(viewKey, current => ({
      ...current,
      secondaryPaths: current.secondaryPaths.includes(path)
        ? current.secondaryPaths.filter(item => item !== path) : [...current.secondaryPaths, path],
    }));
  }
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[85dvh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{t('workspaceView.title')}</DialogTitle>
          <DialogDescription>{t('workspaceView.scope')}</DialogDescription>
        </DialogHeader>
        <label className="hidden min-h-11 items-center gap-3 font-medium md:flex">
          <input type="checkbox" checked={view.compact} onChange={() => update(viewKey, current => ({ ...current, compact: !current.compact }))} />
          {t('workspaceView.compact')}
        </label>
        <label className="flex min-h-11 items-center gap-3 font-medium">
          <input type="checkbox" checked={Boolean(view.focusForms)} onChange={() => update(viewKey, current => ({ ...current, focusForms: !current.focusForms }))} />
          {t('workspaceView.focusForms')}
        </label>
        {contextKey === 'short-rent' && hasPermission('short-rent', 'booking.read') && <label className="flex min-h-11 items-center gap-3 font-medium">
          <input type="checkbox" checked={Boolean(view.tasksFirst)} onChange={() => update(viewKey, current => ({ ...current, tasksFirst: !current.tasksFirst }))} />
          {t('workspaceView.tasksFirst')}
        </label>}
        <p className="text-sm text-muted-foreground">{t('workspaceView.help')}</p>
        {sections.map(section => (
          <fieldset key={section.group} className="grid gap-x-3 sm:grid-cols-2">
            <legend className="mb-1 font-semibold">{getNavGroupLabel(section.group, t)}</legend>
            {section.entries.map(entry => (
              <label key={entry.path} className="flex min-h-11 items-center gap-3">
                <input type="checkbox" checked={!view.secondaryPaths.includes(entry.path)} onChange={() => togglePath(entry.path)} />
                {getNavLabel(entry, t)}
              </label>
            ))}
          </fieldset>
        ))}
        <div className="flex flex-wrap justify-between gap-2 border-t pt-3">
          <Button variant="ghost" disabled={!view.compact && !view.focusForms && !view.tasksFirst && !view.secondaryPaths.length} onClick={() => update(viewKey, () => DEFAULT_WORKSPACE_VIEW)}>{t('workspaceView.reset')}</Button>
          <Button onClick={onClose}>{t('workspaceView.done')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
