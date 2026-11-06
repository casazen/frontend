import { useEffect, useId } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, type FieldErrorInput } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useFoundListings, useShortRentProperties } from '@/queries/use-octorate-mapping';
import type { OctorateListing, OctoratePropertySummary, Property } from '@/types';
import type { ConnectWizardValues } from './inventory-scenario';
import { capacityText, detailsLine, listingAddress, listingName, roomName } from './listing-labels';
import { ListingStateBadge, StepProblem } from './listing-parts';
import {
  choiceOf,
  clearProposals,
  decisionFor,
  findDecision,
  forShortRent,
  hasSeveralRooms,
  isOpenListing,
  propertiesChosen,
  propertiesTaken,
  pruneDecisions,
  replaceDecision,
  roomDecision,
  shortRentIdsOf,
  type MappingChoice,
  type MappingDecision,
} from './mapping-model';

const NO_DECISIONS: MappingDecision[] = [];

/** The properties of the host as the select needs them: whether the list was read, and the properties by id. */
interface PropertyChoices {
  state: 'error' | 'ready';
  all: readonly Property[];
  byId: ReadonlyMap<string, Property>;
}

interface ChoiceRadioProps {
  name: string;
  value: MappingChoice;
  checked: boolean;
  label: string;
  hint?: string;
  onSelect: () => void;
  testId: string;
}

/** One answer of the question about a listing: a real radio button, with its explanation read after its name. */
function ChoiceRadio({ name, value, checked, label, hint, onSelect, testId }: ChoiceRadioProps) {
  const hintId = useId();

  return (
    <div className="rounded-md hover:bg-muted/40 has-checked:bg-primary/5">
      <label className="flex min-h-11 cursor-pointer items-start gap-3 px-2 py-2.5">
        <input
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={onSelect}
          aria-describedby={hint ? hintId : undefined}
          className="mt-0.5 size-4 shrink-0 accent-primary"
          data-testid={testId}
        />
        <span className="min-w-0 break-words text-sm font-medium">{label}</span>
      </label>
      {hint ? (
        <p id={hintId} className="break-words pb-2 pl-9 pr-2 text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface PropertyOptionsProps {
  listing: OctorateListing;
  properties: PropertyChoices;
  taken: ReadonlySet<string>;
  chosenElsewhere: ReadonlyMap<string, string>;
}

/** The options of the select of properties: the likely ones first (the candidates of an ambiguous listing), then all the others. */
function PropertyOptions({ listing, properties, taken, chosenElsewhere }: PropertyOptionsProps) {
  const { t } = useTranslation();
  const listingId = listing.octorateAccommodationId;
  const likelyIds = new Set(listing.candidates.map((candidate) => candidate.id));
  const others = properties.all.filter((property) => !likelyIds.has(property.id));

  const option = (property: Pick<OctoratePropertySummary, 'id' | 'name' | 'address' | 'city'>) => {
    const linked = taken.has(property.id);
    const elsewhere = !linked && chosenElsewhere.has(property.id) && chosenElsewhere.get(property.id) !== listingId;
    const reason = linked
      ? t('octorate.connect.mapping.pick.alreadyLinked')
      : elsewhere
        ? t('octorate.connect.mapping.pick.chosenElsewhere')
        : '';
    const text = detailsLine(property.name, listingAddress(property));
    return (
      <option key={property.id} value={property.id} disabled={linked || elsewhere}>
        {reason ? `${text} (${reason})` : text}
      </option>
    );
  };

  return (
    <>
      {listing.candidates.length > 0 ? (
        <optgroup label={t('octorate.connect.mapping.pick.likely')}>{listing.candidates.map(option)}</optgroup>
      ) : null}
      {others.length > 0 ? (
        <optgroup label={t('octorate.connect.mapping.pick.others')}>{others.map(option)}</optgroup>
      ) : null}
    </>
  );
}

interface OpenListingRowProps {
  listing: OctorateListing;
  decision: MappingDecision | undefined;
  properties: PropertyChoices;
  /** Properties confirmed to another listing already: they cannot be picked. */
  taken: ReadonlySet<string>;
  /** Properties picked for other listings in this wizard: one property is one listing. */
  chosenElsewhere: ReadonlyMap<string, string>;
  propertyError: FieldErrorInput;
  roomError: FieldErrorInput;
  onDecide: (next: MappingDecision | null) => void;
}

/**
 * A listing the host still has to decide about: the listing as the channel manager has it, the proposal CasaZen makes, and the answers.
 * At most about five things to read (NF-04): the listing (name, address and capacity), the proposed property (name, address and capacity).
 * The select of properties and the question about the room come only after the answer that needs them.
 */
function OpenListingRow({ listing, decision, properties, taken, chosenElsewhere, propertyError, roomError, onDecide }: OpenListingRowProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const groupName = useId();
  const listingId = listing.octorateAccommodationId;
  const name = listingName(listing, t);
  const choice = choiceOf(decision);
  const proposed = listing.proposedProperty;
  const rejected = listing.status === 'Rejected';
  const ambiguous = listing.status === 'Ambiguous';
  // A property that is proposed, or among the candidates, is blocked for writes until a person confirms (OCT-04). An ambiguous listing
  // also stays in the "To do" the server opened for it; a listing with one clear proposal has no such item.
  const laterHint = ambiguous
    ? t('octorate.connect.mapping.choice.laterBlocked')
    : proposed !== null
      ? t('octorate.connect.mapping.choice.laterWaits')
      : undefined;
  const offerOther = listing.candidates.length > 0 || !(properties.state === 'ready' && properties.all.length === 0);
  const askRoom = decision !== undefined && decision.needsRoom && decision.action !== 'reject';

  const proposedCapacity = proposed ? capacityText(properties.byId.get(proposed.id)?.maxGuests, t) : '';
  const select = (next: MappingChoice) => onDecide(decisionFor(listing, next, decision));
  const radio = (value: MappingChoice, label: string, hint?: string) => (
    <ChoiceRadio
      name={groupName}
      value={value}
      checked={choice === value}
      label={label}
      hint={hint}
      onSelect={() => select(value)}
      testId={`octorate-mapping-${value}-${listingId}`}
    />
  );
  // Built here and not in the markup: the answers are a function of the listing, and the markup reads them by name.
  const confirmChoice = proposed ? radio('confirm', t('octorate.connect.mapping.choice.confirm')) : null;
  const otherChoice = offerOther
    ? radio('other', proposed ? t('octorate.connect.mapping.choice.other') : t('octorate.connect.mapping.choice.pickExisting'))
    : null;
  const importChoice = radio('import', t('octorate.connect.mapping.choice.import'), t('octorate.connect.mapping.choice.importHint'));
  const laterChoice = radio(
    'later',
    rejected ? t('octorate.connect.mapping.choice.keepExcluded') : t('octorate.connect.mapping.choice.later'),
    laterHint,
  );
  const rejectChoice = radio('reject', t('octorate.connect.mapping.choice.reject'), t('octorate.connect.mapping.choice.rejectHint'));

  return (
    <li data-testid={`octorate-mapping-row-${listingId}`}>
      <section aria-labelledby={titleId} className="space-y-3 rounded-lg border p-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id={titleId} className="break-words font-semibold">
              {name}
            </h3>
            <p className="break-words text-sm text-muted-foreground">
              {detailsLine(listingAddress(listing), capacityText(listing.maxGuests, t))}
            </p>
          </div>
          <ListingStateBadge listing={listing} />
        </div>

        {proposed ? (
          <div className="min-w-0 rounded-md bg-muted p-3 text-sm" data-testid={`octorate-mapping-proposal-${listingId}`}>
            <p className="text-muted-foreground">{t('octorate.connect.mapping.proposal.label')}</p>
            <p className="break-words font-medium">{proposed.name}</p>
            <p className="break-words text-muted-foreground">{detailsLine(listingAddress(proposed), proposedCapacity)}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {ambiguous ? t('octorate.connect.mapping.proposal.ambiguous') : t('octorate.connect.mapping.proposal.none')}
          </p>
        )}
        {rejected ? <p className="text-sm text-muted-foreground">{t('octorate.connect.mapping.rejectedNote')}</p> : null}

        <fieldset className="space-y-0.5">
          <legend className="sr-only">{t('octorate.connect.mapping.choice.legend', { name })}</legend>
          {confirmChoice}
          {otherChoice}
          {importChoice}
          {laterChoice}
          {rejected ? null : (
            <details open={choice === 'reject'} className="text-sm">
              <summary className="flex min-h-11 cursor-pointer items-center px-2 text-muted-foreground">
                {t('octorate.connect.mapping.moreOptions')}
              </summary>
              {rejectChoice}
            </details>
          )}
        </fieldset>

        {choice === 'other' && decision ? (
          <Field label={t('octorate.connect.mapping.pick.label')} error={propertyError}>
            <Select
              value={decision.propertyId}
              onChange={(event) => onDecide({ ...decision, propertyId: event.target.value })}
              data-testid={`octorate-mapping-property-${listingId}`}
            >
              <option value="">{t('octorate.connect.mapping.pick.placeholder')}</option>
              <PropertyOptions listing={listing} properties={properties} taken={taken} chosenElsewhere={chosenElsewhere} />
            </Select>
          </Field>
        ) : null}

        {askRoom && decision ? (
          <Field label={t('octorate.connect.mapping.room.question')} hint={t('octorate.connect.mapping.room.hint')} error={roomError}>
            <Select
              value={decision.roomId}
              onChange={(event) => onDecide({ ...decision, roomId: event.target.value })}
              data-testid={`octorate-mapping-room-${listingId}`}
            >
              <option value="">{t('octorate.connect.mapping.room.placeholder')}</option>
              {listing.rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {roomName(room, t)}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </section>
    </li>
  );
}

interface LinkedListingRowProps {
  listing: OctorateListing;
  decision: MappingDecision | undefined;
  roomError: FieldErrorInput;
  onDecide: (next: MappingDecision | null) => void;
}

/**
 * A listing confirmed already (earlier, or by someone else meanwhile): nothing to decide, except the room of a listing with several
 * rooms that has none yet. A property is one unit; until the room is set CasaZen does not know which one to write to.
 */
function LinkedListingRow({ listing, decision, roomError, onDecide }: LinkedListingRowProps) {
  const { t } = useTranslation();
  const listingId = listing.octorateAccommodationId;
  const room = listing.rooms.find((candidate) => candidate.id === listing.octorateProductId);
  const needsRoom = hasSeveralRooms(listing) && !room;

  return (
    <li className="space-y-2 rounded-lg border p-4" data-testid={`octorate-mapping-linked-${listingId}`}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words font-semibold">{listingName(listing, t)}</h3>
          {listing.proposedProperty ? (
            <p className="break-words text-sm text-muted-foreground">
              {t('octorate.connect.mapping.linkedTo', { property: listing.proposedProperty.name })}
            </p>
          ) : null}
        </div>
        <ListingStateBadge listing={listing} />
      </div>
      {room ? <p className="break-words text-sm">{t('octorate.connect.mapping.room.chosen', { room: roomName(room, t) })}</p> : null}
      {needsRoom ? (
        <Field label={t('octorate.connect.mapping.room.question')} hint={t('octorate.connect.mapping.room.hint')} error={roomError}>
          <Select
            value={decision?.roomId ?? ''}
            onChange={(event) => onDecide(roomDecision(listing, event.target.value))}
            data-testid={`octorate-mapping-room-${listingId}`}
          >
            <option value="">{t('octorate.connect.mapping.room.placeholder')}</option>
            {listing.rooms.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {roomName(candidate, t)}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
    </li>
  );
}

/**
 * Step 5, "Abbinamento" (E02/F01/US02/T05, NF-28, NF-04): for each listing the channel manager holds, which CasaZen property it is. CasaZen
 * proposes one by address, name and capacity; the host confirms it, picks another of their properties, or imports the listing as a new
 * property (only in CasaZen: nothing is created on the channel manager, ADR-027-R8). A listing can be left for later: it stays to do, and
 * the writes to its property stay blocked until it is confirmed (OCT-04). A listing with several rooms asks which room is the property.
 *
 * Nothing is sent from here: the answers are the wizard's own (and its draft); the summary shows what they will do and the last button does
 * it. A property already confirmed to another listing cannot be picked, and the server's 409 is shown as a clear message if it happens.
 */
export function MappingStep() {
  const { t } = useTranslation();
  const listings = useFoundListings();
  const properties = useShortRentProperties();
  const { control, setValue, formState } = useFormContext<ConnectWizardValues>();
  const decisions = useWatch({ control, name: 'decisions' }) ?? NO_DECISIONS;

  // The listings move on while the host decides (or while a draft waits): an answer about a listing that is gone or confirmed already is
  // dropped, so that a rule about a row nobody can see never stops the step.
  const loaded = listings.isSuccess ? listings.data : null;
  useEffect(() => {
    if (loaded === null) return;
    const current = pruneDecisions(decisions, loaded);
    if (current !== decisions) setValue('decisions', [...current], { shouldDirty: true });
  }, [loaded, decisions, setValue]);

  // The server proposes among every property of the org and the host picks among the short-rent ones: the rows wait for both, so that a
  // proposal the host cannot pick is never on screen, not even for a moment.
  if (listings.isPending || properties.isPending) {
    return (
      <div className="flex min-w-0 items-center gap-3 rounded-lg bg-muted p-4 text-sm" data-testid="octorate-mapping-loading">
        <Spinner size="sm" />
        <span className="min-w-0 break-words">{t('octorate.connect.mapping.loading')}</span>
      </div>
    );
  }
  if (listings.isError) {
    return (
      <StepProblem
        title={t('octorate.connect.mapping.loadFailed')}
        error={listings.error}
        onRetry={() => void listings.refetch()}
        testId="octorate-mapping-error"
      />
    );
  }

  const found = forShortRent(listings.data, shortRentIdsOf(properties.data));
  const open = found.filter(isOpenListing);
  const linked = found.filter((listing) => !isOpenListing(listing));
  const choices: PropertyChoices = {
    state: properties.isError ? 'error' : 'ready',
    all: properties.data ?? [],
    byId: new Map((properties.data ?? []).map((property) => [property.id, property])),
  };
  const taken = propertiesTaken(found);
  const chosen = propertiesChosen(decisions);
  const proposals = clearProposals(found, decisions);
  const errorsOf = (listingId: string) => {
    const index = decisions.findIndex((decision) => decision.listingId === listingId);
    const errors = index >= 0 ? formState.errors.decisions?.[index] : undefined;
    return { property: errors?.propertyId, room: errors?.roomId };
  };

  const decide = (listing: OctorateListing, next: MappingDecision | null) =>
    setValue('decisions', replaceDecision(decisions, listing.octorateAccommodationId, next), { shouldDirty: true });

  const confirmClearProposals = () => {
    let next = decisions;
    for (const listing of proposals) {
      next = replaceDecision(next, listing.octorateAccommodationId, decisionFor(listing, 'confirm'));
    }
    setValue('decisions', next, { shouldDirty: true });
  };

  return (
    <div className="space-y-4" data-testid="octorate-mapping-step">
      <p className="text-sm text-muted-foreground">{t('octorate.connect.mapping.intro')}</p>

      {properties.isError ? (
        <Alert
          variant="warning"
          data-testid="octorate-mapping-properties-error"
          action={
            <Button type="button" size="sm" variant="outline" onClick={() => void properties.refetch()}>
              {t('shared.errorState.retry')}
            </Button>
          }
        >
          {t('octorate.connect.mapping.pick.loadFailed')}
        </Alert>
      ) : null}

      {found.length === 0 ? <p className="text-sm" data-testid="octorate-mapping-empty">{t('octorate.connect.mapping.empty')}</p> : null}

      {proposals.length > 0 ? (
        <div>
          <Button type="button" variant="outline" size="sm" onClick={confirmClearProposals} data-testid="octorate-mapping-confirm-all">
            {t('octorate.connect.mapping.confirmAll', { count: proposals.length })}
          </Button>
        </div>
      ) : null}

      {open.length > 0 ? (
        <ul className="space-y-3" role="list" aria-label={t('octorate.connect.mapping.listLabel')}>
          {open.map((listing) => {
            const listingId = listing.octorateAccommodationId;
            const errors = errorsOf(listingId);
            return (
              <OpenListingRow
                key={listingId}
                listing={listing}
                decision={findDecision(decisions, listingId)}
                properties={choices}
                taken={taken}
                chosenElsewhere={chosen}
                propertyError={errors.property}
                roomError={errors.room}
                onDecide={(next) => decide(listing, next)}
              />
            );
          })}
        </ul>
      ) : null}

      {linked.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{t('octorate.connect.mapping.alreadyLinked')}</h3>
          <ul className="space-y-3" role="list">
            {linked.map((listing) => {
              const listingId = listing.octorateAccommodationId;
              return (
                <LinkedListingRow
                  key={listingId}
                  listing={listing}
                  decision={findDecision(decisions, listingId)}
                  roomError={errorsOf(listingId).room}
                  onDecide={(next) => decide(listing, next)}
                />
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
