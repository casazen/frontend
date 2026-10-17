import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-2xl font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center p-6 pt-0", className)}
      {...props}
    />
  )
);
CardFooter.displayName = "CardFooter";

// Spelled out, so that Tailwind finds the classes.
const ROW_SPANS = {
  2: "row-span-2",
  3: "row-span-3",
  4: "row-span-4",
  5: "row-span-5",
  6: "row-span-6",
} as const;

// The same, from a width: a plain column below it. The number of rows is a variable, so that a class is not spelled out for each.
const FROM = {
  sm: "sm:grid sm:grid-rows-subgrid sm:gap-y-0 sm:[grid-row:span_var(--aligned-rows)]",
  md: "md:grid md:grid-rows-subgrid md:gap-y-0 md:[grid-row:span_var(--aligned-rows)]",
  lg: "lg:grid lg:grid-rows-subgrid lg:gap-y-0 lg:[grid-row:span_var(--aligned-rows)]",
} as const;

interface AlignedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The sections of the card (an icon, a title, a text, a list, a button...): one row each, the same number in every card of the grid. */
  rows: keyof typeof ROW_SPANS;
  /**
   * The width from which the grid has more than one column (`sm`, `md` or `lg`, the one of its `sm:grid-cols-2`). Below it the card
   * is a plain column, where a section that a card has not, an empty `<div />`, takes no room. Without it the card is a subgrid at
   * every width, which is right when every card has every section.
   */
  from?: keyof typeof FROM;
}

/**
 * A card for a grid of cards that are made of the same sections: the title, the text, the list and the button of every card of a row
 * start at the same height, whatever the length of their texts (a title on two lines in one card no longer pushes down only its own
 * text and button). The card is a subgrid of the grid it is in, so the sections are the rows of that grid: the height of a row is
 * the tallest section of it among the cards of the row, and a card that has less in a row keeps the room free.
 *
 * Each direct child is a row: a section of several elements is one wrapper, and a section that a card does not have is an empty
 * `<div />`, which keeps the others in their place. The card has no gap between the rows: spacing is by margin, on the section it
 * is under. The padding is the card's, so the sections need none. The grid is the usual `grid gap-6 md:grid-cols-3`; the card
 * is the child, and it takes its rows from the grid whatever the number of columns, a phone included (unless `from` says otherwise).
 *
 * A row that is empty in every card of a line still takes the gap of the grid, because the gap is the grid's and not the card's: a
 * section that none of the cards of the grid has is left out of all of them (the grid knows its list: see `rows`), and the
 * placeholder is only for a section that some of them have.
 */
const AlignedCard = React.forwardRef<HTMLDivElement, AlignedCardProps>(({ rows, from, className, style, ...props }, ref) =>
  from ? (
    <Card
      ref={ref}
      className={cn("flex flex-col p-6", FROM[from], className)}
      style={{ ...style, "--aligned-rows": rows } as React.CSSProperties}
      {...props}
    />
  ) : (
    <Card ref={ref} className={cn("grid grid-rows-subgrid gap-y-0 p-6", ROW_SPANS[rows], className)} style={style} {...props} />
  ),
);
AlignedCard.displayName = "AlignedCard";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, AlignedCard };
