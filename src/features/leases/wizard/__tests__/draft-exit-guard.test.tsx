import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import i18n from '@/i18n/config';
import { DraftExitGuard } from '../draft-exit-guard';

it('keeps an unsaved contract in place after a failed save and continues the intended navigation after a retry', async () => {
  await i18n.changeLanguage('it');
  const flush = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const discard = vi.fn();
  const router = createMemoryRouter([
    { path: '/edit', element: <><DraftExitGuard flush={flush} hasPending={() => true} discard={discard} stopped={false} />
      <Link to="/leases">Contratti</Link></> },
    { path: '/leases', element: <h1>Elenco contratti</h1> },
  ], { initialEntries: ['/edit?step=2'] });
  render(<RouterProvider router={router} />);
  fireEvent.click(screen.getByRole('link', { name: 'Contratti' }));
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: i18n.t('leaseWizardGuide.exit.save') }));
  expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('leaseWizardGuide.exit.failed'));
  expect(router.state.location.pathname).toBe('/edit');
  fireEvent.click(screen.getByRole('button', { name: i18n.t('leaseWizardGuide.exit.save') }));
  expect(await screen.findByRole('heading', { name: 'Elenco contratti' })).toBeInTheDocument();
  expect(discard).not.toHaveBeenCalled();
  router.dispose();
});
