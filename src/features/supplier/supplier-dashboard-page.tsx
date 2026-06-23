import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth0 } from '@auth0/auth0-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useSupplierProfile, useSupplierActivation, useUpdateSupplierProfile } from '@/queries/use-supplier';
import { CheckCircle2, ArrowRight, AlertTriangle } from 'lucide-react';

const CATEGORY_OPTIONS = ['Pulizie', 'Manutenzione', 'Giardinaggio', 'Eventi', 'Noleggio', 'Escursioni'];

interface MissingFields {
  categories: boolean;
  comuni: boolean;
  bio: boolean;
}

function computeMissing(profile: { categories?: string[]; comuni?: string[]; bio?: string | null } | undefined): MissingFields | null {
  if (!profile) return null;
  const m: MissingFields = {
    categories: !profile.categories?.length,
    comuni: !profile.comuni?.length,
    bio: !profile.bio,
  };
  return (m.categories || m.comuni || m.bio) ? m : null;
}

export function SupplierDashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth0();
  const { data: profile, isLoading: profileLoading } = useSupplierProfile();
  const { isLoading: activationLoading } = useSupplierActivation();
  const updateProfile = useUpdateSupplierProfile();

  const isLoading = profileLoading || activationLoading;
  const missing = useMemo(() => computeMissing(profile), [profile]);
  const [showWizard, setShowWizard] = useState(true);

  // Wizard local state
  const [categories, setCategories] = useState<string[]>(profile?.categories ?? []);
  const [comuneInput, setComuneInput] = useState((profile?.comuni ?? []).join(', '));
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile.mutateAsync({
        categories,
        comuni: comuneInput.split(',').map((x) => x.trim()).filter(Boolean),
        bio,
      });
      toast.success(t('supplier.progressSaved'));
      setShowWizard(false);
    } catch {
      toast.error(t('supplier.progressSaveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={t('supplier.dashboardTitle')}
        description={t('supplier.dashboardDescription')}
      />

      {/* Incomplete profile warning + auto-popup wizard */}
      {!isLoading && missing && (
        <Card className="mb-4 border-amber-300 bg-amber-50">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-medium text-amber-900">{t('supplier.incompleteProfile')}</p>
              <p className="text-sm text-amber-700">{t('supplier.incompleteProfileHint')}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 border-amber-400 text-amber-900"
                onClick={() => setShowWizard(true)}
              >
                {t('supplier.completeNow')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground">{t('supplier.status')}</h3>
            <p className="mt-1 text-xl font-semibold">
              {profile?.status === 'Active' ? t('supplier.statusActive') : t('supplier.statusPending')}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {profile?.status === 'Active' ? t('supplier.visibleToHosts') : t('supplier.completeActivationHint')}
            </p>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground">{t('supplier.categories')}</h3>
            <p className="mt-1 text-lg">
              {profile?.categories?.length ? profile.categories.join(', ') : (
                <span className="text-amber-600">{t('supplier.noneSet')}</span>
              )}
            </p>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground">{t('supplier.municipalities')}</h3>
            <p className="mt-1 text-lg">
              {profile?.comuni?.length ? profile.comuni.join(', ') : (
                <span className="text-amber-600">{t('supplier.noneSet')}</span>
              )}
            </p>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground">{t('supplier.welcomeBack')}</h3>
            <p className="mt-1 text-lg">{user?.name ?? t('supplier.supplierDefault')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
          </Card>
        </div>
      )}

      {/* Profile completion wizard — auto-opens if profile incomplete */}
      <Dialog open={showWizard && !!missing} onOpenChange={(open) => {
        // Prevent dismissing until profile is complete
        if (missing && open === false) return;
        setShowWizard(open);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('supplier.completeProfileTitle')}</DialogTitle>
            <DialogDescription>{t('supplier.completeProfileDescription')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <Label className="flex items-center gap-2">
                {categories.length > 0 && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                {t('supplier.serviceCategories')}
              </Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {CATEGORY_OPTIONS.map((c) => (
                  <Button
                    key={c}
                    type="button"
                    size="sm"
                    variant={categories.includes(c) ? 'default' : 'outline'}
                    onClick={() => setCategories((prev) =>
                      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])}
                  >
                    {c}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="flex items-center gap-2">
                {comuneInput.trim().length > 0 && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                {t('supplier.operatingMunicipalities')}
              </Label>
              <Input
                className="mt-2"
                value={comuneInput}
                onChange={(e) => setComuneInput(e.target.value)}
                placeholder={t('supplier.comuniPlaceholder')}
              />
            </div>

            <div>
              <Label className="flex items-center gap-2">
                {bio.trim().length > 0 && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                {t('supplier.professionalProfile')}
              </Label>
              <textarea
                className="mt-2 min-h-20 w-full rounded-md border px-3 py-2 text-sm"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={t('supplier.describeServicesPlaceholder')}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? t('shared.loading.defaultMessage') : <>{t('supplier.saveAndContinue')} <ArrowRight className="ml-1 h-4 w-4" /></>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
