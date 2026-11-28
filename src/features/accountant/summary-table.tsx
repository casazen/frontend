import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const HEAD = 'px-3 py-2 font-medium';
const CELL = 'px-3 py-2 align-top';
const FIGURE = `${CELL} text-right tabular-nums`;

/** The width a column of a table of the summary needs before the table scrolls sideways instead of squeezing it (a phone shows two or three of them). */
const COLUMN_WIDTH_REM = 7;

export interface TableColumn<Row> {
  id: string;
  header: string;
  numeric?: boolean;
  rowHeader?: boolean;
  cell: (row: Row) => ReactNode;
}

interface SummaryTableProps<Row> {
  caption: string;
  testId: string;
  columns: readonly TableColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row, index: number) => string;
}

export function SummaryTable<Row>({ caption, testId, columns, rows, rowKey }: SummaryTableProps<Row>) {
  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className="overflow-x-auto rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-testid={`${testId}-scroll`}
    >
      <table className="w-full border-collapse text-sm" style={{ minWidth: `${columns.length * COLUMN_WIDTH_REM}rem` }} data-testid={testId}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border">
            {columns.map((column) => (
              <th key={column.id} scope="col" className={cn(HEAD, column.numeric ? 'text-right' : 'text-left')}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowKey(row, index)} className="border-b border-border" data-testid={`${testId}-row`}>
              {columns.map((column) =>
                column.rowHeader ? (
                  <th key={column.id} scope="row" className={cn(CELL, 'text-left font-medium')}>
                    {column.cell(row)}
                  </th>
                ) : (
                  <td key={column.id} className={column.numeric ? FIGURE : cn(CELL, 'text-left')}>
                    {column.cell(row)}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface TableBlockProps {
  title: string;
  note?: string;
  wide?: boolean;
  testId: string;
  children: ReactNode;
}

export function TableBlock({ title, note, wide = false, testId, children }: TableBlockProps) {
  const titleId = useId();
  return (
    <div className={cn('min-w-0 space-y-2', wide && '2xl:col-span-2')} role="group" aria-labelledby={titleId} data-testid={testId}>
      <h3 id={titleId} className="break-words text-sm font-semibold">
        {title}
      </h3>
      {note ? (
        <p className="break-words text-sm text-foreground/70" data-testid={`${testId}-note`}>
          {note}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export function NotAvailable({ label }: { label: string }) {
  return <span className="text-foreground/70">{label}</span>;
}
