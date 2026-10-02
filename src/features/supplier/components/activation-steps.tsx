import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowRight, Link2, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ServiceCategoryPicker } from '@/features/service-requests/components/service-category-picker';
import { SupplierComuniField, type SupplierComuniValue } from '@/features/supplier/components/supplier-comuni-field';
import { IcalHelpTooltip } from '@/features/supplier/components/ical-help-tooltip';
import { getProblemMessage } from '@/lib/api-errors';
import { keepKnownCategories } from '@/lib/service-categories';
import { useComuneDatasetStatus } from '@/queries/use-comuni';
import { useServiceCategories } from '@/queries/use-service-categories';
import { useSetIcalFeed, useUpdateSupplierProfile, useUploadSupplierPhotos } from '@/queries/use-supplier';
import type { SupplierProfile } from '@/types/supplier';

export const MAX_SUPPLIER_PHOTOS = 10;
const MAX_BIO_LENGTH = 2000;

interface StepProps {
  profile: SupplierProfile;
  /** Called after the data of the step is saved on the server: the wizard moves on. */
  onSaved: () => void;
}

function NextButton({ saving, label }: { saving: boolean; label: string }) {
  return (
    <Button type="submit" disabled={saving} className="w-full">
      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {label} {!saving && <ArrowRight className="ml-2 h-4 w-4" />}
    </Button>
  );
}

/** Step 1: business name and phone (the requirements) and the optional VAT number. */
export function IdentityStep({ profile, onSaved }: StepProps) {
  const { t } = useTranslation();
  const updateProfile = useUpdateSupplierProfile();
  const [legalName, setLegalName] = useState(profile.legalName ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [vatNumber, setVatNumber] = useState(profile.vatNumber ?? '');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await updateProfile.mutateAsync({
        legalName: legalName.trim(),
        phone: phone.trim(),
        vatNumber: vatNumber.trim(),
      });
      onSaved();
    } catch (error) {
      toast.error(getProblemMessage(error, t) ?? t('supplier.activation.saveError'));
    }
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('supplier.activation.identity.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="legal-name">{t('supplier.activation.identity.legalName')}</Label>
            <Input
              id="legal-name"
              value={legalName}
              maxLength={300}
              onChange={(e) => setLegalName(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="phone">{t('supplier.activation.identity.phone')}</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              maxLength={50}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">{t('supplier.activation.identity.phoneHint')}</p>
          </div>
          <div>
            <Label htmlFor="vat-number">{t('supplier.activation.identity.vatNumber')}</Label>
            <Input
              id="vat-number"
              value={vatNumber}
              maxLength={20}
              onChange={(e) => setVatNumber(e.target.value)}
              className="mt-1"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t('supplier.activation.identity.email')}: {profile.email}
          </p>
        </CardContent>
      </Card>
      <NextButton saving={updateProfile.isPending} label={t('supplier.activation.next')} />
    </form>
  );
}

/** Step 2: service categories and comuni (picked from the official ISTAT list, SU-04). */
export function ServicesStep({ profile, onSaved }: StepProps) {
  const { t } = useTranslation();
  const updateProfile = useUpdateSupplierProfile();
  const { data: categoryCodes } = useServiceCategories();
  const [categories, setCategories] = useState<string[]>(profile.categories ?? []);
  const [comuni, setComuni] = useState<SupplierComuniValue>(() => {
    const istatCodes = profile.comuneIstatCodes ?? [];
    return { istatCodes, legacy: (profile.comuni ?? []).filter((entry) => !istatCodes.includes(entry)) };
  });
  const comuneStatus = useComuneDatasetStatus();
  const comuneListAvailable = comuneStatus.data?.datasetAvailable === true;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await updateProfile.mutateAsync({
        categories: keepKnownCategories(categories, categoryCodes),
        comuni: comuni.legacy,
        // Only while the official list is imported: the API refuses ISTAT codes otherwise and keeps the stored ones.
        ...(comuneListAvailable ? { comuneIstatCodes: comuni.istatCodes } : {}),
      });
      onSaved();
    } catch (error) {
      toast.error(getProblemMessage(error, t) ?? t('supplier.activation.saveError'));
    }
  };

  const saving = updateProfile.isPending;
  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('supplier.activation.services.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t('supplier.serviceCategories')}</Label>
            <p className="mb-2 text-xs text-muted-foreground">{t('supplier.categoriesHint')}</p>
            <ServiceCategoryPicker value={categories} onChange={setCategories} disabled={saving} />
          </div>
          <div>
            <Label htmlFor="comuni">{t('supplier.operatingMunicipalities')}</Label>
            <div className="mt-1">
              <SupplierComuniField
                id="comuni"
                value={comuni}
                known={profile.operatingComuni}
                onChange={setComuni}
                disabled={saving}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      <NextButton saving={saving} label={t('supplier.activation.next')} />
    </form>
  );
}

/** Step 3 (optional): showcase photos. The upload endpoint stores them on the profile at once. */
export function ShowcaseStep({ profile, onSaved }: StepProps) {
  const { t } = useTranslation();
  const uploadPhotos = useUploadSupplierPhotos();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photos = profile.photoUrls ?? [];

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (files.length === 0) return;
    if (photos.length + files.length > MAX_SUPPLIER_PHOTOS) {
      toast.error(t('supplier.activation.showcase.max', { max: MAX_SUPPLIER_PHOTOS }));
      return;
    }
    try {
      await uploadPhotos.mutateAsync(files);
      toast.success(t('supplier.activation.showcase.uploaded'));
    } catch (error) {
      toast.error(getProblemMessage(error, t) ?? t('supplier.activation.showcase.uploadError'));
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('supplier.activation.showcase.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('supplier.activation.showcase.description')}</p>
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {photos.map((url) => (
                <div key={url} className="aspect-square overflow-hidden rounded-lg border">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(event) => void handleFiles(event)}
              data-testid="supplier-showcase-file-input"
            />
            <Button
              type="button"
              variant="outline"
              disabled={uploadPhotos.isPending || photos.length >= MAX_SUPPLIER_PHOTOS}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadPhotos.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {t('supplier.activation.showcase.add')}
            </Button>
            <span className="text-xs text-muted-foreground">
              {t('supplier.activation.showcase.count', { current: photos.length, max: MAX_SUPPLIER_PHOTOS })}
            </span>
          </div>
        </CardContent>
      </Card>
      <Button onClick={onSaved} disabled={uploadPhotos.isPending} className="w-full">
        {photos.length > 0 ? t('supplier.activation.next') : t('supplier.activation.skip')}{' '}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

/** Step 4: the professional description hosts read. */
export function ProfileStep({ profile, onSaved }: StepProps) {
  const { t } = useTranslation();
  const updateProfile = useUpdateSupplierProfile();
  const [bio, setBio] = useState(profile.bio ?? '');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await updateProfile.mutateAsync({ bio: bio.trim() });
      onSaved();
    } catch (error) {
      toast.error(getProblemMessage(error, t) ?? t('supplier.activation.saveError'));
    }
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('supplier.activation.profile.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="bio">{t('supplier.activation.profile.label')}</Label>
          <Textarea
            id="bio"
            value={bio}
            maxLength={MAX_BIO_LENGTH}
            rows={6}
            onChange={(e) => setBio(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t('supplier.activation.profile.hint')}</p>
          <p className="text-right text-xs text-muted-foreground">
            {t('supplier.activation.profile.counter', { count: bio.length, max: MAX_BIO_LENGTH })}
          </p>
        </CardContent>
      </Card>
      <NextButton saving={updateProfile.isPending} label={t('supplier.activation.next')} />
    </form>
  );
}

/** Optional availability: a calendar feed (the other options of the old wizard were "coming soon" buttons). */
export function CalendarFeedCard() {
  const { t } = useTranslation();
  const setIcalFeed = useSetIcalFeed();
  const [open, setOpen] = useState(false);
  const [icalUrl, setIcalUrl] = useState('');

  const handleSave = async () => {
    if (!icalUrl.trim()) return;
    try {
      await setIcalFeed.mutateAsync(icalUrl.trim());
      // The first sync runs in a background job (SU-15): "started", never "synced".
      toast.success(t('supplier.syncSuccess'));
      setOpen(false);
    } catch (error) {
      toast.error(getProblemMessage(error, t) ?? t('supplier.icalSaveError'));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('supplier.activation.terms.calendarTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('supplier.activation.terms.calendarHint')}</p>
        <div className="flex items-start gap-3 rounded-md border p-3">
          <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">{t('supplier.icalFeed')}</p>
            <p className="text-xs text-muted-foreground">{t('supplier.icalFeedHint')}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => {
                setIcalUrl('');
                setOpen(true);
              }}
            >
              {t('supplier.pasteIcalUrl')}
            </Button>
          </div>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('supplier.icalFeedUrlTitle')}</DialogTitle>
            <DialogDescription>{t('supplier.icalFeedUrlDescription')}</DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="ical-url" className="text-sm font-medium">
                {t('supplier.icalFeedUrlLabel')}
              </Label>
              <IcalHelpTooltip />
            </div>
            <Input
              id="ical-url"
              value={icalUrl}
              onChange={(e) => setIcalUrl(e.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/..."
              autoFocus
            />
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={setIcalFeed.isPending}>
              {t('shared.cancel')}
            </Button>
            <Button onClick={() => void handleSave()} disabled={setIcalFeed.isPending || !icalUrl.trim()}>
              {setIcalFeed.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('supplier.saveAndSync')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
