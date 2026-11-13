import { useEffect, useMemo, useState } from 'react';
import { FormProvider, useFieldArray, useForm, useFormContext, useWatch, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { StayGuestDocumentFields, StayGuestPersonalFields } from '@/features/checkin/components/stay-guest-fields';
import type { CodeTableSource } from '@/features/checkin/components/code-table';
import {
  MAX_STAY_GUESTS,
  createStayGuestListSchema,
  followerTypeOf,
  requiresDocument,
  stayGuestDefaults,
} from '@/features/checkin/schemas/checkin.schema';
import { getProblemMessage } from '@/lib/api-errors';
import { useCheckInWizardState, useSaveCheckInGuests } from '@/queries/use-checkin-wizard';
import type { CheckInWizardState } from '@/types/checkin-wizard.types';
import type { StayGuestType } from '@/types/public-checkin.types';
import {
  statisticalFieldsOf,
  toGuestsPayload,
  wizardValuesFromState,
  type CheckInWizardValues,
} from '../lib/checkin-wizard-model';
import { applyGuestFieldProblems, guestFieldProblemsOf } from '../lib/guest-save-errors';
import { useFocusFromAddress } from '../lib/use-focus-from-address';
import { useHostCodeSource } from '../lib/use-host-code-source';

interface GuestsFieldsProps {
  state: CheckInWizardState;
  source: CodeTableSource;
  /** Also the identity document of each guest who needs one (the editor on its own; the wizard asks it on its next step). */
  withDocuments: boolean;
}

/** The guests of the stay: the card of each one, and the way to add and remove them. Inside the form of whoever mounts it. */
function GuestsFields({ state, source, withDocuments }: GuestsFieldsProps) {
  const { t } = useTranslation();
  const { control, getValues, setValue } = useFormContext<CheckInWizardValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'guests' });
  const guests = useWatch({ control, name: 'guests' });
  const statisticalFields = statisticalFieldsOf(state);
  const declared = state.booking.declaredGuests;

  const changeLeaderType = (type: StayGuestType) => {
    const follower = followerTypeOf(type);
    getValues('guests').forEach((_, index) => {
      if (index > 0) setValue(`guests.${index}.type`, follower, { shouldDirty: true });
    });
  };

  return (
    <div className="space-y-4" data-testid="checkin-wizard-guests">
      <p className="text-sm text-muted-foreground">{t('checkin.guestsIntro')}</p>
      {fields.length !== declared && (
        <p className="text-sm text-orange-700" data-testid="checkin-wizard-guest-count-mismatch">
          {t('checkin.guestCountMismatch', { count: declared })}
        </p>
      )}
      {fields.map((field, index) => (
        <div key={field.id} className="space-y-3">
          <StayGuestPersonalFields
            index={index}
            arrivalDate={state.booking.checkIn}
            source={source}
            requiredFields={statisticalFields}
            onLeaderTypeChange={index === 0 ? changeLeaderType : undefined}
            onRemove={index > 0 ? () => remove(index) : undefined}
          />
          {withDocuments && guests[index] && requiresDocument(guests[index].type) && (
            <StayGuestDocumentFields index={index} source={source} />
          )}
        </div>
      ))}
      {fields.length < MAX_STAY_GUESTS && (
        <Button
          type="button"
          variant="outline"
          onClick={() => append(stayGuestDefaults(followerTypeOf(getValues('guests')[0]?.type ?? 'SingleGuest')))}
          data-testid="checkin-wizard-add-guest"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          {t('checkin.addGuest')}
        </Button>
      )}
    </div>
  );
}

interface StandaloneGuestsEditorProps {
  bookingId: string;
  state: CheckInWizardState;
  source: CodeTableSource;
  onSaved?: (state: CheckInWizardState) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

/** The editor of the guests on its own: its own form, with the document of each guest, and its own "Save guests". */
function StandaloneGuestsEditor({ bookingId, state, source, onSaved, onDirtyChange }: StandaloneGuestsEditorProps) {
  const { t } = useTranslation();
  const save = useSaveCheckInGuests(bookingId);
  const [saveError, setSaveError] = useState<string | null>(null);
  const statisticalFields = useMemo(() => statisticalFieldsOf(state), [state]);
  const schema = useMemo(() => z.object({ guests: createStayGuestListSchema(statisticalFields) }), [statisticalFields]);
  const form = useForm<CheckInWizardValues>({ resolver: zodResolver(schema), defaultValues: wizardValuesFromState(state) });
  const { isDirty } = form.formState;

  // Whoever mounts the editor may need to know that there is something typed that the server does not hold (a panel that must not close over it).
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const onSubmit = form.handleSubmit(async (values) => {
    setSaveError(null);
    try {
      const saved = await save.mutateAsync(toGuestsPayload(values, statisticalFields));
      // What the server holds now is the baseline: nothing typed is waiting to be saved.
      form.reset(values);
      onSaved?.(saved);
    } catch (error) {
      const problems = guestFieldProblemsOf(error, values.guests.length, t('checkin.validation.invalidValue'));
      applyGuestFieldProblems(problems, form.setError);
      setSaveError(
        problems.length > 0 ? t('checkin.fixHighlightedFields') : (getProblemMessage(error, t) ?? t('checkin.wizard.guests.saveFailed')),
      );
    }
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="space-y-4" data-testid="guests-editor">
        <GuestsFields state={state} source={source} withDocuments />
        {saveError && (
          <p role="alert" className="text-sm text-destructive" data-testid="guests-editor-error">
            {saveError}
          </p>
        )}
        <Button type="submit" disabled={save.isPending} data-testid="guests-editor-save">
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('checkin.wizard.guests.save')}
        </Button>
      </form>
    </FormProvider>
  );
}

interface GuestsEditorProps {
  bookingId: string;
  /**
   * The form of the wizard that holds the guests. Given one, the editor shows the fields of the guests in it and the wizard saves them
   * (step by step, with "Continue" and "Save and exit"); without one it makes its own form, with the document of each guest and its own
   * button, and saves through `PUT /bookings/{id}/checkin-wizard/guests`.
   */
  form?: UseFormReturn<CheckInWizardValues>;
  /** The guests were saved (the editor on its own): the state the server answered. */
  onSaved?: (state: CheckInWizardState) => void;
  /** The editor on its own: whether something was typed that is not saved yet; `false` again once the guests are saved. */
  onDirtyChange?: (dirty: boolean) => void;
}

/**
 * The editor of the guests of a stay (E03/F01/US04/T02). It loads the state of the check-in wizard of the booking, edits the guests with
 * `StayGuestPersonalFields` and saves them as the host. The check-out wizard mounts it as it is, in its guests sub-step: one component,
 * not a copy.
 */
export function GuestsEditor({ bookingId, form, onSaved, onDirtyChange }: GuestsEditorProps) {
  const { t } = useTranslation();
  // Inside the wizard the state is already on screen: share it. On its own, the editor reads it again each time it opens.
  const state = useCheckInWizardState(bookingId, true, form ? false : 'always');
  // On its own the editor is in a layer that goes away, and so is what it reads of the guests (the state above is dropped with it): the summary of the guests is not kept
  // in the cache once the editor is gone. Inside the wizard it is the wizard's, and keeps the default.
  const source = useHostCodeSource(bookingId, form ? undefined : { gcTime: 0 });

  if (state.isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" data-testid="guests-editor-loading">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('checkin.wizard.loading')}
      </p>
    );
  }

  // A read that fails again while the state is on screen (the page was focused again, a blip of the network) keeps what is there: the form
  // the host is filling in is not replaced by an error.
  if (!state.data) {
    return (
      <div className="space-y-2" data-testid="guests-editor-load-error">
        <p role="alert" className="text-sm text-destructive">
          {getProblemMessage(state.error, t) ?? t('checkin.wizard.loadFailed')}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void state.refetch()}>
          {t('checkin.wizard.retry')}
        </Button>
      </div>
    );
  }

  if (form) {
    return (
      <FormProvider {...form}>
        <GuestsFields state={state.data} source={source} withDocuments={false} />
      </FormProvider>
    );
  }
  return (
    <StandaloneGuestsEditor
      key={bookingId}
      bookingId={bookingId}
      state={state.data}
      source={source}
      onSaved={onSaved}
      onDirtyChange={onDirtyChange}
    />
  );
}

/** The guests step of the wizard: the personal data of each guest, in the form of the wizard. */
export function GuestsStep({ bookingId, form }: { bookingId: string; form: UseFormReturn<CheckInWizardValues> }) {
  useFocusFromAddress();
  return <GuestsEditor bookingId={bookingId} form={form} />;
}
