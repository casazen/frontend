import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { OrgDomainConfig, SetDomainSurfacesRequest } from '@/types/domain.types';
import { ownerLoginState } from './domain-state';
import { useRequestOwnerLogin, useSetDomainSurfaces } from './use-org-domain';

interface DomainSurfacesPanelProps {
  orgId: string;
  config: OrgDomainConfig;
}

interface SurfaceSwitchProps {
  id: string;
  label: string;
  help: string;
  /** One more line when the choice is made and it is not on yet, or where the links go: said in words, never left to a switch that looks on. */
  note?: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function SurfaceSwitch({ id, label, help, note, checked, disabled, onCheckedChange }: SurfaceSwitchProps) {
  const helpId = `${id}-help`;
  const noteId = `${id}-note`;

  return (
    <li className="flex items-start justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <Label htmlFor={id}>{label}</Label>
        <p id={helpId} className="break-words text-sm text-foreground/70">
          {help}
        </p>
        {note ? (
          <p id={noteId} className="break-words text-sm font-medium" data-testid={noteId}>
            {note}
          </p>
        ) : null}
      </div>
      <Switch
        id={id}
        data-testid={id}
        aria-describedby={note ? `${helpId} ${noteId}` : helpId}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </li>
  );
}

/**
 * What runs on the agency's own domain (E40/F02/US02, NF-140..NF-142): the guest area, the owner portal and the links the agency sends, three switches that save as they are moved, and one
 * line for the sign-in of the owners on that domain. The block is there only when the backend sends the surfaces (flag `WhiteLabelHost`) and the domain is verified; without them the page
 * is the one it always was. The switches show what the agency chose, and say in words when a choice is not on yet (`effective`): a switch that looks on never stands for something that is not.
 * While any request of the block is on its way every control of it is off, so one choice cannot overwrite another and a retry cannot go out twice.
 */
export function DomainSurfacesPanel({ orgId, config }: DomainSurfacesPanelProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const save = useSetDomainSurfaces(orgId);
  const retry = useRequestOwnerLogin(orgId);
  const surfaces = config.surfaces;
  if (!surfaces || config.domainVerificationStatus !== 'Verified') return null;

  const { effective } = surfaces;
  const busy = save.isPending || retry.isPending;
  // The switches show the server's answer, and while a save is on its way the choice just made, so a switch does not jump back and forth. A save that fails shows the answer again.
  const shown: SetDomainSurfacesRequest = save.isPending && save.variables ? save.variables : surfaces;
  // The server wants all three every time: the one that moved over the ones it holds.
  const change = (patch: Partial<SetDomainSurfacesRequest>) =>
    save.mutate({
      guestAreaOnOwnDomain: surfaces.guestAreaOnOwnDomain,
      ownerPortalOnOwnDomain: surfaces.ownerPortalOnOwnDomain,
      useOwnDomainForLinks: surfaces.useOwnDomainForLinks,
      ...patch,
    });

  // The links of the owners move only once their sign-in is active: the portal is on the domain for them when the page is served and the sign-in is ready.
  const ownerPortalOn = effective.ownerPortal && effective.ownerLoginReady;
  const linksAddress = effective.linksOnOwnDomain ? config.publicUrls.customDomainUrl : null;
  let linksNote: string | undefined;
  if (linksAddress) linksNote = t('domain.surfaces.links.address', { url: linksAddress });
  else if (surfaces.useOwnDomainForLinks && !effective.linksOnOwnDomain) linksNote = t('domain.surfaces.links.notActive');

  const ownerState = ownerLoginState(surfaces);
  const ownerFailed = ownerState === 'failed';

  return (
    <Card role="region" aria-labelledby={titleId} className="xl:col-span-2" data-testid="domain-surfaces-panel">
      <CardHeader>
        <CardTitle id={titleId}>{t('domain.surfaces.title')}</CardTitle>
        <CardDescription>{t('domain.surfaces.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ul role="list" className="space-y-4">
          <SurfaceSwitch
            id="domain-surface-guest-area"
            label={t('domain.surfaces.guestArea.label')}
            help={t('domain.surfaces.guestArea.help')}
            note={surfaces.guestAreaOnOwnDomain && !effective.guestArea ? t('domain.surfaces.guestArea.notActive') : undefined}
            checked={shown.guestAreaOnOwnDomain}
            disabled={busy}
            onCheckedChange={(checked) => change({ guestAreaOnOwnDomain: checked })}
          />
          <SurfaceSwitch
            id="domain-surface-owner-portal"
            label={t('domain.surfaces.ownerPortal.label')}
            help={t('domain.surfaces.ownerPortal.help')}
            note={surfaces.ownerPortalOnOwnDomain && !ownerPortalOn ? t('domain.surfaces.ownerPortal.notActive') : undefined}
            checked={shown.ownerPortalOnOwnDomain}
            disabled={busy}
            onCheckedChange={(checked) => change({ ownerPortalOnOwnDomain: checked })}
          />
          <SurfaceSwitch
            id="domain-surface-links"
            label={t('domain.surfaces.links.label')}
            help={t('domain.surfaces.links.help')}
            note={linksNote}
            checked={shown.useOwnDomainForLinks}
            disabled={busy}
            onCheckedChange={(checked) => change({ useOwnDomainForLinks: checked })}
          />
        </ul>

        <div
          role={ownerFailed ? 'alert' : 'status'}
          className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"
          data-testid="domain-owner-login"
          data-state={ownerState}
        >
          <div className="min-w-0 space-y-1">
            <p className="break-words text-sm">
              <span className="font-medium">{t('domain.surfaces.ownerLogin.label')}:</span>{' '}
              <span data-testid="domain-owner-login-state">{t(`domain.surfaces.ownerLogin.state.${ownerState}`)}</span>
            </p>
            {ownerState === 'pendingManual' ? (
              <p className="break-words text-sm text-foreground/70">{t('domain.surfaces.ownerLogin.manualHint')}</p>
            ) : null}
          </div>
          {ownerFailed ? (
            <Button type="button" variant="secondary" disabled={busy} onClick={() => retry.mutate()} data-testid="domain-owner-login-retry">
              {t('domain.surfaces.ownerLogin.retry')}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
