import type { FieldArrayWithId } from 'react-hook-form';
import { UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { PublicCheckInContextDto, StayGuestType } from '@/types/public-checkin.types';
import {
  MAX_STAY_GUESTS,
  type PublicCheckInFormValues,
  type StatisticalGuestField,
  type swissRulesOf,
} from '../schemas/checkin.schema';
import type { CodeTableSource } from './code-table';
import { StayGuestPersonalFields, VehiclePlateField } from './stay-guest-fields';

/** The first step: the personal data of each guest (and the plate of the car where it is asked). */
export function CheckInGuestsStep({ resumed, step, swissDocuments, fields, declaredGuests, context, codeSource, statisticalFields, swiss, changeLeaderType, remove, addGuest, askVehiclePlate }: {
  resumed: boolean;
  step: number | null;
  swissDocuments: boolean;
  fields: FieldArrayWithId<PublicCheckInFormValues, 'guests'>[];
  declaredGuests: number;
  context: PublicCheckInContextDto;
  codeSource: CodeTableSource;
  statisticalFields: StatisticalGuestField[];
  swiss: ReturnType<typeof swissRulesOf>;
  changeLeaderType: (type: StayGuestType) => void;
  remove: (index: number) => void;
  addGuest: () => void;
  askVehiclePlate: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      {resumed && step === null && (
        <p className="rounded-md border-l-4 border-primary bg-muted px-3 py-2 text-sm" data-testid="checkin-resumed">
          {t('checkin.reopen.resumed')}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {swissDocuments ? t('checkin.swiss.guestsIntro') : t('checkin.guestsIntro')}
      </p>
      {fields.length !== declaredGuests && (
        <p className="text-sm text-orange-700" data-testid="checkin-guest-count-mismatch">
          {t('checkin.guestCountMismatch', { count: declaredGuests })}
        </p>
      )}
      {fields.map((field, index) => (
        <StayGuestPersonalFields
          key={field.id}
          index={index}
          arrivalDate={context.checkInDate}
          source={codeSource}
          requiredFields={statisticalFields}
          swiss={swiss}
          bookedName={context.guests?.[index]}
          onLeaderTypeChange={index === 0 ? changeLeaderType : undefined}
          onRemove={index > 0 && index >= (context.guests?.length ?? 0) ? () => remove(index) : undefined}
        />
      ))}
      {fields.length < Math.min(MAX_STAY_GUESTS, declaredGuests) && (
        <Button type="button" variant="outline" onClick={addGuest} data-testid="checkin-add-guest">
          <UserPlus className="mr-2 h-4 w-4" />
          {t('checkin.addGuest')}
        </Button>
      )}
      {askVehiclePlate && <VehiclePlateField />}
    </div>
  );
}
