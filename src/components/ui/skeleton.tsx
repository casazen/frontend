import * as React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

// The presets below are built on `Skeleton`. They pulse only when the user allows motion, and the whole group is
// announced once ("Loading..."): the placeholders themselves say nothing to assistive technology.
const STILL = "motion-reduce:animate-none";

interface PresetProps {
  /** What is loading, for screen readers ("Loading bookings..."). The default is the generic "Loading...". */
  label?: string;
  className?: string;
}

function Placeholder({ label, className, children }: PresetProps & { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label ?? t("shared.loading.srOnly")}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

/** Widths that make a column of lines look like text: the last line is shorter. */
const LINE_WIDTHS = ["w-full", "w-11/12", "w-4/5", "w-2/3"];
const lineWidth = (index: number, count: number) => (index === count - 1 && count > 1 ? "w-2/3" : LINE_WIDTHS[index % 3]);

interface SkeletonLineProps extends PresetProps {
  /** How many lines of text. */
  lines?: number;
  /** Height of the lines when it is not text (`h-10` stands in for a field). */
  lineClassName?: string;
}

/** One or more rows of text. */
function SkeletonLine({ lines = 1, lineClassName, label, className }: SkeletonLineProps) {
  return (
    <Placeholder label={label} className={className}>
      <div className="space-y-2">
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton key={index} className={cn("h-3", lineWidth(index, lines), STILL, lineClassName)} />
        ))}
      </div>
    </Placeholder>
  );
}

interface SkeletonCardProps extends PresetProps {
  /** Lines of text under the title. */
  lines?: number;
  /** A block for an image above the title. */
  media?: boolean;
}

/** A card: optional image, title and some lines. Same box as `Card`. */
function SkeletonCard({ lines = 3, media = false, label, className }: SkeletonCardProps) {
  return (
    <Placeholder label={label} className={className}>
      <div className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
        {media && <Skeleton className={cn("h-32 w-full", STILL)} />}
        <Skeleton className={cn("h-5 w-2/5", STILL)} />
        <div className="space-y-2">
          {Array.from({ length: lines }, (_, index) => (
            <Skeleton key={index} className={cn("h-3", lineWidth(index, lines), STILL)} />
          ))}
        </div>
      </div>
    </Placeholder>
  );
}

interface SkeletonTableProps extends PresetProps {
  rows?: number;
  columns?: number;
}

const CELL_WIDTHS = ["w-3/4", "w-full", "w-2/3", "w-5/6"];

/** A table: a header row and `rows` rows of `columns` cells. */
function SkeletonTable({ rows = 5, columns = 4, label, className }: SkeletonTableProps) {
  const grid = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };
  return (
    <Placeholder label={label} className={className}>
      <div className="space-y-4 rounded-lg border bg-card p-4">
        <div className="grid gap-4" style={grid}>
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton key={column} className={cn("h-3 w-1/2", STILL)} />
          ))}
        </div>
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="grid gap-4" style={grid}>
            {Array.from({ length: columns }, (_, column) => (
              <Skeleton key={column} className={cn("h-4", CELL_WIDTHS[(row + column) % CELL_WIDTHS.length], STILL)} />
            ))}
          </div>
        ))}
      </div>
    </Placeholder>
  );
}

interface SkeletonListProps extends PresetProps {
  items?: number;
}

/** A list of rows: a round avatar and two lines each. */
function SkeletonList({ items = 4, label, className }: SkeletonListProps) {
  return (
    <Placeholder label={label} className={className}>
      <div className="space-y-4">
        {Array.from({ length: items }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className={cn("size-10 shrink-0 rounded-full", STILL)} />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className={cn("h-3 w-2/5", STILL)} />
              <Skeleton className={cn("h-3 w-4/5", STILL)} />
            </div>
          </div>
        ))}
      </div>
    </Placeholder>
  );
}

export { Skeleton, SkeletonCard, SkeletonLine, SkeletonList, SkeletonTable };
