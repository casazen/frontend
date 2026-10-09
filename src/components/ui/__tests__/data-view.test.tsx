import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { Users } from 'lucide-react';
import i18n from '@/i18n/config';
import { expectNoAxeViolations } from '@/test/axe';
import { DataView, type DataColumn, type DataViewProps, type DataViewSort } from '../data-view';

interface Guest {
  id: string;
  name: string;
  city: string | null;
  nights: number;
}

const GUESTS: Guest[] = [
  { id: 'g3', name: 'Zeno Verdi', city: 'Torino', nights: 10 },
  { id: 'g1', name: 'Anna Bianchi', city: 'Roma', nights: 2 },
  { id: 'g2', name: 'Mario Rossi', city: null, nights: 3 },
];

const COLUMNS: DataColumn<Guest>[] = [
  { key: 'name', header: 'Nome', rowHeader: true, sortable: true },
  { key: 'city', header: 'Città', sortable: true },
  { key: 'nights', header: 'Notti', align: 'end', sortable: true },
];

function Harness(props: Partial<DataViewProps<Guest>>) {
  return (
    <DataView<Guest>
      label="Ospiti"
      rows={GUESTS}
      columns={COLUMNS}
      rowKey={(guest) => guest.id}
      renderCard={(guest) => (
        <>
          <p>{guest.name}</p>
          <p>{guest.city ?? '—'}</p>
        </>
      )}
      {...props}
    />
  );
}

const table = () => screen.getByRole('table', { name: 'Ospiti' });
const list = () => screen.getByRole('list', { name: 'Ospiti' });
/** The names, in the order of the rows of the table. */
const order = () => within(table()).getAllByRole('rowheader').map((cell) => cell.textContent);
const header = (name: string) => within(table()).getByRole('columnheader', { name });

describe('DataView (UI-07)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  describe('a table and a list of cards', () => {
    it('DataView_Rows_AreATableWithACaptionAndAListOfCardsWithTheSameRows', () => {
      render(<Harness />);

      expect(within(table()).getAllByRole('row')).toHaveLength(4);
      expect(within(list()).getAllByRole('listitem')).toHaveLength(3);
      expect(within(list()).getByText('Anna Bianchi')).toBeInTheDocument();
      expect(within(table()).getByRole('rowheader', { name: 'Anna Bianchi' })).toBeInTheDocument();
    });

    it('DataView_Table_ShowsFromMdUpAndTheCardsOnlyUnderIt', () => {
      render(<Harness />);

      expect(table().closest('div.hidden')).toHaveClass('hidden', 'md:block');
      expect(list().parentElement).toHaveClass('md:hidden');
    });

    it('DataView_CardsUntilLg_TheCardsStayUntilTheDesktop', () => {
      render(<Harness cardsUntil="lg" />);

      expect(table().closest('div.hidden')).toHaveClass('hidden', 'lg:block');
      expect(list().parentElement).toHaveClass('lg:hidden');
    });

    it('DataView_Table_HasHeadersOfColumnsAndTheNameOfTheRowAsHeaderOfTheRow', () => {
      render(<Harness />);

      expect(within(table()).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Nome', 'Città', 'Notti']);
      expect(within(table()).getAllByRole('rowheader').map((cell) => cell.textContent)).toEqual([
        'Zeno Verdi',
        'Anna Bianchi',
        'Mario Rossi',
      ]);
    });

    it('DataView_ColumnWithoutACell_ShowsThePropertyOfTheRow', () => {
      render(<Harness />);

      const row = within(table()).getByRole('row', { name: /Anna Bianchi/ });
      expect(within(row).getByText('Roma')).toBeInTheDocument();
      expect(within(row).getByText('2')).toHaveClass('text-right');
    });

    it('DataView_ColumnWithACell_ShowsWhatItReturns', () => {
      render(
        <Harness
          columns={[
            { key: 'name', header: 'Nome', rowHeader: true },
            { key: 'nights', header: 'Notti', cell: (guest) => `${guest.nights} notti` },
          ]}
        />,
      );

      expect(within(table()).getByText('10 notti')).toBeInTheDocument();
    });

    it('DataView_RowActions_AreTheLastColumnWithAHiddenTitle', () => {
      render(<Harness rowActions={(guest) => <a href={`/ospiti/${guest.id}`}>Apri</a>} />);

      expect(within(table()).getAllByRole('link', { name: 'Apri' })).toHaveLength(3);
      expect(within(table()).getByRole('columnheader', { name: 'Azioni' })).toBeInTheDocument();
    });

    it('DataView_Footer_IsShownUnderTheList', () => {
      render(<Harness footer={<p>1–3 di 3</p>} />);

      expect(screen.getByText('1–3 di 3')).toBeInTheDocument();
    });

    it('DataView_OnAPhone_NothingCanWidenThePage', () => {
      const { container } = render(<Harness />);

      const root = container.firstElementChild as HTMLElement;
      expect(root).toHaveClass('min-w-0', 'max-w-full');
      // The table scrolls inside itself on a tablet that is too narrow for it, and is not there at all on a phone. The box
      // is positioned so that the `sr-only` caption and column title (absolute) are scrolled and clipped with it.
      expect(table().parentElement).toHaveClass('overflow-x-auto', 'relative');
      // A card breaks a long word instead of pushing the row out.
      expect(within(list()).getByText('Anna Bianchi').parentElement).toHaveClass('min-w-0', 'break-words');
    });
  });

  describe('sorting', () => {
    it('DataView_SortableColumn_TheTitleIsAButton', () => {
      render(<Harness />);

      expect(within(header('Nome')).getByRole('button', { name: 'Nome' })).toBeInTheDocument();
    });

    it('DataView_NotSortable_TheTitleIsPlainText', () => {
      render(<Harness columns={[{ key: 'name', header: 'Nome', rowHeader: true }]} />);

      expect(within(header('Nome')).queryByRole('button')).not.toBeInTheDocument();
      expect(header('Nome')).not.toHaveAttribute('aria-sort');
    });

    it('DataView_ClickOnATitle_SortsAscendingThenDescendingAndSaysIt', () => {
      render(<Harness />);
      expect(order()).toEqual(['Zeno Verdi', 'Anna Bianchi', 'Mario Rossi']);

      fireEvent.click(within(header('Nome')).getByRole('button'));
      expect(order()).toEqual(['Anna Bianchi', 'Mario Rossi', 'Zeno Verdi']);
      expect(header('Nome')).toHaveAttribute('aria-sort', 'ascending');

      fireEvent.click(within(header('Nome')).getByRole('button'));
      expect(order()).toEqual(['Zeno Verdi', 'Mario Rossi', 'Anna Bianchi']);
      expect(header('Nome')).toHaveAttribute('aria-sort', 'descending');
    });

    it('DataView_SortedByAnotherColumn_OnlyThatOneSaysAriaSort', () => {
      render(<Harness />);

      fireEvent.click(within(header('Nome')).getByRole('button'));
      fireEvent.click(within(header('Notti')).getByRole('button'));

      expect(header('Notti')).toHaveAttribute('aria-sort', 'ascending');
      expect(header('Nome')).not.toHaveAttribute('aria-sort');
      expect(order()).toEqual(['Anna Bianchi', 'Mario Rossi', 'Zeno Verdi']);
    });

    it('DataView_Numbers_AreComparedAsNumbersNotAsText', () => {
      render(<Harness />);

      fireEvent.click(within(header('Notti')).getByRole('button'));

      // As text "10" would come before "2".
      expect(order()).toEqual(['Anna Bianchi', 'Mario Rossi', 'Zeno Verdi']);
      fireEvent.click(within(header('Notti')).getByRole('button'));
      expect(order()).toEqual(['Zeno Verdi', 'Mario Rossi', 'Anna Bianchi']);
    });

    it('DataView_RowsWithoutAValue_GoLastInEitherDirection', () => {
      render(<Harness />);

      fireEvent.click(within(header('Città')).getByRole('button'));
      expect(order()).toEqual(['Anna Bianchi', 'Zeno Verdi', 'Mario Rossi']);
      fireEvent.click(within(header('Città')).getByRole('button'));
      expect(order()).toEqual(['Zeno Verdi', 'Anna Bianchi', 'Mario Rossi']);
    });

    it('DataView_SortValue_IsWhatTheRowsAreComparedBy', () => {
      render(
        <Harness
          columns={[
            { key: 'name', header: 'Nome', rowHeader: true, sortable: true, sortValue: (guest) => guest.name.split(' ')[1] },
          ]}
        />,
      );

      fireEvent.click(within(header('Nome')).getByRole('button'));

      // By surname: Bianchi, Rossi, Verdi.
      expect(order()).toEqual(['Anna Bianchi', 'Mario Rossi', 'Zeno Verdi']);
    });

    it('DataView_DefaultSort_IsWhereTheListStarts', () => {
      render(<Harness defaultSort={{ key: 'nights', direction: 'desc' }} />);

      expect(order()).toEqual(['Zeno Verdi', 'Mario Rossi', 'Anna Bianchi']);
      expect(header('Notti')).toHaveAttribute('aria-sort', 'descending');
    });

    it('DataView_Sorted_TheCardsFollowTheSameOrder', () => {
      render(<Harness />);

      fireEvent.click(within(header('Nome')).getByRole('button'));

      expect(within(list()).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
        'Anna BianchiRoma',
        'Mario Rossi—',
        'Zeno VerdiTorino',
      ]);
    });

    it('DataView_CallerOwnsTheSort_ItAsksButDoesNotReorderTheRows', () => {
      const onSortChange = vi.fn();
      const sort: DataViewSort = { key: 'name', direction: 'desc' };
      render(<Harness sort={sort} onSortChange={onSortChange} />);

      expect(header('Nome')).toHaveAttribute('aria-sort', 'descending');
      // The rows are as the caller sent them.
      expect(order()).toEqual(['Zeno Verdi', 'Anna Bianchi', 'Mario Rossi']);

      fireEvent.click(within(header('Nome')).getByRole('button'));
      expect(onSortChange).toHaveBeenLastCalledWith({ key: 'name', direction: 'asc' });
      fireEvent.click(within(header('Notti')).getByRole('button'));
      expect(onSortChange).toHaveBeenLastCalledWith({ key: 'nights', direction: 'asc' });
      expect(order()).toEqual(['Zeno Verdi', 'Anna Bianchi', 'Mario Rossi']);
    });

    it('DataView_CallerOwnsTheSortWithNoOrder_NothingSaysAriaSort', () => {
      render(<Harness sort={null} onSortChange={() => undefined} />);

      for (const name of ['Nome', 'Città', 'Notti']) expect(header(name)).not.toHaveAttribute('aria-sort');
    });
  });

  describe('selection and actions on many rows', () => {
    function Selecting({ onSelectedChange }: { onSelectedChange?: (keys: string[]) => void }) {
      const [selected, setSelected] = useState<string[]>([]);
      return (
        <Harness
          selectable
          selected={selected}
          onSelectedChange={(keys) => {
            setSelected(keys);
            onSelectedChange?.(keys);
          }}
          rowLabel={(guest) => `Seleziona ${guest.name}`}
          bulkActions={(rows) => <button type="button">Invia a {rows.map((r) => r.name).join(', ')}</button>}
        />
      );
    }

    it('DataView_Selectable_EveryRowHasABoxWithTheNameOfTheRow', () => {
      render(<Selecting />);

      expect(within(table()).getByRole('checkbox', { name: 'Seleziona Anna Bianchi' })).not.toBeChecked();
      expect(within(list()).getByRole('checkbox', { name: 'Seleziona Anna Bianchi' })).not.toBeChecked();
      expect(within(table()).getByRole('checkbox', { name: 'Seleziona tutte le righe' })).toBeInTheDocument();
    });

    it('DataView_NotSelectable_HasNoBoxesAndNoBar', () => {
      render(<Harness />);

      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
      expect(screen.queryByRole('region')).not.toBeInTheDocument();
    });

    it('DataView_SelectingARow_ShowsTheBarWithTheCountAndTheActions', () => {
      const onSelectedChange = vi.fn();
      render(<Selecting onSelectedChange={onSelectedChange} />);
      expect(screen.queryByRole('region', { name: 'Azioni sulle righe selezionate' })).not.toBeInTheDocument();

      fireEvent.click(within(table()).getByRole('checkbox', { name: 'Seleziona Anna Bianchi' }));

      const bar = screen.getByRole('region', { name: 'Azioni sulle righe selezionate' });
      expect(onSelectedChange).toHaveBeenLastCalledWith(['g1']);
      expect(within(bar).getByText('1 selezionata')).toBeInTheDocument();
      expect(within(bar).getByRole('button', { name: 'Invia a Anna Bianchi' })).toBeInTheDocument();

      fireEvent.click(within(table()).getByRole('checkbox', { name: 'Seleziona Mario Rossi' }));
      expect(within(bar).getByText('2 selezionate')).toBeInTheDocument();
    });

    it('DataView_Selection_IsTheSameOnTheTableAndOnTheCards', () => {
      render(<Selecting />);

      fireEvent.click(within(list()).getByRole('checkbox', { name: 'Seleziona Zeno Verdi' }));

      expect(within(table()).getByRole('checkbox', { name: 'Seleziona Zeno Verdi' })).toBeChecked();
      expect(within(list()).getByRole('checkbox', { name: 'Seleziona Zeno Verdi' })).toBeChecked();
    });

    it('DataView_SelectAll_SelectsEveryRowAndAgainClearsThem', () => {
      render(<Selecting />);
      const all = within(table()).getByRole('checkbox', { name: 'Seleziona tutte le righe' });

      fireEvent.click(all);
      expect(all).toBeChecked();
      expect(screen.getByText('3 selezionate')).toBeInTheDocument();

      fireEvent.click(all);
      expect(all).not.toBeChecked();
      expect(screen.queryByRole('region')).not.toBeInTheDocument();
    });

    it('DataView_SomeSelected_TheBoxForAllIsInTheMiddle', () => {
      render(<Selecting />);

      fireEvent.click(within(table()).getByRole('checkbox', { name: 'Seleziona Anna Bianchi' }));

      const all = within(table()).getByRole('checkbox', { name: 'Seleziona tutte le righe' }) as HTMLInputElement;
      expect(all.indeterminate).toBe(true);
      expect(all).not.toBeChecked();
    });

    it('DataView_SelectAllOfTheCards_IsARowWithItsWords', () => {
      render(<Selecting />);

      fireEvent.click(within(list().parentElement as HTMLElement).getByLabelText('Seleziona tutte le righe'));

      expect(screen.getByText('3 selezionate')).toBeInTheDocument();
    });

    it('DataView_ClearSelection_EmptiesItAndHidesTheBar', () => {
      render(<Selecting />);
      fireEvent.click(within(table()).getByRole('checkbox', { name: 'Seleziona Anna Bianchi' }));

      fireEvent.click(screen.getByRole('button', { name: 'Annulla la selezione' }));

      expect(within(table()).getByRole('checkbox', { name: 'Seleziona Anna Bianchi' })).not.toBeChecked();
      expect(screen.queryByRole('region')).not.toBeInTheDocument();
    });

    it('DataView_SelectedRow_IsMarkedOnTheTableAndOnTheCard', () => {
      render(<Selecting />);

      fireEvent.click(within(table()).getByRole('checkbox', { name: 'Seleziona Anna Bianchi' }));

      expect(within(table()).getByRole('row', { name: /Anna Bianchi/ })).toHaveAttribute('data-selected', 'true');
      expect(within(list()).getAllByRole('listitem')[1]).toHaveAttribute('data-selected', 'true');
    });

    it('DataView_WithoutSelectedProp_KeepsTheSelectionItself', () => {
      render(<Harness selectable bulkActions={(rows) => <span>{rows.length} da gestire</span>} />);

      // No `rowLabel`: the boxes are all called the same.
      fireEvent.click(within(table()).getAllByRole('checkbox', { name: 'Seleziona la riga' })[0]);

      expect(screen.getByText('1 da gestire')).toBeInTheDocument();
    });

    it('DataView_BulkBar_StaysUnderTheHeaderWhileThePageScrolls', () => {
      render(<Selecting />);

      fireEvent.click(within(table()).getByRole('checkbox', { name: 'Seleziona Anna Bianchi' }));

      expect(screen.getByTestId('data-view-bulk-bar')).toHaveClass('sticky', 'top-[var(--header-height,0px)]');
    });

    it('DataView_BoxesAreOfTheSizeOfAFinger', () => {
      render(<Selecting />);

      const box = within(table()).getByRole('checkbox', { name: 'Seleziona Anna Bianchi' });
      expect(box.closest('label')).toHaveClass('h-11', 'w-11');
    });
  });

  describe('loading, failing and nothing to show', () => {
    it('DataView_Loading_ShowsASkeletonThatIsAnnouncedAndNoRows', () => {
      render(<Harness isLoading />);

      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-busy', 'true');
      expect(status).toHaveTextContent("Caricamento dell'elenco");
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('DataView_Error_ShowsTheErrorWithRetryNotAnEmptyList', () => {
      const onRetry = vi.fn();
      render(<Harness isError errorTitle="Impossibile caricare gli ospiti" onRetry={onRetry} rows={[]} />);

      expect(screen.getByRole('alert')).toHaveTextContent('Impossibile caricare gli ospiti');
      expect(screen.queryByText('Nessun elemento')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('DataView_ErrorWithoutATitle_SaysItInGeneralTerms', () => {
      render(<Harness isError />);

      expect(screen.getByRole('alert')).toHaveTextContent("Impossibile caricare l'elenco");
    });

    it('DataView_NoRows_ShowsWhatToDoNext', () => {
      const onClick = vi.fn();
      render(
        <Harness
          rows={[]}
          empty={{
            icon: Users,
            title: 'Nessun ospite',
            description: 'Gli ospiti arrivano con le prenotazioni.',
            action: { label: 'Crea una prenotazione', onClick },
          }}
        />,
      );

      expect(screen.getByText('Nessun ospite')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Crea una prenotazione' }));
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('DataView_NoRowsAndNoWords_StillSaysSomething', () => {
      render(<Harness rows={[]} />);

      expect(screen.getByText('Nessun elemento')).toBeInTheDocument();
      expect(screen.getByText("Non c'è ancora niente da mostrare in questo elenco.")).toBeInTheDocument();
    });

    it('DataView_InEnglish_SpeaksEnglish', async () => {
      await i18n.changeLanguage('en');
      render(<Harness isLoading />);

      expect(screen.getByRole('status')).toHaveTextContent('Loading the list');
    });
  });

  describe('accessibility', () => {
    it('DataView_WithEverythingOn_HasNoAxeViolations', async () => {
      const { container } = render(
        <Harness
          selectable
          selected={['g1']}
          onSelectedChange={() => undefined}
          rowLabel={(guest) => `Seleziona ${guest.name}`}
          bulkActions={() => <button type="button">Invia</button>}
          rowActions={(guest) => <a href={`/ospiti/${guest.id}`}>Apri</a>}
          defaultSort={{ key: 'name', direction: 'asc' }}
          footer={<p>3 ospiti</p>}
        />,
      );

      await expectNoAxeViolations(container);
    });

    it('DataView_LoadingAndEmptyAndError_HaveNoAxeViolations', async () => {
      const loading = render(<Harness isLoading />);
      await expectNoAxeViolations(loading.container);
      loading.unmount();

      const empty = render(<Harness rows={[]} />);
      await expectNoAxeViolations(empty.container);
      empty.unmount();

      const failed = render(<Harness isError onRetry={() => undefined} />);
      await expectNoAxeViolations(failed.container);
    });
  });
});
