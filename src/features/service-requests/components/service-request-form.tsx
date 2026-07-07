import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Wrench, Sparkles, Loader2, Star, MapPin, Phone, Mail, ExternalLink } from 'lucide-react';
import { useCreateServiceRequest, useMatchSupplier } from '@/queries/use-service-requests';
import type { ServiceRequestUrgency, SupplierMatchCandidate } from '@/types/service-request';

const CATEGORIES = ['cleaning', 'maintenance', 'plumbing', 'laundry'] as const;

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

interface ServiceRequestFormProps {
  propertyId: string;
  bookingId?: string;
  propertyCity: string;
}

export function ServiceRequestForm({ propertyId, bookingId, propertyCity }: ServiceRequestFormProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>('cleaning');
  const [supplierOrgId, setSupplierOrgId] = useState('');
  const [urgency, setUrgency] = useState<ServiceRequestUrgency>('Normal');
  const [notes, setNotes] = useState('');
  const [chargeToGuest, setChargeToGuest] = useState(false);

  const matchMutation = useMatchSupplier();
  const createMutation = useCreateServiceRequest();

  useEffect(() => {
    if (!open) return;
    setSupplierOrgId('');
    matchMutation.mutate({ propertyId, category, urgency, notes: notes || undefined });
  }, [open, category, urgency, propertyId]);

  useEffect(() => {
    if (!open) return;
    const recommended = matchMutation.data?.recommended;
    if (recommended && !supplierOrgId) {
      setSupplierOrgId(recommended.orgId);
    }
  }, [matchMutation.data, open, supplierOrgId]);

  const selectCandidate = (candidate: SupplierMatchCandidate) => {
    setSupplierOrgId(candidate.orgId);
  };

  const handleSubmit = () => {
    if (!supplierOrgId) return;
    createMutation.mutate(
      {
        propertyId,
        bookingId,
        supplierOrgId,
        category,
        urgency,
        notes: notes || undefined,
        chargeToGuest,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setNotes('');
          setSupplierOrgId('');
        },
      },
    );
  };

  const match = matchMutation.data;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="request-supplier-btn">
          <Wrench className="mr-2 h-4 w-4" />
          {t('serviceRequest.requestSupplier')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="service-request-dialog">
        <DialogHeader>
          <DialogTitle>{t('serviceRequest.requestSupplier')}</DialogTitle>
          <DialogDescription>{t('serviceRequest.aiMatchDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="sr-category">{t('serviceRequest.category')}</Label>
            <select
              id="sr-category"
              className={selectClass}
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setSupplierOrgId('');
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`serviceRequest.categories.${c}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>{t('serviceRequest.aiRecommendation')}</Label>
            {matchMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('serviceRequest.matching')}
              </div>
            )}
            {matchMutation.isError && (
              <p className="text-sm text-destructive">{t('serviceRequest.createFailed')}</p>
            )}
            {match?.recommended && (
              <Card
                className={`cursor-pointer border-2 ${supplierOrgId === match.recommended.orgId ? 'border-primary' : 'border-transparent'}`}
                onClick={() => selectCandidate(match.recommended!)}
                data-testid="ai-recommended-supplier"
              >
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-medium">
                      <Sparkles className="h-4 w-4 text-primary" />
                      {match.recommended.legalName}
                    </div>
                    <Badge variant="secondary">{match.recommended.matchScore}%</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{match.recommended.matchReason}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {match.recommended.phone}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {match.recommended.email}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
            {(match?.alternatives?.length ?? 0) > 0 && (
              <div className="space-y-2">
                {(match?.alternatives ?? []).map((alt) => (
                  <Card
                    key={alt.orgId}
                    className={`cursor-pointer ${supplierOrgId === alt.orgId ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => selectCandidate(alt)}
                  >
                    <CardContent className="py-3 flex justify-between items-center">
                      <span className="font-medium text-sm">{alt.legalName}</span>
                      <Badge variant="outline">{alt.matchScore}%</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {match?.usedExternalFallback && (match.externalSuggestions?.length ?? 0) > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-sm text-muted-foreground">{t('serviceRequest.externalFallbackIntro')}</p>
                {match.externalSuggestions.map((ext, idx) => (
                  <Card key={`${ext.name}-${idx}`}>
                    <CardContent className="pt-4 space-y-1">
                      <div className="font-medium">{ext.name}</div>
                      <p className="text-xs text-muted-foreground flex items-start gap-1">
                        <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                        {ext.address}
                      </p>
                      {ext.rating != null && (
                        <p className="text-xs flex items-center gap-1">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {ext.rating}
                          {ext.reviewCount != null ? ` (${ext.reviewCount})` : ''}
                        </p>
                      )}
                      {ext.googleMapsUrl && (
                        <a
                          href={ext.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary inline-flex items-center gap-1"
                        >
                          Google Maps
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {match && !match.recommended && !match.usedExternalFallback && !matchMutation.isPending && (
              <p className="text-sm text-muted-foreground">{t('serviceRequest.noSuppliers')}</p>
            )}
            {match?.usedExternalFallback && (match.externalSuggestions?.length ?? 0) === 0 && !matchMutation.isPending && (
              <p className="text-sm text-muted-foreground">{t('serviceRequest.noExternalResults')}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sr-urgency">{t('serviceRequest.urgency')}</Label>
            <select
              id="sr-urgency"
              className={selectClass}
              value={urgency}
              onChange={(e) => {
                setUrgency(e.target.value as ServiceRequestUrgency);
                setSupplierOrgId('');
              }}
            >
              <option value="Normal">{t('serviceRequest.urgencyNormal')}</option>
              <option value="High">{t('serviceRequest.urgencyHigh')}</option>
              <option value="Emergency">{t('serviceRequest.urgencyEmergency')}</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sr-notes">{t('serviceRequest.notes')}</Label>
            <Textarea id="sr-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="charge-guest"
              checked={chargeToGuest}
              onCheckedChange={(v) => setChargeToGuest(v === true)}
            />
            <Label htmlFor="charge-guest" className="font-normal">
              {t('serviceRequest.chargeToGuest')}
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('booking.form.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!supplierOrgId || createMutation.isPending}
            data-testid="submit-service-request"
          >
            {t('serviceRequest.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
