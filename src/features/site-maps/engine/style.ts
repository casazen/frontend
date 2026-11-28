export const FONT = "Inter, 'Segoe UI', system-ui, -apple-system, Roboto, 'Helvetica Neue', Arial, sans-serif";
export const INK = '#4a4136';
export const HALO = '#f7f1e6';

export const textW = (s: string, size: number, ls = 0, k = 0.57): number => s.length * (size * k + ls);

let mapCounter = 0;
export function resetMapIds(): void {
  mapCounter = 0;
}
export const nextPrefix = (): string => `sm${++mapCounter}`;
