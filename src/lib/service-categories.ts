export function keepKnownCategories(selected: string[], codes: string[] | undefined): string[] {
  return codes ? selected.filter((value) => codes.includes(value)) : selected;
}

export function unknownCategories(selected: string[], codes: string[] | undefined): string[] {
  return codes ? selected.filter((value) => !codes.includes(value)) : [];
}
