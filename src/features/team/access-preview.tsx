import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Eye, LayoutGrid, Minus, type LucideIcon } from 'lucide-react';
import type { OrgRoleInfo } from '@/types/org-team.types';
import { buildAccessPreview } from './access-preview-model';
import { areaName, capabilityLabel } from './team-labels';

/** One line of the preview: what it is (with an icon, never the color alone) and the things it holds. */
function PreviewGroup({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        {label}
      </p>
      <div className="break-words pl-6 text-sm text-foreground/80">{children}</div>
    </div>
  );
}

/**
 * «Cosa vede questo utente»: for a role and the areas of a person, where it can enter and what it can do there, in words and from
 * the matrix the backend gives (nothing here is a list of permissions). Three small groups: the areas, what the person can manage,
 * what it can only look at, what it cannot do. A deactivated person enters nowhere.
 */
export function AccessPreview({ role, areas, deactivated = false }: { role: OrgRoleInfo; areas: readonly string[]; deactivated?: boolean }) {
  const { t } = useTranslation();

  if (deactivated) {
    return (
      <p className="text-sm text-foreground/70" data-testid="access-preview">
        {t('team.preview.deactivated')}
      </p>
    );
  }

  const model = buildAccessPreview(role, areas);
  const names = (ids: string[]) => ids.map((id) => capabilityLabel(id, t)).filter((name): name is string => name !== undefined);
  const can = names(model.can);
  const read = names(model.read);
  const cannot = names(model.cannot);

  return (
    <div className="space-y-4" data-testid="access-preview">
      <PreviewGroup icon={LayoutGrid} label={t('team.preview.where')}>
        {model.enters.length === 0 ? (
          <span>{t('team.preview.noAreas')}</span>
        ) : (
          <ul role="list" className="space-y-0.5">
            {model.enters.map((area) => (
              <li key={area}>{areaName(area, t)}</li>
            ))}
            {model.stays.map((area) => (
              <li key={area} className="text-foreground/70">
                {t('team.preview.cannotEnter', { area: areaName(area, t) })}
              </li>
            ))}
          </ul>
        )}
      </PreviewGroup>

      {can.length > 0 ? (
        <PreviewGroup icon={Check} label={t('team.preview.can')}>
          {can.join(', ')}
        </PreviewGroup>
      ) : null}
      {read.length > 0 ? (
        <PreviewGroup icon={Eye} label={t('team.preview.read')}>
          {read.join(', ')}
        </PreviewGroup>
      ) : null}
      {cannot.length > 0 ? (
        <PreviewGroup icon={Minus} label={t('team.preview.cannot')}>
          {cannot.join(', ')}
        </PreviewGroup>
      ) : null}
    </div>
  );
}
