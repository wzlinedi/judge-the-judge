// The Wilson score interval at 95% (research.md, section 7).
export interface Interval {
  lower: number;
  upper: number;
}

const Z = 1.959964;

export function wilson(successes: number, total: number): Interval | null {
  if (total <= 0) return null;
  const p = successes / total;
  const z2 = Z * Z;
  const denominator = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denominator;
  const margin = (Z * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total))) / denominator;
  return { lower: Math.max(0, center - margin), upper: Math.min(1, center + margin) };
}
