import { useId, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { UseQueryResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { getProblemMessage, translateErrorCode } from '@/lib/api-errors';
import { useActivationMappings } from '@/queries/use-marketplace';
import type { MarketplaceActivationMapping, MarketplaceChannelRoom } from '@/types';
import {
  ACTIVATION_STEP,
  MAPPING_PAGE_SIZE,
  SKIP_ROOM,
  hasAccessStep,
  mappingProblem,
  problemCodeOf,
  propertyNameOf,
  roomChoices,
  stepToFix,
  type ActivationContext,
  type ActivationStepId,
  type ActivationWizardValues,
} from '../activation-wizard-model';
import { ChoosePropertyFirst } from './choose-property-first';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

/** The name of a room of the channel, with its rate when it has one (two rates of the same room are two rows). */
function roomLabel(room: MarketplaceChannelRoom): string {
  return room.rateName ? `${room.name} · ${room.rateName}` : room.name;
}

interface MappingSectionProps {
  propertyId: string;
  propertyName: string;
  /** The plan of the property was read: only then is a missing activation a missing connection. */
  planRead: boolean;
  activationId: string | null;
  query: UseQueryResult<MarketplaceActivationMapping>;
  overrides: Readonly<Record<string, string>>;
  showErrors: boolean;
  /** The portal has an access step: a problem about the access can lead back to it. */
  accessStep: boolean;
  onChange: (channelRoomId: string, productId: string) => void;
  onFix: (step: ActivationStepId) => void;
}

/**
 * The rooms of the channel of one property (E09/F02/US04/T02, UX-04): one row for each room, with the room CasaZen proposes already chosen, a select to change it and the
 * choice that says the room is not one of the property's. About five rows at a time and «Mostra altre» for the rest: one topic on the screen, not a table of twenty rooms.
 */
function MappingSection({ propertyId, propertyName, planRead, activationId, query, overrides, showErrors, accessStep, onChange, onFix }: MappingSectionProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const [visible, setVisible] = useState(MAPPING_PAGE_SIZE);
  const mapping = query.data;
  const choices = mapping ? roomChoices(mapping.channelRooms, overrides) : {};
  const manageable = mapping ? mapping.channelRooms.filter((room) => room.manageable) : [];
  const left = mapping ? mapping.channelRooms.length - manageable.length : 0;
  const problem = mapping ? mappingProblem(choices) : null;

  let body;
  if (!planRead) {
    body = (
      <div className="flex items-center gap-3 rounded-lg bg-muted p-4 text-sm" role="status" data-testid={`activation-mapping-${propertyId}-loading`}>
        <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
        {t('marketplace.activation.mapping.loading')}
      </div>
    );
  } else if (activationId === null) {
    body = (
      <Alert
        variant="info"
        data-testid={`activation-mapping-${propertyId}-no-connection`}
        action={
          <Button type="button" size="sm" className={TOUCH_TARGET} onClick={() => onFix(ACTIVATION_STEP.connection)}>
            {t('marketplace.activation.mapping.fixConnection')}
          </Button>
        }
      >
        {t('marketplace.activation.mapping.noConnection')}
      </Alert>
    );
  } else if (query.isError) {
    const code = problemCodeOf(query.error);
    const fixAt = stepToFix(code, accessStep);
    body = (
      <Alert
        variant="danger"
        data-testid={`activation-mapping-${propertyId}-error`}
        action={
          <>
            {fixAt === ACTIVATION_STEP.connection || fixAt === ACTIVATION_STEP.access ? (
              <Button type="button" size="sm" className={TOUCH_TARGET} onClick={() => onFix(fixAt)}>
                {t(fixAt === ACTIVATION_STEP.access ? 'marketplace.activation.import.fixAccess' : 'marketplace.activation.mapping.fixConnection')}
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="outline" className={TOUCH_TARGET} onClick={() => void query.refetch()}>
              {t('marketplace.activation.mapping.retry')}
            </Button>
          </>
        }
      >
        {translateErrorCode(code, t) ?? getProblemMessage(query.error, t) ?? t('marketplace.activation.mapping.readError')}
      </Alert>
    );
  } else if (!mapping) {
    body = (
      <div className="flex items-center gap-3 rounded-lg bg-muted p-4 text-sm" role="status" data-testid={`activation-mapping-${propertyId}-loading`}>
        <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
        {t('marketplace.activation.mapping.loading')}
      </div>
    );
  } else if (mapping.channelRooms.length === 0) {
    body = (
      <Alert
        variant="info"
        data-testid={`activation-mapping-${propertyId}-no-rooms`}
        action={
          <Button type="button" size="sm" variant="outline" className={TOUCH_TARGET} onClick={() => void query.refetch()}>
            {t('marketplace.activation.mapping.retry')}
          </Button>
        }
      >
        {t('marketplace.activation.mapping.noRooms')}
      </Alert>
    );
  } else {
    body = (
      <>
        <ul className="space-y-3" role="list" data-testid={`activation-mapping-${propertyId}-rooms`}>
          {manageable.slice(0, visible).map((room) => {
            const choice = choices[room.channelRoomId] ?? '';
            const proposed = overrides[room.channelRoomId] === undefined && room.mappedProductId === null && room.proposedProductId !== null && room.proposedProductId === choice;
            // The save adds or changes mappings and removes none: a room that is mapped already can be changed here, and «do not link» is not offered for it (it would be told and ignored).
            const linked = room.mappedProductId !== null;
            return (
              <li key={room.channelRoomId} className="min-w-0">
                <Field
                  label={roomLabel(room)}
                  hint={proposed ? t('marketplace.activation.mapping.proposed') : linked ? t('marketplace.activation.mapping.alreadyLinked') : undefined}
                  error={showErrors && choice === '' ? t('marketplace.activation.mapping.undecided') : undefined}
                >
                  <Select value={choice} onChange={(event) => onChange(room.channelRoomId, event.target.value)} data-testid={`activation-room-${propertyId}-${room.channelRoomId}`}>
                    <option value="">{t('marketplace.activation.mapping.choose')}</option>
                    {mapping.products.map((product) => (
                      <option key={product.productId} value={product.productId}>
                        {product.name ?? product.productId}
                      </option>
                    ))}
                    {linked ? null : <option value={SKIP_ROOM}>{t('marketplace.activation.mapping.skip')}</option>}
                  </Select>
                </Field>
              </li>
            );
          })}
        </ul>
        {manageable.length > visible ? (
          <Button
            type="button"
            variant="outline"
            className={TOUCH_TARGET}
            onClick={() => setVisible((current) => current + MAPPING_PAGE_SIZE)}
            data-testid={`activation-mapping-${propertyId}-more`}
          >
            {t('marketplace.activation.mapping.showMore', { count: manageable.length - visible })}
          </Button>
        ) : null}
        {left > 0 ? (
          <p className="text-sm text-muted-foreground" data-testid={`activation-mapping-${propertyId}-left-out`}>
            {t('marketplace.activation.mapping.leftOut', { count: left })}
          </p>
        ) : null}
        {showErrors && problem === 'noneMapped' ? (
          <Alert variant="warning" data-testid={`activation-mapping-${propertyId}-none`}>
            {t('marketplace.activation.mapping.noneMapped')}
          </Alert>
        ) : null}
      </>
    );
  }

  return (
    <section className="min-w-0 space-y-3" aria-labelledby={titleId} data-testid={`activation-mapping-${propertyId}`}>
      <h3 id={titleId} className="break-words text-base font-semibold">
        {propertyName}
      </h3>
      {body}
    </section>
  );
}

interface MappingStepProps {
  context: ActivationContext;
  /** What the person changed, by property and room of the channel; the rest is what the server proposes. */
  overrides: Readonly<Record<string, Record<string, string>>>;
  onChange: (propertyId: string, channelRoomId: string, productId: string) => void;
  /** The person pressed «Continue» with the mapping not ready: the rooms with no choice say so. */
  showErrors: boolean;
  /** Opens the step where the person can change what is wrong (the connection, the access). */
  onFix: (step: ActivationStepId) => void;
  onChoose: () => void;
}

/**
 * Step «Camere» (E09/F02/US04/T02, LST-02): for each chosen property, one row for each room of the channel with the CasaZen room already chosen where the server
 * proposes one (`GET .../mapping`), a select to change it and the choice «non collegare questa camera». The choices are the page's until «Salva e continua»
 * sends them (`PUT .../mapping`): a room the person leaves out is not in the body, and a body with no room is never sent (the server refuses an empty one, which
 * is never «all the rooms»). A room the channel manager cannot manage is told and left out: it is never mapped.
 */
export function MappingStep({ context, overrides, onChange, showErrors, onFix, onChoose }: MappingStepProps) {
  const { control } = useFormContext<ActivationWizardValues>();
  const propertyIds = useWatch({ control, name: 'propertyIds' }) ?? [];
  const activationIds = propertyIds.map((propertyId) => context.plans.get(propertyId)?.activationId ?? null);
  // The rooms are read again until they are there: an import that was slow is not a reason to stop on an empty list.
  const mappings = useActivationMappings(
    activationIds.map((id) => ({ id })),
    { pollUntilRooms: true },
  );

  if (propertyIds.length === 0) return <ChoosePropertyFirst onChoose={onChoose} />;

  return (
    <div className="flex flex-col gap-6" data-testid="activation-mapping-step">
      {propertyIds.map((propertyId, index) => (
        <MappingSection
          key={propertyId}
          propertyId={propertyId}
          propertyName={propertyNameOf(context.properties, propertyId) ?? propertyId}
          planRead={context.plans.has(propertyId)}
          activationId={activationIds[index]}
          query={mappings[index]}
          overrides={overrides[propertyId] ?? {}}
          showErrors={showErrors}
          accessStep={hasAccessStep(context.requirements)}
          onChange={(channelRoomId, productId) => onChange(propertyId, channelRoomId, productId)}
          onFix={onFix}
        />
      ))}
    </div>
  );
}
