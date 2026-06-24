import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useSupplierProfile, useUpdateSupplierProfile, useUploadSupplierPhotos } from '@/queries/use-supplier';
import { Pencil, Check, X, Upload, Trash2, ImageIcon } from 'lucide-react';

const CATEGORY_OPTIONS = ['Pulizie', 'Manutenzione', 'Giardinaggio', 'Eventi', 'Noleggio', 'Escursioni'];
const MAX_PHOTOS = 10;

export function SupplierProfilePage() {
  const { t } = useTranslation();
  const { data: profile, isLoading } = useSupplierProfile();
  const updateProfile = useUpdateSupplierProfile();
  const uploadPhotos = useUploadSupplierPhotos();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [legalName, setLegalName] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [comuneInput, setComuneInput] = useState('');
  const [bio, setBio] = useState('');

  // Photo management
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [newPhotoFiles, setNewPhotoFiles] = useState<File[]>([]);
  const [newPhotoPreviews, setNewPhotoPreviews] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hydrate = () => {
    if (!profile) return;
    setLegalName(profile.legalName ?? '');
    setVatNumber(profile.vatNumber ?? '');
    setPhone(profile.phone ?? '');
    setCategories(profile.categories ?? []);
    setComuneInput((profile.comuni ?? []).join(', '));
    setBio(profile.bio ?? '');
    setExistingPhotos(profile.photoUrls ?? []);
    setNewPhotoFiles([]);
    setNewPhotoPreviews([]);
  };

  useEffect(() => { hydrate(); }, [profile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const totalPhotos = existingPhotos.length + newPhotoPreviews.length + files.length;
    if (totalPhotos > MAX_PHOTOS) {
      toast.error(t('supplier.maxPhotosError', { max: MAX_PHOTOS }));
      return;
    }

    setNewPhotoFiles((prev) => [...prev, ...files]);
    const previews = files.map((f) => URL.createObjectURL(f));
    setNewPhotoPreviews((prev) => [...prev, ...previews]);
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeExistingPhoto = (index: number) => {
    setExistingPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const removeNewPhoto = (index: number) => {
    URL.revokeObjectURL(newPhotoPreviews[index]);
    setNewPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
    setNewPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadNewPhotos = async () => {
    if (newPhotoFiles.length === 0) return;
    setUploadingPhotos(true);
    try {
      const result = await uploadPhotos.mutateAsync(newPhotoFiles);
      setExistingPhotos(result.urls ?? []);
      newPhotoPreviews.forEach((url) => URL.revokeObjectURL(url));
      setNewPhotoFiles([]);
      setNewPhotoPreviews([]);
      toast.success(t('supplier.photosUploaded'));
    } catch {
      toast.error(t('supplier.photosUploadError'));
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await updateProfile.mutateAsync({
        legalName: legalName.trim() || undefined,
        vatNumber: vatNumber.trim(),
        phone: phone.trim() || undefined,
        categories,
        comuni: comuneInput.split(',').map((x) => x.trim()).filter(Boolean),
        bio: bio.trim(),
        photoUrls: existingPhotos,
      });
      toast.success(t('supplier.progressSaved'));
      setEditing(false);
    } catch {
      toast.error(t('supplier.progressSaveError'));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !profile) {
    return <LoadingScreen message={t('supplier.profileLoading')} />;
  }

  const hasPendingPhotos = newPhotoPreviews.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title={t('supplier.profileTitle')} description={t('supplier.profileDescription')} />
        {!editing && (
          <Button variant="outline" size="sm" onClick={() => { hydrate(); setEditing(true); }}>
            <Pencil className="mr-1 h-4 w-4" /> {t('supplier.editProfile')}
          </Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-6">
          {/* Info Section */}
          <Card>
            <CardHeader>
              <CardTitle>{t('supplier.companyInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>{t('supplier.companyName')}</Label>
                  <Input value={legalName} onChange={(e) => setLegalName(e.target.value)}
                         placeholder="es. Impresa di Pulizie Rossi" className="mt-1" />
                </div>
                <div>
                  <Label>{t('supplier.vatNumber')}</Label>
                  <Input value={vatNumber} onChange={(e) => setVatNumber(e.target.value)}
                         placeholder="es. IT12345678901" className="mt-1" />
                </div>
                <div>
                  <Label>{t('supplier.phone')}</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)}
                         placeholder="es. +39 123 456 7890" className="mt-1" />
                </div>
                <div>
                  <Label>{t('supplier.status')}</Label>
                  <Input value={profile.status} disabled className="mt-1 opacity-60" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Categories & Comuni */}
          <Card>
            <CardHeader>
              <CardTitle>{t('supplier.categoriesAndComuni')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('supplier.serviceCategories')}</Label>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {CATEGORY_OPTIONS.map((c) => (
                    <Button key={c} type="button" size="sm"
                      variant={categories.includes(c) ? 'default' : 'outline'}
                      onClick={() => setCategories((prev) =>
                        prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])}>
                      {c}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label>{t('supplier.operatingMunicipalities')}</Label>
                <Input value={comuneInput} onChange={(e) => setComuneInput(e.target.value)}
                       placeholder={t('supplier.comuniPlaceholder')} className="mt-1" />
              </div>
            </CardContent>
          </Card>

          {/* Bio */}
          <Card>
            <CardHeader>
              <CardTitle>{t('supplier.professionalProfile')}</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)}
                        className="mt-1 min-h-24 w-full rounded-md border px-3 py-2 text-sm"
                        placeholder={t('supplier.describeServicesPlaceholder')} />
            </CardContent>
          </Card>

          {/* Photos Section */}
          <Card>
            <CardHeader>
              <CardTitle>{t('supplier.photoGallery')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing photos */}
              {existingPhotos.length > 0 && (
                <div>
                  <Label>{t('supplier.currentPhotos')}</Label>
                  <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {existingPhotos.map((url, i) => (
                      <div key={i} className="group relative aspect-square rounded-lg overflow-hidden border">
                        <img src={url} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          className="absolute top-1 right-1 rounded-full bg-red-500 p-1 text-white opacity-0 group-hover:opacity-100 transition"
                          onClick={() => removeExistingPhoto(i)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New photo previews */}
              {hasPendingPhotos && (
                <div>
                  <Label>{t('supplier.newPhotos')}</Label>
                  <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {newPhotoPreviews.map((preview, i) => (
                      <div key={i} className="group relative aspect-square rounded-lg overflow-hidden border-2 border-primary/30">
                        <img src={preview} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          className="absolute top-1 right-1 rounded-full bg-red-500 p-1 text-white opacity-0 group-hover:opacity-100 transition"
                          onClick={() => removeNewPhoto(i)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload area */}
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}
                        disabled={existingPhotos.length + newPhotoPreviews.length >= MAX_PHOTOS}>
                  <Upload className="mr-2 h-4 w-4" />
                  {t('supplier.addPhotos')}
                </Button>
                {hasPendingPhotos && (
                  <Button type="button" variant="default" onClick={() => void handleUploadNewPhotos()}
                          disabled={uploadingPhotos}>
                    {uploadingPhotos ? t('shared.loading.defaultMessage') : t('supplier.uploadPhotos')}
                  </Button>
                )}
                <span className="text-xs text-muted-foreground">
                  {t('supplier.photoCount', { current: existingPhotos.length + newPhotoPreviews.length, max: MAX_PHOTOS })}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { hydrate(); setEditing(false); }} disabled={saving || uploadingPhotos}>
              <X className="mr-1 h-4 w-4" /> {t('shared.cancel')}
            </Button>
            <Button onClick={() => void handleSaveProfile()} disabled={saving || uploadingPhotos}>
              <Check className="mr-1 h-4 w-4" /> {t('supplier.saveProfile')}
            </Button>
          </div>
        </div>
      ) : (
        /* View mode */
        <div className="space-y-6">
          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t('supplier.companyInfo')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">{t('supplier.companyName')}</span>
                  <p className="mt-0.5">{profile.legalName || '—'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">{t('supplier.vatNumber')}</span>
                  <p className="mt-0.5">{profile.vatNumber || '—'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">{t('supplier.phone')}</span>
                  <p className="mt-0.5">{profile.phone || '—'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">{t('supplier.email')}</span>
                  <p className="mt-0.5">{profile.email || '—'}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">{t('supplier.status')}</span>
                  <p className="mt-0.5">
                    <span className={profile.status === 'Active' ? 'text-green-600 font-medium' : 'text-amber-600'}>
                      {profile.status}
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Categories & Comuni */}
          <Card>
            <CardHeader>
              <CardTitle>{t('supplier.categoriesAndComuni')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <span className="text-sm font-medium text-muted-foreground">{t('supplier.categories')}</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(profile.categories ?? []).length > 0
                    ? profile.categories!.map((c) => (
                        <span key={c} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                          {c}
                        </span>
                      ))
                    : <span className="text-sm text-muted-foreground">—</span>}
                </div>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">{t('supplier.municipalities')}</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(profile.comuni ?? []).length > 0
                    ? profile.comuni!.map((c) => (
                        <span key={c} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                          {c}
                        </span>
                      ))
                    : <span className="text-sm text-muted-foreground">—</span>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bio */}
          <Card>
            <CardHeader>
              <CardTitle>{t('supplier.bio')}</CardTitle>
            </CardHeader>
            <CardContent>
              {profile.bio
                ? <p className="text-sm whitespace-pre-line">{profile.bio}</p>
                : <p className="text-sm text-muted-foreground">{t('supplier.bioEmpty')}</p>}
            </CardContent>
          </Card>

          {/* Photo Gallery */}
          <Card>
            <CardHeader>
              <CardTitle>{t('supplier.photoGallery')}</CardTitle>
            </CardHeader>
            <CardContent>
              {(profile.photoUrls ?? []).length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {profile.photoUrls!.map((url, i) => (
                    <div key={i} className="aspect-square rounded-lg overflow-hidden border">
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <ImageIcon className="h-8 w-8" />
                  <p className="text-sm">{t('supplier.noPhotos')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
