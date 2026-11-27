import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { OctorateListing } from '@/types';
import { PORTAL_ID_MAX_LENGTH, portalGuide, type PortalIds } from './channel-connect-model';
import { listingName } from './listing-labels';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

interface StructureIdFieldProps {
  code: string;
  /** The name of the portal, from the catalog. */
  name: string;
  structure: OctorateListing;
  value: string;
  /** The id has characters a portal does not have. */
  invalid: boolean;
  onChange: (accommodationId: string, value: string) => void;
  onEnter: () => void;
}

/** The id of one structure on the portal: the structure's name above, so that several fields are never alike, and the field the portal's name labels. */
function StructureIdField({ code, name, structure, value, invalid, onChange, onEnter }: StructureIdFieldProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const accommodationId = structure.octorateAccommodationId;

  return (
    <div role="group" aria-labelledby={titleId} className="min-w-0 space-y-1.5">
      <p id={titleId} className="break-words text-sm font-medium">
        {listingName(structure, t)}
      </p>
      <Field
        label={t('octorate.connect.existing.channels.byId.idLabel', { name })}
        hint={t('octorate.connect.existing.channels.byId.idHint', { name })}
        error={invalid ? t('octorate.connect.existing.channels.byId.idInvalid') : undefined}
      >
        <Input
          value={value}
          maxLength={PORTAL_ID_MAX_LENGTH}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          onChange={(event) => onChange(accommodationId, event.target.value)}
          onKeyDown={(event) => {
            // The step is inside the form of the wizard: Enter here connects the portal, it never goes on to the next step.
            if (event.key !== 'Enter') return;
            event.preventDefault();
            onEnter();
          }}
          data-testid={`existing-channel-${code}-id-${accommodationId}`}
        />
      </Field>
    </div>
  );
}

interface ChannelIdFieldsProps {
  code: string;
  name: string;
  structures: readonly OctorateListing[];
  ids: PortalIds;
  /** The accommodation ids whose id a portal cannot have: told once the host pressed «Collega». */
  invalid: ReadonlySet<string>;
  onChange: (accommodationId: string, value: string) => void;
  onEnter: () => void;
}

/**
 * The structures of the host with a field for the id each one has on the portal (the id of the property on Booking, on Expedia...). A structure that
 * is not on the portal is left empty. It is an identifier the host reads in their account on the portal, never a credential.
 */
export function ChannelIdFields({ code, name, structures, ids, invalid, onChange, onEnter }: ChannelIdFieldsProps) {
  const { t } = useTranslation();

  return (
    <div className="min-w-0 space-y-3" data-testid={`existing-channel-${code}-ids`}>
      <p className="text-sm text-muted-foreground">{t('octorate.connect.existing.channels.byId.intro', { name })}</p>
      {structures.map((structure) => (
        <StructureIdField
          key={structure.octorateAccommodationId}
          code={code}
          name={name}
          structure={structure}
          value={Object.hasOwn(ids, structure.octorateAccommodationId) ? ids[structure.octorateAccommodationId] : ''}
          invalid={invalid.has(structure.octorateAccommodationId)}
          onChange={onChange}
          onEnter={onEnter}
        />
      ))}
    </div>
  );
}

interface ChannelLastStepProps {
  code: string;
  name: string;
}

/**
 * What is left once the ids are with the channel manager: approve it on the portal's own site (the sentence of the portal, with a link where CasaZen
 * knows the page), and CasaZen sees the approval by itself. It replaces the wording of the panel for a portal connected by id.
 */
export function ChannelLastStep({ code, name }: ChannelLastStepProps) {
  const { t } = useTranslation();
  const guide = portalGuide(code);

  return (
    <div className="min-w-0 space-y-2 rounded-md bg-muted p-3 text-sm" data-testid={`existing-channel-${code}-last-step`}>
      <p className="font-medium">{t('octorate.connect.existing.channels.byId.lastStep.title', { name })}</p>
      <p className="break-words">{t(guide.lastStepKey, { name })}</p>
      {guide.extranet ? (
        <Button asChild variant="outline" className={TOUCH_TARGET} iconRight={<ExternalLink />}>
          <a href={guide.extranet.href} target="_blank" rel="noopener noreferrer" data-testid={`existing-channel-${code}-extranet`}>
            {t(guide.extranet.labelKey)}
            <span className="sr-only"> {t('octorate.connect.existing.channels.byId.newTab')}</span>
          </a>
        </Button>
      ) : null}
      <p className="text-muted-foreground" role="status" data-testid={`existing-channel-${code}-waiting`}>
        {t('octorate.connect.existing.channels.byId.lastStep.watching', { name })}
      </p>
    </div>
  );
}
