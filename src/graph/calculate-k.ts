/**
 * Calculate k (number of neighbors) based on dataset size using a sigmoid function.
 *
 * The sigmoid curve smoothly transitions from k~2 (small datasets) to k~26 (large datasets),
 * with the inflection point at ~1100 points. This provides a gradual increase in neighborhood
 * size as the dataset grows, avoiding sharp transitions.
 *
 * Higher k = more neighbors influence each point (smoother structure)
 * Lower k = fewer neighbors influence each point (finer local structure)
 *
 * @param datasetSize - The total number of nodes/points in the dataset
 * @returns Integer k value for neighborhood queries
 */
export function calculateK(datasetSize: number): number {
  const L = 2; // Lower bound for k
  const U = 25.8; // Upper bound for k
  const k = 0.0015; // Growth rate
  const x0 = 1100; // Midpoint of the sigmoid

  return Math.round(L + (U - L) / (1 + Math.exp(-k * (datasetSize - x0))));
}
