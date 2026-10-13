import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import { IcalHelpTooltip } from '../ical-help-tooltip';

describe('IcalHelpTooltip', () => {
  // SU-16 (A4-32, #327-AC2): the help link opens the page inside the supplier console, not the public /help/ical.
  it('IcalHelpTooltip_CtaClicked_OpensHelpPageInsideSupplierConsole', () => {
    render(
      <MemoryRouter initialEntries={['/app/supplier/calendar']}>
        <Routes>
          <Route path="/app/supplier/calendar" element={<IcalHelpTooltip />} />
          <Route path="/app/supplier/help/ical" element={<p>supplier-help-route</p>} />
          <Route path="/help/ical" element={<p>public-help-route</p>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: i18n.t('supplier.help.icalTooltipLabel') }));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('supplier.help.icalTooltipCta') }));

    expect(screen.getByText('supplier-help-route')).toBeInTheDocument();
    expect(screen.queryByText('public-help-route')).not.toBeInTheDocument();
  });
});
