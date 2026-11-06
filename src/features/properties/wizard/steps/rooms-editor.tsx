import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Qty } from '@/components/ui/qty';
import { Select } from '@/components/ui/select';
import { translateValidationMessage } from '@/i18n/validation-message';
import { BED_TYPES, PROPERTY_ROOM_TYPES } from '@/types';
import type { BedType, PropertyRoomType } from '@/types';
import type { PropertyWizardValues } from '../property-wizard-model';
import { MAX_BEDS_OF_A_KIND, MAX_ROOMS, bedroomCount, newRoomDraft, nextFreeBedType, totalBeds, type RoomDraft } from '../rooms-model';

interface RoomsEditorProps {
  form: UseFormReturn<PropertyWizardValues>;
}

/**
 * The rooms of the unit with the beds of each (NF-34), in the first step under the counters of the spaces: a room has a type and one entry
 * for each kind of bed with how many. Once there is a room the counters «Camere da letto» and «Letti» are read from the rooms (the API sets
 * them from the rooms at every save), so the host never states the same thing twice. Without rooms the counters are the host's, as before.
 */
export function RoomsEditor({ form }: RoomsEditorProps) {
  const { t, i18n } = useTranslation();
  const rooms = form.watch('rooms');
  const problem = form.formState.errors.rooms?.message;

  /** One place changes the rooms, so the counters follow them whichever control was used. */
  const update = (next: RoomDraft[]) => {
    form.setValue('rooms', next, { shouldDirty: true });
    if (next.length > 0) {
      form.setValue('bedrooms', bedroomCount(next), { shouldDirty: true });
      form.setValue('beds', Math.max(1, totalBeds(next)), { shouldDirty: true });
    }
  };

  const changeRoom = (key: string, change: (room: RoomDraft) => RoomDraft) => update(rooms.map((room) => (room.key === key ? change(room) : room)));

  return (
    <section aria-labelledby="property-wizard-rooms-title" className="min-w-0 space-y-4" data-testid="property-wizard-rooms">
      <div className="space-y-1">
        <h3 id="property-wizard-rooms-title" className="text-base font-semibold">
          {t('propertyWizard.rooms.title')}
        </h3>
        <p className="text-sm text-foreground/70">
          {rooms.length === 0
            ? t('propertyWizard.rooms.hint')
            : t('propertyWizard.rooms.derived', { bedrooms: bedroomCount(rooms), beds: totalBeds(rooms) })}
        </p>
      </div>

      {rooms.map((room, index) => {
        const free = nextFreeBedType(room.beds);
        return (
          <fieldset key={room.key} className="m-0 min-w-0 space-y-4 rounded-lg p-4 ring-1 ring-inset ring-border" data-testid="property-wizard-room">
            <legend className="px-1 text-sm font-medium">{t('propertyWizard.rooms.room', { number: index + 1 })}</legend>

            <div className="flex min-w-0 flex-wrap items-end gap-3">
              <Field label={t('propertyWizard.rooms.type')} className="min-w-48 flex-1">
                <Select
                  value={room.type}
                  onChange={(event) => changeRoom(room.key, (current) => ({ ...current, type: event.target.value as PropertyRoomType }))}
                  data-testid="property-wizard-room-type"
                >
                  {PROPERTY_ROOM_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`propertyWizard.rooms.types.${type}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11"
                onClick={() => update(rooms.filter((other) => other.key !== room.key))}
                aria-label={t('propertyWizard.rooms.remove', { number: index + 1 })}
                data-testid="property-wizard-room-remove"
              >
                <Trash2 aria-hidden="true" className="size-4 text-destructive" />
                {t('propertyWizard.rooms.removeShort')}
              </Button>
            </div>

            <div className="space-y-3">
              {room.beds.length === 0 ? <p className="text-sm text-foreground/70">{t('propertyWizard.rooms.noBeds')}</p> : null}
              {room.beds.map((bed, bedIndex) => (
                <div key={bedIndex} className="flex min-w-0 flex-wrap items-center justify-between gap-3" data-testid="property-wizard-bed">
                  <Field label={t('propertyWizard.rooms.bedType')} className="min-w-44 flex-1">
                    <Select
                      value={bed.type}
                      onChange={(event) =>
                        changeRoom(room.key, (current) => ({
                          ...current,
                          beds: current.beds.map((other) => (other.type === bed.type ? { ...other, type: event.target.value as BedType } : other)),
                        }))
                      }
                    >
                      {BED_TYPES.map((type) => (
                        <option key={type} value={type} disabled={type !== bed.type && room.beds.some((other) => other.type === type)}>
                          {t(`propertyWizard.rooms.bedTypes.${type}`)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Qty
                    label={t('propertyWizard.rooms.bedCount', { type: t(`propertyWizard.rooms.bedTypes.${bed.type}`) })}
                    value={bed.count}
                    min={1}
                    max={MAX_BEDS_OF_A_KIND}
                    onChange={(count) =>
                      changeRoom(room.key, (current) => ({
                        ...current,
                        beds: current.beds.map((other) => (other.type === bed.type ? { ...other, count } : other)),
                      }))
                    }
                    testId="property-wizard-bed-count"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('propertyWizard.rooms.removeBed', { type: t(`propertyWizard.rooms.bedTypes.${bed.type}`) })}
                    onClick={() => changeRoom(room.key, (current) => ({ ...current, beds: current.beds.filter((other) => other.type !== bed.type) }))}
                  >
                    <Trash2 aria-hidden="true" className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={free === null}
                onClick={() => free && changeRoom(room.key, (current) => ({ ...current, beds: [...current.beds, { type: free, count: 1 }] }))}
                data-testid="property-wizard-bed-add"
              >
                <Plus aria-hidden="true" className="size-4" />
                {t('propertyWizard.rooms.addBed')}
              </Button>
            </div>
          </fieldset>
        );
      })}

      {problem ? (
        <p role="alert" className="text-sm text-danger-foreground" data-testid="property-wizard-rooms-problem">
          {translateValidationMessage(problem, t, i18n)}
        </p>
      ) : null}

      <Button type="button" variant="outline" disabled={rooms.length >= MAX_ROOMS} onClick={() => update([...rooms, newRoomDraft()])} data-testid="property-wizard-room-add">
        <Plus aria-hidden="true" className="size-4" />
        {rooms.length === 0 ? t('propertyWizard.rooms.addFirst') : t('propertyWizard.rooms.add')}
      </Button>
    </section>
  );
}
