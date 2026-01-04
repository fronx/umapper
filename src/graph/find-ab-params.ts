import type { ABParams } from '../types';

/**
 * Compute a and b parameters for the UMAP low-dimensional curve.
 *
 * This fits the curve 1/(1 + a*x^(2b)) to match an exponential decay:
 * - For distances < min_dist: curve should be ~1.0 (points stay close)
 * - For distances >= min_dist: exponential decay controlled by spread
 *
 * In UMAP, this curve controls how edge weights (from high-dim graph)
 * map to target distances in the low-dimensional embedding.
 *
 * @param spread - Scale of embedded points (default 1.0)
 * @param minDist - Minimum distance between points (default 0.1)
 * @returns Parameters for distance curve
 */
export function findABParams(spread = 1.0, minDist = 0.1): ABParams {
  // Generate target curve: step function + exponential decay
  const xValues: number[] = [];
  const yValues: number[] = [];

  // Sample 300 points from 0 to spread*3
  const numSamples = 300;
  const xMax = spread * 3;

  for (let i = 0; i < numSamples; i++) {
    const x = (i / numSamples) * xMax;
    xValues.push(x);

    // Target: 1.0 for x < minDist, exponential decay after
    const y = x < minDist ? 1.0 : Math.exp(-(x - minDist) / spread);
    yValues.push(y);
  }

  // Fit curve: 1/(1 + a*x^(2b)) using simple optimization
  // We'll use a grid search over reasonable ranges for a and b
  let bestA = 1.0;
  let bestB = 1.0;
  let bestError = Infinity;

  // Grid search over parameter space
  const aValues = [0.1, 0.5, 1.0, 1.5, 2.0, 3.0, 5.0, 10.0];
  const bValues = [0.1, 0.3, 0.5, 0.7, 1.0, 1.2, 1.5, 2.0];

  for (const a of aValues) {
    for (const b of bValues) {
      // Compute error for this (a, b) pair
      let error = 0;
      for (let i = 0; i < numSamples; i++) {
        const x = xValues[i];
        const yTarget = yValues[i];
        const yPred = 1.0 / (1.0 + a * Math.pow(x, 2 * b));
        error += Math.pow(yTarget - yPred, 2);
      }

      if (error < bestError) {
        bestError = error;
        bestA = a;
        bestB = b;
      }
    }
  }

  return { a: bestA, b: bestB };
}
