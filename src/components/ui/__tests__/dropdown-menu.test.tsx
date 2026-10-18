import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../dropdown-menu';

afterEach(cleanup);

function Menu() {
  return (
    <DropdownMenu open>
      <DropdownMenuTrigger>Apri</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Modifica</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

describe('DropdownMenuContent (UI-07)', () => {
  it('DropdownMenuContent_Open_EasesInAndHasNoExitAnimation', () => {
    render(<Menu />);

    // Radix opens a menu when the pointer goes down on the trigger, and a menu that is still in the page for an exit animation
    // dismisses that very click: it would not reopen if the trigger is clicked in the 150 ms after it closed.
    const menu = screen.getByRole('menu');
    expect(menu.className).toContain('data-[state=open]:animate-in');
    expect(menu.className).not.toContain('animate-out');
    expect(menu.className).not.toContain('data-[state=closed]');
  });
});
