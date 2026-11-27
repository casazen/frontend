import { formatCurrency } from "@/lib/utils";

export const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";
export const euro = (n: number) => formatCurrency(n, "EUR");
