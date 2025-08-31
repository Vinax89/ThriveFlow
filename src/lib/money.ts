export const toCents = (n: number) => Math.round(n * 100);
export const fromCents = (c: number) => c / 100;
export const clamp = (n: number, min = 0) => (n < min ? min : n);
