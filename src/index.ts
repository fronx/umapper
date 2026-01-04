// Main exports
export { buildGraph } from './graph';
export { runLayout } from './layout';

// Types
export type {
  Neighbor,
  KnnGraph,
  KnnGraphObject,
  LayoutNode,
  WeightedEdge,
  SymmetryMode,
  GraphOptions,
  LayoutOptions,
  LayoutProgress,
  ProgressCallback,
  UmapLayoutOptions,
  ABParams,
} from './types';

// Graph utilities (for advanced use)
export { findABParams } from './graph/find-ab-params';
export { applyWeightSpaceScaling } from './graph/weight-scaling';
export { neighborhoodsToEdges } from './graph/edge-builder';
export { symmetrizeEdges } from './graph/symmetrize';
export { calculateK } from './graph/calculate-k';

// Combined convenience function
import { buildGraph } from './graph';
import { runLayout } from './layout';
import type { KnnGraph, KnnGraphObject, LayoutNode, UmapLayoutOptions } from './types';

/**
 * Combined function: build graph + run layout in one call.
 *
 * @param knn - k-NN graph (Map or object format)
 * @param options - Combined graph and layout options
 * @returns Promise resolving to final node positions
 */
export async function umapLayout(
  knn: KnnGraph | KnnGraphObject,
  options: UmapLayoutOptions = {}
): Promise<LayoutNode[]> {
  // Convert object to Map if needed
  const knnMap = knn instanceof Map ? knn : new Map(Object.entries(knn));

  // Build graph
  const edges = buildGraph(knnMap, {
    k: options.k,
    symmetryMode: options.symmetryMode,
  });

  // Create initial nodes
  const nodeIds = Array.from(knnMap.keys());
  let nodes: LayoutNode[];

  if (options.initialPositions) {
    // Use provided initial positions
    const positionMap = new Map(options.initialPositions.map((n) => [n.id, n]));
    nodes = nodeIds.map((id) => {
      const pos = positionMap.get(id);
      return pos ?? { id, x: Math.random() * 100, y: Math.random() * 100 };
    });
  } else {
    // Random initialization
    nodes = nodeIds.map((id) => ({
      id,
      x: Math.random() * 100,
      y: Math.random() * 100,
    }));
  }

  // Run layout
  return runLayout(nodes, edges, {
    minDist: options.minDist,
    spread: options.spread,
    epochs: options.epochs,
    initialAlpha: options.initialAlpha,
    finalAlpha: options.finalAlpha,
    negativeSampleRate: options.negativeSampleRate,
    repulsionStrength: options.repulsionStrength,
    progressInterval: options.progressInterval,
    skipInitialUpdates: options.skipInitialUpdates,
    renderSampleRate: options.renderSampleRate,
    onProgress: options.onProgress,
  });
}
