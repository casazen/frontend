export function isRentInConcordatoRange(
  rent: number,
  minMonthly: number | null | undefined,
  maxMonthly: number | null | undefined,
): boolean {
  if (minMonthly == null || maxMonthly == null || Number.isNaN(rent))
    return false;
  return rent >= minMonthly && rent <= maxMonthly;
}
