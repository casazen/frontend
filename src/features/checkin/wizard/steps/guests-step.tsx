import { useEffect, useMemo, useState } from 'react';
import { FormProvider, useFieldArray, useForm, useFormContext, useWatch, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { StayGuestDocumentFields, StayGuestPersonalFields, VehiclePlateField } from '@/features/checkin/components/stay-guest-fields';
import type { CodeTableSource } from '@/features/checkin/components/code-table';
import {
  MAX_STAY_GUESTS,
  asksSwissDocument,
  createStayGuestListSchema,
  documentLevelsOf,
  followerTypeOf,
  stayGuestDefaults,
  stayVehiclePlateSchema,
} from '@/features/checkin/schemas/checkin.schema';
import { getProblemMessage } from '@/lib/api-errors';
import { useCheckInWizardState, useSaveCheckInGuests } from '@/queries/use-checkin-wizard';
import type { CheckInWizardState } from '@/types/checkin-wizard.types';
import type { StayGuestType } from '@/types/public-checkin.types';
import {
  statisticalFieldsOf,
  swissRulesOfState,
  toGuestsSave,
  wizardValuesFromState,
  type CheckInWizardValues,
} from '../lib/checkin-wizard-model';
import { applyGuestFieldProblems, guestFieldProblemsOf } from '../lib/guest-save-errors';
import { useFocusFromAddress } from '../lib/use-focus-from-address';
import { useHostCodeSource } from '../lib/use-host-code-source';

interface GuestsFieldsProps {
  state: CheckInWizardState;
  source: CodeTableSource;
  withDocuments: boolean;
}

function GuestsFields({ state, source, withDocuments }: GuestsFieldsProps) {
  const { t } = useTranslation();
  const { control, getValues, setValue } = useFormContext<CheckInWizardValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'guests' });
  const guests = useWatch({ control, name: 'guests' });
  const statisticalFields = statisticalFieldsOf(state);
  const swiss = useMemo(() => swissRulesOfState(state), [state]);
  const documentLevels = documentLevelsOf(guests ?? [], swiss);
  const declared = state.booking.declaredGuests;

  const changeLeaderType = (type: StayGuestType) => {
    const follower = followerTypeOf(type);
    getValues('guests').forEach((_, index) => {
      if (index > 0) setValue(`guests.${index}.type`, follower, { shouldDirty: true });
    });
  };

  return (
    <div className="space-y-4" data-testid="checkin-wizard-guests">
      <p className="text-sm text-muted-foreground">
        {asksSwissDocument(swiss) ? t('checkin.swiss.guestsIntro') : t('checkin.guestsIntro')}
      </p>
      {fields.length !== declared && (
        <p className="text-sm text-orange-700" data-testid="checkin-wizard-guest-count-mismatch">
          {t('checkin.guestCountMismatch', { count: declared })}
        </p>
      )}
      {fields.length > 1 && (
        <nav aria-label={t('checkin.guestsIntro')} className="flex flex-wrap gap-2">
          {fields.map((field, index) => (
            <a key={field.id} href={`#checkin-guest-${field.id}`} className="inline-flex min-h-11 items-center rounded-xl border px-3 text-sm font-medium text-primary hover:bg-muted">
              {t('checkin.guestHeading', { index: index + 1 })}
            </a>
          ))}
        </nav>
      )}
      {fields.map((field, index) => {
        const level = documentLevels[index] ?? null;
        return (
          <div id={`checkin-guest-${field.id}`} key={field.id} tabIndex={-1} className="scroll-mt-24 space-y-3">
            <StayGuestPersonalFields
              index={index}
              arrivalDate={state.booking.checkIn}
              source={source}
              requiredFields={statisticalFields}
              swiss={swiss}
              onLeaderTypeChange={index === 0 ? changeLeaderType : undefined}
              onRemove={index > 0 ? () => remove(index) : undefined}
            />
            {withDocuments && level !== null && <StayGuestDocumentFields index={index} source={source} level={level} />}
          </div>
        );
      })}
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
      {state.askVehiclePlate === true && <VehiclePlateField />}
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

function StandaloneGuestsEditor({ bookingId, state, source, onSaved, onDirtyChange }: StandaloneGuestsEditorProps) {
  const { t } = useTranslation();
  const save = useSaveCheckInGuests(bookingId);
  const [saveError, setSaveError] = useState<string | null>(null);
  const statisticalFields = useMemo(() => statisticalFieldsOf(state), [state]);
  const swiss = useMemo(() => swissRulesOfState(state), [state]);
  const schema = useMemo(
    () => z.object({ guests: createStayGuestListSchema(statisticalFields, 'all', swiss), vehiclePlate: stayVehiclePlateSchema }),
    [statisticalFields, swiss],
  );
  const form = useForm<CheckInWizardValues>({ resolver: zodResolver(schema), defaultValues: wizardValuesFromState(state) });
  const { isDirty } = form.formState;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const onSubmit = form.handleSubmit(async (values) => {
    setSaveError(null);
    try {
      const saved = await save.mutateAsync(toGuestsSave(values, statisticalFields, swiss));
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
  form?: UseFormReturn<CheckInWizardValues>;
  onSaved?: (state: CheckInWizardState) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function GuestsEditor({ bookingId, form, onSaved, onDirtyChange }: GuestsEditorProps) {
  const { t } = useTranslation();
  const state = useCheckInWizardState(bookingId, true, form ? false : 'always');
  const source = useHostCodeSource(bookingId, form ? undefined : { gcTime: 0 });

  if (state.isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" data-testid="guests-editor-loading">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('checkin.wizard.loading')}
      </p>
    );
  }

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

export function GuestsStep({ bookingId, form }: { bookingId: string; form: UseFormReturn<CheckInWizardValues> }) {
  useFocusFromAddress();
  return <GuestsEditor bookingId={bookingId} form={form} />;
}
