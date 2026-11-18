import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { ComplianceSetupStep } from '../steps/compliance-setup-step';
import { BillingSetupStep } from '../steps/billing-setup-step';

const { sender, billing } = vi.hoisted(() => ({ sender: vi.fn(), billing: vi.fn() }));
vi.mock('@/queries/use-property-sender', () => ({ useSender: sender }));
vi.mock('@/queries/use-billing-setup', () => ({ useBillingSetup: billing }));

beforeEach(async () => {
  await i18n.changeLanguage('it');
  sender.mockReset().mockReturnValue({ data: undefined });
  billing.mockReset().mockReturnValue({ data: undefined });
});

function show(content: React.ReactNode) { return render(<MemoryRouter>{content}</MemoryRouter>); }

describe('the property setup steps', () => {
  it('does not ask for Italian reporting credentials or pretend Swiss obligations are complete', () => {
    show(<ComplianceSetupStep propertyId="p1" country="CH" />);
    expect(sender).toHaveBeenCalledWith('p1', false);
    expect(screen.getByTestId('property-setup-local')).toHaveTextContent('non certifica');
    expect(screen.queryByTestId('property-setup-open-sender')).not.toBeInTheDocument();
  });

  it('opens the real sender flow for the property and carries its return destination', () => {
    sender.mockReturnValue({ data: { applies: true, source: 'DefaultNotConnected', sender: 'Manual' } });
    show(<ComplianceSetupStep propertyId="p1" country="IT" />);
    expect(screen.getByTestId('property-setup-open-sender')).toHaveAttribute('href', '/app/short-rent/compliance/sender?property=p1&returnPropertyId=p1');
    expect(screen.getByRole('status')).toHaveTextContent('Devi ancora confermare');
  });

  it('shows a failed read as an error even when stale sender data remains cached', () => {
    sender.mockReturnValue({ isError: true, error: new Error('Offline'), data: { source: 'Stored' }, refetch: vi.fn() });
    show(<ComplianceSetupStep propertyId="p1" country="IT" />);
    expect(screen.queryByTestId('property-setup-open-sender')).not.toBeInTheDocument();
    expect(screen.getByText(i18n.t('propertySetup.loadError'))).toBeInTheDocument();
  });

  it('links a missing fiscal identity to its exact persisted setup step', () => {
    billing.mockReturnValue({ data: { sections: [{ section: 'issuer', applies: true, complete: false, values: {}, missing: [{ key: 'legal_name_missing', section: 'issuer' }] }] } });
    show(<BillingSetupStep propertyId="p1" />);
    expect(screen.getByTestId('property-setup-open-billing')).toHaveAttribute('href', '/app/short-rent/fiscal/setup?returnPropertyId=p1&step=issuer');
    expect(screen.getByRole('status')).toHaveTextContent('Mancano alcuni dati');
  });
});
