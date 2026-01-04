import type { KnnGraph, WeightedEdge } from '../types';
import { applyWeightSpaceScaling } from './weight-scaling';

/** Directed edge before symmetrization */
interface DirectedEdge {
  source: string;
  target: string;
  strength: number;
}

/**
 * Convert k-NN graph into directed edges with strength values.
 *
 * This takes the k-NN data and produces a directed edge list.
 * Each point's neighbors are scaled using UMAP's local metric normalization
 * and converted to edges.
 *
 * @param knn - k-NN graph: Map from point ID to sorted neighbor array
 * @param k - Target number of effective neighbors (for sigma calibration)
 * @returns Array of directed edge objects (before symmetrization)
 */
export function neighborhoodsToEdges(
  knn: KnnGraph,
  k = 15
): DirectedEdge[] {
  if (!knn || knn.size === 0) {
    return [];
  }

  const edges: DirectedEdge[] = [];
  const nodeIds = new Set(knn.keys());

  for (const [pointId, neighbors] of knn) {
    if (!neighbors?.length) continue;

    // Apply local metric scaling with per-point sigma calibration
    const scaledNeighbors = applyWeightSpaceScaling(neighbors, k);

    for (const neighbor of scaledNeighbors) {
      // Skip self-edges
      if (neighbor.id === pointId) continue;

      // Skip edges to nodes that don't exist in the graph
      if (!nodeIds.has(neighbor.id)) continue;

      // Create edge with strength derived from weight
      // Clamp to minimum value to prevent zero-strength edges
      edges.push({
        source: pointId,
        target: neighbor.id,
        strength: Math.max(0.001, neighbor.weight),
      });
    }
  }

  return edges;
}

// Re-export for internal use
export type { DirectedEdge };
