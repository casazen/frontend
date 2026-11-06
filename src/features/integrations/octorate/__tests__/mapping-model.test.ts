import { describe, expect, it, vi } from 'vitest';
import {
  MAPPING_STEP_SCHEMA,
  buildMappingPlan,
  choiceOf,
  clearProposals,
  decisionFor,
  decisionsAreReadable,
  forShortRent,
  mergeOutcomes,
  pruneDecisions,
  readDecisions,
  replaceDecision,
  resultRows,
  roomDecision,
  runMappingPlan,
  settleOutcomes,
  shortRentIdsOf,
  type MappingDecision,
  type MappingRunner,
} from '../mapping-model';
import type { OctorateListing } from '@/types';
import { linkedListing, listing, newListing } from './octorate-fixtures';

const TWO_ROOMS = [
  { id: 'room-1', name: 'Doppia', maxGuests: 2 },
  { id: 'room-2', name: 'Suite', maxGuests: 4 },
];

/** A property confirmed to some listing: the fixtures give every listing the same proposed property, so the confirmed ones are told apart. */
const HELD = { id: 'prop-8', name: 'Casa Gialla', address: 'Via Po 3', city: 'Torino' };

function decision(overrides: Partial<MappingDecision> = {}): MappingDecision {
  return { listingId: 'acc-1', action: 'confirm', propertyId: 'prop-1', other: false, needsRoom: false, roomId: '', ...overrides };
}

/** The messages the step refuses with, by the field that holds the problem. */
function problems(decisions: unknown) {
  const result = MAPPING_STEP_SCHEMA.safeParse({ decisions });
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
}

describe('what the host decides about a listing', () => {
  it('decisionFor_EachChoice_IsTheDecisionItStandsForAndLaterIsNone', () => {
    const proposed = listing();

    expect(decisionFor(proposed, 'later')).toBeNull();
    expect(decisionFor(proposed, 'confirm')).toMatchObject({ action: 'confirm', propertyId: 'prop-1', other: false });
    expect(decisionFor(proposed, 'other')).toMatchObject({ action: 'confirm', propertyId: '', other: true });
    expect(decisionFor(proposed, 'import')).toMatchObject({ action: 'import', propertyId: '' });
    expect(decisionFor(proposed, 'reject')).toMatchObject({ action: 'reject', needsRoom: false });
    // Each decision reads back as the choice that made it.
    expect(choiceOf(decisionFor(proposed, 'confirm') ?? undefined)).toBe('confirm');
    expect(choiceOf(decisionFor(proposed, 'other') ?? undefined)).toBe('other');
    expect(choiceOf(decisionFor(proposed, 'import') ?? undefined)).toBe('import');
    expect(choiceOf(decisionFor(proposed, 'reject') ?? undefined)).toBe('reject');
    expect(choiceOf(undefined)).toBe('later');
  });

  it('decisionFor_ListingWithSeveralRooms_AsksForTheRoomAndKeepsItWhenTheChoiceChanges', () => {
    const several = listing({ rooms: TWO_ROOMS });
    const chosen = { ...decision({ needsRoom: true, roomId: 'room-2' }) };

    expect(decisionFor(several, 'confirm')).toMatchObject({ needsRoom: true, roomId: '' });
    // The room belongs to the listing, not to the answer: going from "confirm" to "import" keeps it.
    expect(decisionFor(several, 'import', chosen)).toMatchObject({ action: 'import', needsRoom: true, roomId: 'room-2' });
    // A room the listing does not have is not kept.
    expect(decisionFor(several, 'import', { ...chosen, roomId: 'room-9' })).toMatchObject({ roomId: '' });
    // A listing with one room asks nothing.
    expect(decisionFor(listing(), 'confirm')).toMatchObject({ needsRoom: false });
  });

  it('decisionFor_GoingFromTheListToTheListAgain_KeepsThePropertyButTheProposalNeverInheritsIt', () => {
    const picked = decision({ other: true, propertyId: 'prop-9' });

    expect(decisionFor(listing(), 'other', picked)).toMatchObject({ propertyId: 'prop-9' });
    expect(decisionFor(listing(), 'confirm', picked)).toMatchObject({ propertyId: 'prop-1', other: false });
  });

  it('replaceDecision_AnAnswerChanged_KeepsItsPositionAndNeverTouchesTheOthers', () => {
    const first = decision({ listingId: 'a' });
    const second = decision({ listingId: 'b', propertyId: 'prop-2' });
    const decisions = [first, second];

    const changed = replaceDecision(decisions, 'a', decision({ listingId: 'a', action: 'import', propertyId: '' }));
    expect(changed.map((entry) => `${entry.listingId}:${entry.action}`)).toEqual(['a:import', 'b:confirm']);
    expect(replaceDecision(decisions, 'a', null).map((entry) => entry.listingId)).toEqual(['b']);
    expect(replaceDecision(decisions, 'c', decision({ listingId: 'c' })).map((entry) => entry.listingId)).toEqual(['a', 'b', 'c']);
    // The form keeps its own array: a new one comes back.
    expect(decisions).toEqual([first, second]);
  });

  it('readDecisions_ValueFromADraft_IsUsedOnlyWhenEveryEntryIsADecision', () => {
    expect(readDecisions([decision()])).toEqual([decision()]);
    expect(readDecisions('not-a-list')).toEqual([]);
    expect(readDecisions([{ ...decision(), action: 'delete-everything' }])).toEqual([]);
    expect(decisionsAreReadable(undefined)).toBe(true);
    expect(decisionsAreReadable([decision()])).toBe(true);
    expect(decisionsAreReadable('not-a-list')).toBe(false);
    expect(decisionsAreReadable([{ listingId: 1 }])).toBe(false);
  });
});

describe('the properties a listing can be', () => {
  const longRent = { id: 'prop-long', name: 'Casa Lunga', address: 'Via Po 9', city: 'Torino' };
  const shortRent = { id: 'prop-1', name: 'Casa Rosa', address: 'Via Roma 12', city: 'Milano' };

  it('forShortRent_ProposalOrCandidateThatIsNotAShortRentProperty_IsLeftOutAndNothingElseIsTouched', () => {
    const proposedLong = listing({ octorateAccommodationId: 'proposed-long', proposedProperty: longRent });
    const proposedShort = listing({ octorateAccommodationId: 'proposed-short' });
    const ambiguous = listing({ octorateAccommodationId: 'ambiguous', status: 'Ambiguous', proposedProperty: null, candidates: [longRent, shortRent] });
    const confirmed = linkedListing({ octorateAccommodationId: 'confirmed', proposedProperty: longRent });

    const found = forShortRent([proposedLong, proposedShort, ambiguous, confirmed], shortRentIdsOf([{ id: 'prop-1' }]));

    // The server proposed a long-rent property: the host sees no proposal, and the listing reads as one with no match.
    expect(found[0].proposedProperty).toBeNull();
    expect(found[0].status).toBe('Proposed');
    // A listing with nothing to leave out is the same object; the candidates of an ambiguous one are the short-rent ones only.
    expect(found[1]).toBe(proposedShort);
    expect(found[2].candidates.map((candidate) => candidate.id)).toEqual(['prop-1']);
    expect(found[2].status).toBe('Ambiguous');
    // A listing confirmed is a fact, whatever the property is.
    expect(found[3]).toBe(confirmed);
    // The listings that came in are not touched.
    expect(proposedLong.proposedProperty).toBe(longRent);
    expect(ambiguous.candidates).toHaveLength(2);
  });

  it('forShortRent_NoListOfProperties_LeavesNothingOut', () => {
    const proposedLong = listing({ proposedProperty: longRent });

    // The read of the properties failed: the host's list is not there to say what is short-rent, and the step says so.
    const listings = [proposedLong];
    expect(forShortRent(listings, shortRentIdsOf(undefined))).toBe(listings);
    expect(shortRentIdsOf(undefined)).toBeNull();
    // No short-rent property at all: no proposal is a property the host can pick.
    expect(forShortRent(listings, shortRentIdsOf([]))[0].proposedProperty).toBeNull();
  });
});

describe('answers about listings that moved on', () => {
  it('pruneDecisions_ListingsConfirmedOrGoneMeanwhile_DropsTheAnswersThatNoLongerApply', () => {
    // A property is confirmed to one listing only: the confirmed listings hold one that is not the proposal of the open one.
    const held = (overrides: Partial<OctorateListing>) => linkedListing({ proposedProperty: HELD, ...overrides });
    const listings = [
      listing({ octorateAccommodationId: 'open' }),
      listing({ octorateAccommodationId: 'room-on-open' }),
      held({ octorateAccommodationId: 'confirmed-meanwhile' }),
      held({ octorateAccommodationId: 'no-room', rooms: TWO_ROOMS, octorateProductId: null }),
      held({ octorateAccommodationId: 'same-room', rooms: TWO_ROOMS, octorateProductId: 'room-2' }),
      held({ octorateAccommodationId: 'imported', rooms: TWO_ROOMS, octorateProductId: null }),
      held({ octorateAccommodationId: 'excluded-confirmed' }),
      listing({ octorateAccommodationId: 'already-excluded', status: 'Rejected', proposedProperty: null }),
      listing({ octorateAccommodationId: 'reconsidered', status: 'Rejected', proposedProperty: null }),
    ];
    const decisions = [
      decision({ listingId: 'open' }),
      decision({ listingId: 'gone' }),
      decision({ listingId: 'room-on-open', action: 'room', propertyId: '', roomId: 'room-2' }),
      decision({ listingId: 'confirmed-meanwhile', propertyId: 'prop-7' }),
      decision({ listingId: 'no-room', action: 'room', propertyId: '', roomId: 'room-2' }),
      decision({ listingId: 'same-room', action: 'room', propertyId: '', roomId: 'room-2' }),
      // The import went through and only its room failed: the answer stays, the next run sets the room.
      decision({ listingId: 'imported', action: 'import', propertyId: '', needsRoom: true, roomId: 'room-2' }),
      decision({ listingId: 'excluded-confirmed', action: 'reject', propertyId: '' }),
      // The run that excluded the listing left its answer behind: the listing is not excluded a second time.
      decision({ listingId: 'already-excluded', action: 'reject', propertyId: '' }),
      // An excluded listing can still be imported, if the host changes their mind.
      decision({ listingId: 'reconsidered', action: 'import', propertyId: '' }),
    ];

    expect(pruneDecisions(decisions, listings).map((entry) => entry.listingId)).toEqual(['open', 'no-room', 'imported', 'reconsidered']);
  });

  it('pruneDecisions_ProposalMovedOrPropertyTakenMeanwhile_DropsTheConfirmationsOfSomethingTheHostDidNotSee', () => {
    const casaBlu = { id: 'prop-2', name: 'Casa Blu', address: 'Via Po 1', city: 'Torino' };
    const casaVerde = { id: 'prop-9', name: 'Casa Verde', address: 'Via Po 2', city: 'Torino' };
    const listings = [
      listing({ octorateAccommodationId: 'moved', proposedProperty: casaBlu }),
      listing({ octorateAccommodationId: 'vanished', proposedProperty: null, offeredForImport: true }),
      listing({ octorateAccommodationId: 'same' }),
      listing({ octorateAccommodationId: 'picked', status: 'Ambiguous', proposedProperty: null }),
      listing({ octorateAccommodationId: 'picked-taken', status: 'Ambiguous', proposedProperty: null }),
      listing({ octorateAccommodationId: 'proposal-taken', proposedProperty: casaVerde }),
      listing({ octorateAccommodationId: 'choosing', status: 'Ambiguous', proposedProperty: null }),
      linkedListing({ octorateAccommodationId: 'holder', proposedProperty: casaVerde }),
    ];
    const decisions = [
      // The host confirmed Casa Rosa; the server proposes Casa Blu now: the radio would stay checked under another property.
      decision({ listingId: 'moved' }),
      // The proposal is gone: there is no radio to show the answer, which would stay active.
      decision({ listingId: 'vanished' }),
      decision({ listingId: 'same' }),
      decision({ listingId: 'picked', propertyId: 'prop-5', other: true }),
      // Casa Verde was confirmed to another listing meanwhile.
      decision({ listingId: 'picked-taken', propertyId: 'prop-9', other: true }),
      decision({ listingId: 'proposal-taken', propertyId: 'prop-9' }),
      // "Another property" and none picked yet: the host is still choosing.
      decision({ listingId: 'choosing', propertyId: '', other: true }),
    ];

    expect(pruneDecisions(decisions, listings).map((entry) => entry.listingId)).toEqual(['same', 'picked', 'choosing']);
  });

  it('pruneDecisions_NothingToDrop_GivesBackTheSameArray', () => {
    const decisions = [decision()];

    expect(pruneDecisions(decisions, [listing()])).toBe(decisions);
  });
});

describe('the rules of the mapping step', () => {
  it('MAPPING_STEP_SCHEMA_ADecisionsThatHoldTogether_Passes', () => {
    expect(problems([])).toEqual([]);
    expect(problems([decision(), decision({ listingId: 'acc-2', propertyId: 'prop-2' })])).toEqual([]);
    expect(problems([decision({ action: 'import', propertyId: '' }), decision({ listingId: 'acc-2', action: 'reject', propertyId: '' })])).toEqual([]);
  });

  it('MAPPING_STEP_SCHEMA_AConfirmationWithoutItsProperty_SaysWhichPropertyIsMissing', () => {
    expect(problems([decision({ propertyId: '', other: true })])).toEqual(['decisions.0.propertyId: octorate.connect.mapping.errors.propertyRequired']);
  });

  it('MAPPING_STEP_SCHEMA_APropertyChosenForTwoListings_IsRefusedOnTheSecondOne', () => {
    // A property is confirmed to one listing only (the server answers 409 otherwise): the form says it before anything is sent.
    expect(problems([decision(), decision({ listingId: 'acc-2' })])).toEqual(['decisions.1.propertyId: octorate.connect.mapping.errors.propertyTwice']);
  });

  it('MAPPING_STEP_SCHEMA_AListingWithSeveralRooms_NeedsTheRoomBecauseAPropertyIsOneUnit', () => {
    expect(problems([decision({ needsRoom: true })])).toEqual(['decisions.0.roomId: octorate.connect.mapping.errors.roomRequired']);
    expect(problems([decision({ needsRoom: true, roomId: 'room-2' })])).toEqual([]);
    expect(problems([decision({ action: 'import', propertyId: '', needsRoom: true })])).toEqual(['decisions.0.roomId: octorate.connect.mapping.errors.roomRequired']);
    // A listing the host leaves out needs no room.
    expect(problems([decision({ action: 'reject', propertyId: '', needsRoom: true })])).toEqual([]);
  });
});

describe('what the decisions make CasaZen do', () => {
  it('buildMappingPlan_DecisionsOfTheListings_BecomeActionsInTheOrderOfTheListings', () => {
    const a = listing({ octorateAccommodationId: 'a' });
    const b = newListing({ octorateAccommodationId: 'b' });
    const c = listing({ octorateAccommodationId: 'c', status: 'Ambiguous', proposedProperty: null });

    const plan = buildMappingPlan(
      [a, b, c],
      [
        decision({ listingId: 'b', action: 'import', propertyId: '', roomId: 'room-1' }),
        // Another property than the proposed one, picked by the host from the list.
        decision({ listingId: 'a', propertyId: 'prop-5', other: true, roomId: 'room-2' }),
        decision({ listingId: 'c', action: 'reject', propertyId: '' }),
      ],
    );

    expect(plan.actions).toEqual([
      { kind: 'confirm', listingId: 'a', propertyId: 'prop-5', roomId: 'room-2' },
      { kind: 'import', listingId: 'b', roomId: 'room-1' },
      { kind: 'reject', listingId: 'c' },
    ]);
    expect(plan.later).toEqual([]);
  });

  it('buildMappingPlan_ListingWithNoDecision_IsLeftForLaterAndNothingIsSentForIt', () => {
    const ambiguous = listing({ octorateAccommodationId: 'ambiguous', status: 'Ambiguous', proposedProperty: null });
    const proposed = listing({ octorateAccommodationId: 'proposed' });
    const excluded = listing({ octorateAccommodationId: 'excluded', status: 'Rejected', proposedProperty: null });

    const plan = buildMappingPlan([ambiguous, proposed, excluded], []);

    // Nothing is written to a property until a person confirms it (OCT-04): no decision, no action.
    expect(plan.actions).toEqual([]);
    expect(plan.later.map((entry) => entry.octorateAccommodationId)).toEqual(['ambiguous', 'proposed']);
  });

  it('buildMappingPlan_ListingConfirmedMeanwhile_IsNeverConfirmedTwice', () => {
    const already = linkedListing({ octorateAccommodationId: 'acc-1', octorateProductId: 'room-1' });

    const plan = buildMappingPlan([already], [decision({ listingId: 'acc-1', propertyId: 'prop-7', roomId: 'room-1' }), decision({ listingId: 'gone' })]);

    expect(plan.actions).toEqual([]);
    expect(plan.later).toEqual([]);
  });

  it('buildMappingPlan_ConfirmationOfAProposalThatMoved_ConfirmsNothingAndLeavesTheListingForLater', () => {
    const moved = listing({ octorateAccommodationId: 'acc-1', proposedProperty: { id: 'prop-2', name: 'Casa Blu', address: 'Via Po 1', city: 'Torino' } });

    // The answer confirms Casa Rosa (prop-1), the old proposal: the plan must not confirm a property the host did not see.
    const plan = buildMappingPlan([moved], [decision()]);

    expect(plan.actions).toEqual([]);
    expect(plan.later.map((entry) => entry.octorateAccommodationId)).toEqual(['acc-1']);
  });

  it('buildMappingPlan_ExcludeAnswerOfAListingExcludedAlready_IsNotSentAgainNorListedAsLater', () => {
    const excluded = listing({ octorateAccommodationId: 'excluded', status: 'Rejected', proposedProperty: null });
    const reconsidered = listing({ octorateAccommodationId: 'reconsidered', status: 'Rejected', proposedProperty: null });
    const proposed = listing({ octorateAccommodationId: 'proposed' });

    const plan = buildMappingPlan(
      [excluded, reconsidered, proposed],
      [
        decision({ listingId: 'excluded', action: 'reject', propertyId: '' }),
        decision({ listingId: 'reconsidered', action: 'import', propertyId: '' }),
        decision({ listingId: 'proposed', action: 'reject', propertyId: '' }),
      ],
    );

    // The second run does not send the DELETE of the first one again; the listing the host reconsidered is imported; a listing that is
    // still to exclude is excluded. The one excluded already is neither an action nor "left for later".
    expect(plan.actions).toEqual([
      { kind: 'import', listingId: 'reconsidered', roomId: '' },
      { kind: 'reject', listingId: 'proposed' },
    ]);
    expect(plan.later).toEqual([]);
  });

  it('buildMappingPlan_ConfirmedListingWithoutARoom_OnlySetsTheRoom', () => {
    const several = linkedListing({ rooms: TWO_ROOMS, octorateProductId: null });

    expect(buildMappingPlan([several], [roomDecision(several, 'room-2') as MappingDecision]).actions).toEqual([
      { kind: 'room', listingId: 'acc-1', roomId: 'room-2' },
    ]);
    // A room the listing does not have, or the one it has already, changes nothing.
    expect(buildMappingPlan([several], [decision({ action: 'room', roomId: 'room-9', propertyId: '' })]).actions).toEqual([]);
    expect(buildMappingPlan([{ ...several, octorateProductId: 'room-2' }], [roomDecision(several, 'room-2') as MappingDecision]).actions).toEqual([]);
    expect(roomDecision(several, '')).toBeNull();
  });

  it('clearProposals_OnlyAClearProposalNobodyHasYet_IsConfirmedByTheShortcut', () => {
    const clear = listing({ octorateAccommodationId: 'clear' });
    const sameProperty = listing({ octorateAccommodationId: 'same' });
    const decided = listing({ octorateAccommodationId: 'decided', proposedProperty: { id: 'prop-2', name: 'Casa Blu', address: 'Via Po 1', city: 'Torino' } });
    const taken = listing({ octorateAccommodationId: 'taken', proposedProperty: { id: 'prop-3', name: 'Casa Verde', address: 'Via Po 2', city: 'Torino' } });
    const ambiguous = listing({ octorateAccommodationId: 'ambiguous', status: 'Ambiguous', proposedProperty: null });
    const confirmedElsewhere = linkedListing({ octorateAccommodationId: 'linked', proposedProperty: { id: 'prop-3', name: 'Casa Verde', address: 'Via Po 2', city: 'Torino' } });

    const found = clearProposals(
      [clear, sameProperty, decided, taken, ambiguous, confirmedElsewhere],
      [decision({ listingId: 'decided', action: 'import', propertyId: '' })],
    );

    // 'same' proposes the property 'clear' already has; 'decided' has an answer; 'taken' is confirmed to another listing; an ambiguous
    // listing has no clear proposal at all.
    expect(found.map((entry) => entry.octorateAccommodationId)).toEqual(['clear']);
  });
});

describe('doing it', () => {
  function runner(overrides: Partial<MappingRunner> = {}): MappingRunner {
    return {
      confirm: vi.fn().mockResolvedValue(undefined),
      importListing: vi.fn().mockResolvedValue(undefined),
      reject: vi.fn().mockResolvedValue(undefined),
      setRoom: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  it('runMappingPlan_AListingThatFails_DoesNotStopTheOthersAndIsReportedWithItsError', async () => {
    const refused = new Error('property taken');
    const calls = runner({ confirm: vi.fn().mockRejectedValueOnce(refused).mockResolvedValue(undefined) });
    const progress = vi.fn();

    const outcomes = await runMappingPlan(
      [
        { kind: 'confirm', listingId: 'a', propertyId: 'prop-1', roomId: '' },
        { kind: 'confirm', listingId: 'b', propertyId: 'prop-2', roomId: 'room-2' },
        { kind: 'import', listingId: 'c', roomId: '' },
        { kind: 'reject', listingId: 'd' },
      ],
      calls,
      progress,
    );

    expect(outcomes).toEqual([
      { listingId: 'a', kind: 'failed', error: refused },
      { listingId: 'b', kind: 'linked' },
      { listingId: 'c', kind: 'imported', imported: true },
      { listingId: 'd', kind: 'excluded' },
    ]);
    expect(calls.confirm).toHaveBeenCalledWith('b', 'prop-2', 'room-2');
    expect(progress.mock.calls).toEqual([
      [1, 4],
      [2, 4],
      [3, 4],
      [4, 4],
    ]);
  });

  it('runMappingPlan_ImportOfAListingWithSeveralRooms_ThenChoosesTheRoomOfTheNewProperty', async () => {
    const calls = runner();

    const outcomes = await runMappingPlan([{ kind: 'import', listingId: 'a', roomId: 'room-2' }], calls);

    expect(outcomes).toEqual([{ listingId: 'a', kind: 'imported', imported: true }]);
    expect(calls.importListing).toHaveBeenCalledWith('a');
    expect(calls.setRoom).toHaveBeenCalledWith('a', 'room-2');
  });

  it('runMappingPlan_ImportThatCannotSetTheRoom_IsReportedButRemembersTheImport', async () => {
    const refused = new Error('room invalid');
    const calls = runner({ setRoom: vi.fn().mockRejectedValue(refused) });

    const outcomes = await runMappingPlan([{ kind: 'import', listingId: 'a', roomId: 'room-2' }], calls);

    // The property exists and the listing is confirmed to it: only the room is missing, and the next run sets it.
    expect(outcomes).toEqual([{ listingId: 'a', kind: 'failed', imported: true, error: refused }]);
  });

  it('mergeOutcomes_ASecondRun_ReplacesTheFailureAndNeverForgetsAnImport', () => {
    const before = [
      { listingId: 'a', kind: 'failed' as const, error: new Error('x') },
      { listingId: 'b', kind: 'failed' as const, imported: true, error: new Error('room') },
      { listingId: 'c', kind: 'linked' as const },
    ];

    const merged = mergeOutcomes(before, [
      { listingId: 'a', kind: 'linked' },
      { listingId: 'b', kind: 'room' },
    ]);

    expect(merged.map((outcome) => `${outcome.listingId}:${outcome.kind}:${Boolean(outcome.imported)}`)).toEqual(['a:linked:false', 'b:room:true', 'c:linked:false']);
    expect(merged.find((outcome) => outcome.listingId === 'a')).not.toHaveProperty('error');
  });

  it('settleOutcomes_FailureOfAListingWithNothingLeftToDo_IsDroppedAndAnImportIsNotForgotten', () => {
    const before = [
      { listingId: 'waiting', kind: 'failed' as const, error: new Error('taken') },
      { listingId: 'left-for-later', kind: 'failed' as const, error: new Error('taken') },
      { listingId: 'room-set-elsewhere', kind: 'failed' as const, imported: true, error: new Error('room') },
      { listingId: 'linked', kind: 'linked' as const },
    ];

    const settled = settleOutcomes(before, { actions: [{ kind: 'confirm', listingId: 'waiting', propertyId: 'prop-1', roomId: '' }] });

    // The listing the host left for later has no action in the plan: its old error is not the last word about it.
    expect(settled.map((outcome) => `${outcome.listingId}:${outcome.kind}`)).toEqual(['waiting:failed', 'room-set-elsewhere:imported', 'linked:linked']);
    // The import went through: the result still says "imported", and not "linked", and the error of the room is gone.
    expect(settled[1]).toEqual({ listingId: 'room-set-elsewhere', kind: 'imported', imported: true });
    // The failure of a listing still waiting keeps its error.
    expect(settled[0]).toBe(before[0]);
    // The outcomes before are not touched.
    expect(before).toHaveLength(4);
    expect(settleOutcomes([], { actions: [] })).toEqual([]);
  });

  it('resultRows_ListingsAsTheServerHasThem_SayWhatBecameOfEachOne', () => {
    const rows = resultRows(
      [
        linkedListing({ octorateAccommodationId: 'linked' }),
        linkedListing({ octorateAccommodationId: 'imported' }),
        listing({ octorateAccommodationId: 'later' }),
        listing({ octorateAccommodationId: 'excluded', status: 'Rejected', proposedProperty: null }),
        listing({ octorateAccommodationId: 'failed' }),
      ],
      [
        { listingId: 'imported', kind: 'imported', imported: true },
        { listingId: 'failed', kind: 'failed', error: new Error('x') },
      ],
    );

    expect(rows.map((row) => `${row.listing.octorateAccommodationId}:${row.kind}`)).toEqual([
      'linked:linked',
      'imported:imported',
      'later:later',
      'excluded:excluded',
      'failed:failed',
    ]);
    // Opened again later nothing knows what was imported: the server says a listing is confirmed.
    expect(resultRows([linkedListing()], null).map((row) => row.kind)).toEqual(['linked']);
  });
});
