import type { KnnGraph, WeightedEdge, GraphOptions } from '../types';
import { calculateK } from './calculate-k';
import { neighborhoodsToEdges } from './edge-builder';
import { symmetrizeEdges } from './symmetrize';

// Re-export individual functions for advanced use
export { findABParams } from './find-ab-params';
export { applyWeightSpaceScaling } from './weight-scaling';
export { neighborhoodsToEdges } from './edge-builder';
export { symmetrizeEdges } from './symmetrize';
export { calculateK } from './calculate-k';

/**
 * Build a weighted edge graph from k-NN data using UMAP's fuzzy simplicial set approach.
 *
 * Steps:
 * 1. Normalize distances by nearest neighbor (local metric)
 * 2. Calibrate sigma per point via binary search
 * 3. Apply exponential decay to create edge weights
 * 4. Symmetrize using fuzzy union (or product/geometric)
 *
 * @param knn - k-NN graph: Map from point ID to sorted neighbor array
 * @param options - Graph construction options
 * @returns Array of weighted edges
 */
export function buildGraph(knn: KnnGraph, options: GraphOptions = {}): WeightedEdge[] {
  if (!knn || knn.size === 0) {
    return [];
  }

  // Calculate k based on dataset size or use provided value
  let k: number;
  if (typeof options.k === 'function') {
    k = options.k(knn.size);
  } else if (typeof options.k === 'number') {
    k = options.k;
  } else {
    k = calculateK(knn.size);
  }

  // Build directed edges with local metric scaling
  const directedEdges = neighborhoodsToEdges(knn, k);

  // Symmetrize edges
  const symmetryMode = options.symmetryMode ?? 'fuzzy-union';
  return symmetrizeEdges(directedEdges, symmetryMode);
}
