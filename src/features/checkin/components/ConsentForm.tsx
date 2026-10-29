import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormFieldError } from '@/components/shared/form-field-error';
import type { PublicCheckInFormValues } from '../schemas/checkin.schema';

export function ConsentForm() {
  const { t } = useTranslation();
  const { setValue, formState: { errors } } = useFormContext<PublicCheckInFormValues>();
  const marketingConsentEmail = useWatch<PublicCheckInFormValues>({ name: 'marketingConsentEmail' });
  const marketingConsentWhatsApp = useWatch<PublicCheckInFormValues>({ name: 'marketingConsentWhatsApp' });
  const marketingEmail = useWatch<PublicCheckInFormValues>({ name: 'marketingEmail' });

  const anyChannelTicked = marketingConsentEmail || marketingConsentWhatsApp;

  return (
    <div className="space-y-4" data-testid="consent-form">
      <p className="text-sm text-muted-foreground">{t('checkin.consent.intro')}</p>

      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-md border p-4" data-testid="consent-email-channel">
          <Checkbox
            id="marketingConsentEmail"
            checked={marketingConsentEmail === true}
            onCheckedChange={(v) => setValue('marketingConsentEmail', v === true, { shouldValidate: true })}
          />
          <div className="space-y-1">
            <Label htmlFor="marketingConsentEmail" className="text-sm leading-relaxed cursor-pointer">
              {t('checkin.consent.emailChannel')}
            </Label>
            <p className="text-xs text-muted-foreground">{t('checkin.consent.emailChannelDescription')}</p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-md border p-4" data-testid="consent-whatsapp-channel">
          <Checkbox
            id="marketingConsentWhatsApp"
            checked={marketingConsentWhatsApp === true}
            onCheckedChange={(v) => setValue('marketingConsentWhatsApp', v === true, { shouldValidate: true })}
          />
          <div className="space-y-1">
            <Label htmlFor="marketingConsentWhatsApp" className="text-sm leading-relaxed cursor-pointer">
              {t('checkin.consent.whatsappChannel')}
            </Label>
            <p className="text-xs text-muted-foreground">{t('checkin.consent.whatsappChannelDescription')}</p>
          </div>
        </div>
      </div>

      {anyChannelTicked && (
        <div className="space-y-2" data-testid="consent-marketing-email">
          <Label htmlFor="marketingEmail" className="text-sm font-medium">
            {t('checkin.consent.marketingEmail')}
          </Label>
          <Input
            id="marketingEmail"
            type="email"
            placeholder={t('checkin.consent.marketingEmailPlaceholder')}
            value={marketingEmail ?? ''}
            onChange={(e) => setValue('marketingEmail', e.target.value, { shouldValidate: true })}
            aria-invalid={errors.marketingEmail ? 'true' : 'false'}
            aria-describedby={errors.marketingEmail ? 'marketingEmail-error' : undefined}
          />
          <p className="text-xs text-muted-foreground">{t('checkin.consent.marketingEmailHint')}</p>
          <FormFieldError id="marketingEmail-error" error={errors.marketingEmail} />
        </div>
      )}

      <p className="text-xs text-muted-foreground">{t('checkin.consent.skipAllowed')}</p>
    </div>
  );
}
