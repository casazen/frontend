import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CrmAvatar } from '../crm-avatar';

const classOf = (name: string | null | undefined) => {
  render(<CrmAvatar name={name} />);
  const avatar = screen.getByTestId('crm-avatar');
  const classes = avatar.className;
  cleanup();
  return classes;
};

describe('CrmAvatar: the face of a guest in a list', () => {
  afterEach(() => cleanup());

  it('shows the first letters of the first and the last word, and is hidden from a screen reader', () => {
    render(<CrmAvatar name="  mario  de rossi " />);

    const avatar = screen.getByTestId('crm-avatar');
    expect(avatar).toHaveTextContent('MR');
    expect(avatar).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows one letter for one word', () => {
    render(<CrmAvatar name="Anna" />);

    expect(screen.getByTestId('crm-avatar')).toHaveTextContent('A');
  });

  it.each([null, undefined, '', '   '])('shows the icon of a person for the name %j', (name) => {
    render(<CrmAvatar name={name} />);

    const avatar = screen.getByTestId('crm-avatar');
    expect(avatar).toHaveTextContent('');
    expect(avatar.querySelector('svg')).not.toBeNull();
  });

  it('has the same tint for the same name, however it is written', () => {
    expect(classOf('Mario Rossi')).toBe(classOf('Mario Rossi'));
    expect(classOf('Mario Rossi')).toBe(classOf('  mario   ROSSI'));
  });

  it('gives a list some color and never the red of an alert', () => {
    const names = Array.from({ length: 60 }, (_, index) => `Ospite Numero${index}`);
    const classes = names.map(classOf);

    expect(new Set(classes).size).toBeGreaterThanOrEqual(3);
    for (const entry of classes) expect(entry).not.toContain('danger');
  });
});
