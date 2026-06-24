import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useSupplierProfile, useUpdateSupplierProfile } from '@/queries/use-supplier';
import { useAuth } from '@/hooks/use-auth';
import { Pencil, Check, X } from 'lucide-react';

const CATEGORY_OPTIONS = ['Pulizie', 'Manutenzione', 'Giardinaggio', 'Eventi', 'Noleggio', 'Escursioni'];

export function SupplierProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: profile, isLoading } = useSupplierProfile();
  const updateProfile = useUpdateSupplierProfile();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [legalName, setLegalName] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [comuneInput, setComuneInput] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrlsInput, setPhotoUrlsInput] = useState('');

  // Hydrate from profile when it loads or when entering edit mode.
  const hydrate = () => {
    if (!profile) return;
    setLegalName(profile.legalName ?? '');
    setVatNumber(profile.vatNumber ?? '');
    setPhone(profile.phone ?? '');
    setCategories(profile.categories ?? []);
    setComuneInput((profile.comuni ?? []).join(', '));
    setBio(profile.bio ?? '');
    setPhotoUrlsInput((profile.photoUrls ?? []).join('\n'));
  };

  useEffect(() => { hydrate(); }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile.mutateAsync({
        legalName: legalName.trim() || undefined,
        vatNumber: vatNumber.trim() || undefined,
        phone: phone.trim() || undefined,
        categories,
        comuni: comuneInput.split(',').map((x) => x.trim()).filter(Boolean),
        bio: bio.trim() || undefined,
        photoUrls: photoUrlsInput.split('\n').map((x) => x.trim()).filter(Boolean),
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
        <Card>
          <CardHeader>
            <CardTitle>{t('supplier.editProfile')}</CardTitle>
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

            <div>
              <Label>{t('supplier.professionalProfile')}</Label>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)}
                        className="mt-1 min-h-24 w-full rounded-md border px-3 py-2 text-sm"
                        placeholder={t('supplier.describeServicesPlaceholder')} />
            </div>

            <div>
              <Label>{t('supplier.photoUrls')}</Label>
              <textarea value={photoUrlsInput} onChange={(e) => setPhotoUrlsInput(e.target.value)}
                        className="mt-1 min-h-16 w-full rounded-md border px-3 py-2 text-sm"
                        placeholder="https://..." />
              <p className="mt-1 text-xs text-muted-foreground">{t('supplier.photoUrlsHint')}</p>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { hydrate(); setEditing(false); }} disabled={saving}>
                <X className="mr-1 h-4 w-4" /> {t('shared.cancel')}
              </Button>
              <Button onClick={() => void handleSave()} disabled={saving}>
                <Check className="mr-1 h-4 w-4" /> {t('supplier.saveProfile')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t('supplier.professionalProfile')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <span className="font-medium">{t('supplier.status')}:</span>{' '}
                <span className={profile.status === 'Active' ? 'text-green-600 font-medium' : 'text-amber-600'}>{profile.status}</span>
              </div>
              <div><span className="font-medium">{t('supplier.companyName')}:</span> {profile.legalName || '—'}</div>
              <div><span className="font-medium">{t('supplier.vatNumber')}:</span> {profile.vatNumber || '—'}</div>
              <div><span className="font-medium">{t('supplier.phone')}:</span> {profile.phone || '—'}</div>
              <div><span className="font-medium">{t('supplier.email')}:</span> {profile.email || user?.email || '—'}</div>
            </div>

            <div>
              <span className="font-medium">{t('supplier.categories')}:</span>{' '}
              {(profile.categories ?? []).length > 0
                ? profile.categories!.join(', ')
                : <span className="text-muted-foreground">—</span>}
            </div>

            <div>
              <span className="font-medium">{t('supplier.municipalities')}:</span>{' '}
              {(profile.comuni ?? []).length > 0
                ? profile.comuni!.join(', ')
                : <span className="text-muted-foreground">—</span>}
            </div>

            <div>
              <span className="font-medium">{t('supplier.bio')}:</span>{' '}
              {profile.bio
                ? <span>{profile.bio}</span>
                : <span className="text-muted-foreground">{t('supplier.bioEmpty')}</span>}
            </div>

            {(profile.photoUrls ?? []).length > 0 && (
              <div>
                <span className="font-medium">{t('supplier.photoUrls')}:</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {profile.photoUrls!.map((url, i) => (
                    <img key={i} src={url} alt="" className="h-16 w-16 rounded-md object-cover border" />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
