/** How a new contract is made: a canone concordato with the partner, or any other type filled in on the form of CasaZen. */
export type ContractKind = 'concordato' | 'altro';

/** The kind named in the address (`?tipo=`), or null when the question was not answered yet. */
export function contractKindOf(value: string | null): ContractKind | null {
  return value === 'concordato' || value === 'altro' ? value : null;
}
