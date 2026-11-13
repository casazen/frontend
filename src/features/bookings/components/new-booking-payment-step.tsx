import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Banknote, Landmark, Link2, type LucideIcon } from 'lucide-react';
import { FormFieldError } from '@/components/shared/form-field-error';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import type { HostPaymentArrangement } from '@/types';
import { PAYMENT_LINK_BLOCK_KEYS, type NewBookingValues, type PaymentLinkBlock } from '../lib/new-booking-model';

interface PaymentCard {
  arrangement: HostPaymentArrangement;
  icon: LucideIcon;
  titleKey: string;
  descriptionKey: string;
}

/** The three ways, with the words of each. The keys are written out so that the i18n test finds a missing translation. */
const CARDS: readonly PaymentCard[] = [
  {
    arrangement: 'paymentLink',
    icon: Link2,
    titleKey: 'booking.create.payment.paymentLink.title',
    descriptionKey: 'booking.create.payment.paymentLink.description',
  },
  {
    arrangement: 'onSite',
    icon: Banknote,
    titleKey: 'booking.create.payment.onSite.title',
    descriptionKey: 'booking.create.payment.onSite.description',
  },
  {
    arrangement: 'bankTransfer',
    icon: Landmark,
    titleKey: 'booking.create.payment.bankTransfer.title',
    descriptionKey: 'booking.create.payment.bankTransfer.description',
  },
];

interface PaymentStepProps {
  /** Why the payment link cannot be chosen now, `null` when it can: the card is shown and blocked with that reason, never hidden. */
  linkBlock: PaymentLinkBlock | null;
}

/**
 * Step 4, how the guest pays (NF-74): one question, three answers that exclude each other, and no default, because the choice decides money. The link is the
 * only one that starts something (a payment on the host's Stripe account, a link e-mailed to the guest); the other two leave the balance to collect by hand
 * with «Registra incasso». Nothing here takes the host to another page: what stops the link is said on its card.
 */
export function PaymentStep({ linkBlock }: PaymentStepProps) {
  const { t } = useTranslation();
  const { control, setValue, formState } = useFormContext<NewBookingValues>();
  const chosen = useWatch({ control, name: 'paymentArrangement' });

  // A flex column with a gap, not `space-y-*`: the group is a `fieldset` with its own margin, which the spacing of the siblings would not move.
  return (
    <div className="flex flex-col gap-3" data-testid="booking-payment-step">
      <ChoiceGroup legend={t('booking.create.payment.legend')} minCardWidth={14}>
        {CARDS.map(({ arrangement, icon, titleKey, descriptionKey }) => {
          const blocked = arrangement === 'paymentLink' && linkBlock !== null;
          return (
            <ChoiceCard
              key={arrangement}
              name="booking-payment-arrangement"
              value={arrangement}
              checked={chosen === arrangement}
              disabled={blocked}
              onChange={() => setValue('paymentArrangement', arrangement, { shouldDirty: true })}
              icon={icon}
              title={t(titleKey)}
              description={blocked ? t(PAYMENT_LINK_BLOCK_KEYS[linkBlock]) : t(descriptionKey)}
              data-testid={`booking-payment-${arrangement}`}
            />
          );
        })}
      </ChoiceGroup>
      <FormFieldError error={formState.errors.paymentArrangement} />
    </div>
  );
}
