import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FormProvider, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { alloggiatiApi } from '@/api/alloggiati.api';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { getServerFieldErrorsByPath } from '@/lib/server-validation-errors';
import { useReplaceStayGuests } from '@/queries/use-alloggiati';
import type {
  AlloggiatiGuestRowDto,
  AlloggiatiGuestSummaryDto,
  StayGuestDocumentNumberDto,
} from '@/types/alloggiati.types';
import type { AlloggiatiCodeTable, StayGuestType } from '@/types/public-checkin.types';
import {
  DOCUMENT_KINDS,
  MAX_STAY_GUESTS,
  followerTypeOf,
  guestFormPathOf,
  requiresDocument,
  stayGuestDefaults,
  stayGuestsFormSchema,
  toStayGuestSubmit,
  type StayGuestFormValues,
  type StayGuestsFormValues,
} from '@/features/checkin/schemas/checkin.schema';
import { StayGuestDocumentFields, StayGuestPersonalFields } from '@/features/checkin/components/stay-guest-fields';
import type { CodeTableSource } from '@/features/checkin/components/code-table';

const ALL_TABLES: AlloggiatiCodeTable[] = ['Comuni', 'Stati', 'Documenti', 'TipiAlloggiato'];

/**
 * Form values of a registered guest, as the host sees it (codes found in the tables). The full document number comes from
 * the audited API call made when the form opens; without it the field starts empty with the masked number as a hint.
 */
function stayGuestValuesFromRow(row: AlloggiatiGuestRowDto, documentNumber: string | undefined): StayGuestFormValues {
  const bornAbroad = row.bornInItaly === false;
  return {
    type: row.type,
    firstName: row.firstName,
    lastName: row.lastName,
    gender: row.gender === 'Male' || row.gender === 'Female' ? row.gender : '',
    dateOfBirth: row.dateOfBirth?.slice(0, 10) ?? '',
    bornInItaly: row.bornInItaly === true ? 'yes' : bornAbroad ? 'no' : '',
    birthComuneName: row.birthComune,
    birthComuneCode: row.bornInItaly === true ? row.codes.birthComune : null,
    birthProvince: row.birthProvince ?? '',
    birthCountryName: bornAbroad ? row.birthCountry : '',
    birthCountryCode: bornAbroad ? row.codes.birthCountry : null,
    citizenshipName: row.citizenship,
    citizenshipCode: row.codes.citizenship,
    documentType: row.documentType && (DOCUMENT_KINDS as readonly string[]).includes(row.documentType) ? row.documentType : '',
    documentTypeCode: row.codes.documentType,
    documentTypeLabel: row.codes.documentTypeDescription ?? '',
    documentNumber: documentNumber ?? '',
    documentNumberOnFile: documentNumber ? null : row.documentNumberMasked,
    documentIssuePlaceName: row.documentIssuePlace,
    documentIssuePlaceCode: row.codes.documentIssuePlace,
  };
}

interface StayGuestsEditDialogProps {
  bookingId: string;
  summary: AlloggiatiGuestSummaryDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Host entry of the guests of the stay (CO-12, CO-09): walk-in guests, a guest who cannot use the check-in link,
 * corrections, official codes to complete. Same rules as the guest portal (kinds and order, document only for a single
 * guest or a head of family or group). Opening the form is the explicit request for the full document numbers (audited
 * by the API); a host who may not read them re-enters the number, as the guest does.
 */
export function StayGuestsEditDialog({ bookingId, summary, open, onOpenChange }: StayGuestsEditDialogProps) {
  const { t } = useTranslation();
  const withDocuments = summary.guests.some((g) => g.requiresDocument && g.documentNumberMasked);
  const numbers = useQuery({
    queryKey: ['alloggiati', 'document-numbers', bookingId],
    queryFn: () => alloggiatiApi.getDocumentNumbers(bookingId),
    enabled: open && withDocuments,
    // Identity documents: never kept in the cache after the form closes.
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
  const numbersForbidden = numbers.isError && getHttpStatus(numbers.error) === 403;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" data-testid="stay-guests-edit-dialog">
        <DialogHeader>
          <DialogTitle>{t('alloggiati.editGuests.title')}</DialogTitle>
          <DialogDescription>{t('alloggiati.editGuests.description')}</DialogDescription>
        </DialogHeader>
        {withDocuments && numbers.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="stay-guests-edit-loading">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('alloggiati.editGuests.loadingDocuments')}
          </div>
        ) : withDocuments && numbers.isError && !numbersForbidden ? (
          <div className="space-y-2" data-testid="stay-guests-edit-load-error">
            <p className="text-sm text-destructive">
              {getProblemMessage(numbers.error, t) ?? t('alloggiati.editGuests.documentsLoadFailed')}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => void numbers.refetch()}>
              {t('alloggiati.guestSummary.retry')}
            </Button>
          </div>
        ) : (
          <StayGuestsEditForm
            bookingId={bookingId}
            summary={summary}
            documentNumbers={numbers.data}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface StayGuestsEditFormProps {
  bookingId: string;
  summary: AlloggiatiGuestSummaryDto;
  documentNumbers: StayGuestDocumentNumberDto[] | undefined;
  onDone: () => void;
}

function StayGuestsEditForm({ bookingId, summary, documentNumbers, onDone }: StayGuestsEditFormProps) {
  const { t } = useTranslation();
  const replace = useReplaceStayGuests(bookingId);
  const [saveError, setSaveError] = useState<string | null>(null);

  const initial = useMemo<StayGuestsFormValues>(() => {
    const byPosition = new Map((documentNumbers ?? []).map((n) => [n.position, n.documentNumber]));
    const guests = summary.guests.map((row) => stayGuestValuesFromRow(row, byPosition.get(row.position)));
    if (guests.length === 0) guests.push(stayGuestDefaults('SingleGuest'));
    return { guests };
  }, [summary.guests, documentNumbers]);

  const form = useForm<StayGuestsFormValues>({ resolver: zodResolver(stayGuestsFormSchema), defaultValues: initial });
  const { control, getValues, setValue, setError, handleSubmit } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'guests' });
  const guests = useWatch({ control, name: 'guests' });

  const source = useMemo<CodeTableSource>(
    () => ({
      scope: 'host',
      availableTables: ALL_TABLES.filter((table) => !summary.missingCodeTables.includes(table)),
      search: (list, query) => alloggiatiApi.searchCodes(list, query),
    }),
    [summary.missingCodeTables],
  );

  const changeLeaderType = (type: StayGuestType) => {
    const follower = followerTypeOf(type);
    getValues('guests').forEach((_, index) => {
      if (index > 0) setValue(`guests.${index}.type`, follower, { shouldDirty: true });
    });
  };

  const onSubmit = handleSubmit(async (values) => {
    setSaveError(null);
    try {
      await replace.mutateAsync(values.guests.map(toStayGuestSubmit));
      onDone();
    } catch (error) {
      const serverErrors = getServerFieldErrorsByPath(error, t('checkin.validation.invalidValue'));
      let shown = 0;
      for (const [path, message] of Object.entries(serverErrors)) {
        const formPath = guestFormPathOf(path, values.guests.length);
        if (formPath) {
          setError(formPath, { type: 'server', message });
          shown += 1;
        }
      }
      setSaveError(shown > 0 ? t('checkin.fixHighlightedFields') : getProblemMessage(error, t) ?? t('alloggiati.editGuests.saveFailed'));
    }
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} className="space-y-4" data-testid="stay-guests-edit-form">
        {fields.map((field, index) => (
          <div key={field.id} className="space-y-3">
            <StayGuestPersonalFields
              index={index}
              arrivalDate={summary.arrivalDate}
              source={source}
              onLeaderTypeChange={index === 0 ? changeLeaderType : undefined}
              onRemove={index > 0 ? () => remove(index) : undefined}
            />
            {guests[index] && requiresDocument(guests[index].type) && (
              <StayGuestDocumentFields index={index} source={source} />
            )}
          </div>
        ))}
        {fields.length < MAX_STAY_GUESTS && (
          <Button
            type="button"
            variant="outline"
            onClick={() => append(stayGuestDefaults(followerTypeOf(getValues('guests.0.type'))))}
            data-testid="stay-guests-add"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            {t('checkin.addGuest')}
          </Button>
        )}
        {saveError && (
          <p role="alert" className="text-sm text-destructive" data-testid="stay-guests-save-error">
            {saveError}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            {t('alloggiati.editGuests.cancel')}
          </Button>
          <Button type="submit" disabled={replace.isPending} data-testid="stay-guests-save">
            {replace.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('alloggiati.editGuests.save')}
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}
