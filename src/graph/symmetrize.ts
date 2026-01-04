import type { WeightedEdge, SymmetryMode } from '../types';

/** Directed edge before symmetrization */
interface DirectedEdge {
  source: string;
  target: string;
  strength: number;
}

/**
 * Symmetrize directed edges using different combination strategies.
 *
 * Supports three modes:
 *
 * 1. "fuzzy-union" (default UMAP): a + b - a*b
 *    - Treats weights as independent probabilities
 *    - Preserves one-way connections
 *    - Can create "hub" effects where popular nodes accumulate edges
 *
 * 2. "product": a * b
 *    - Strict mutual proximity: both nodes must agree
 *    - Eliminates hub effects by suppressing one-way connections
 *    - Creates "star" patterns in dense clusters
 *
 * 3. "geometric": sqrt(a * b)
 *    - Softer mutual proximity (geometric mean)
 *    - Balance between fuzzy-union and strict product
 *    - Reduces hubs while preserving some structure
 *
 * @param directedEdges - Array of directed edges
 * @param mode - Combination mode (default: "fuzzy-union")
 * @returns Array of symmetrized edges (one edge per pair)
 */
export function symmetrizeEdges(
  directedEdges: DirectedEdge[],
  mode: SymmetryMode = 'fuzzy-union'
): WeightedEdge[] {
  // Build a map of edge pairs: (source, target) -> strength
  const edgeMap = new Map<string, number>();

  for (const edge of directedEdges) {
    const key = `${edge.source}:${edge.target}`;
    edgeMap.set(key, edge.strength);
  }

  // Process each unique pair once
  const symmetrizedEdges: WeightedEdge[] = [];
  const processedPairs = new Set<string>();

  for (const edge of directedEdges) {
    const { source, target, strength: a } = edge;

    // Create canonical key (sorted to ensure we process each pair once)
    const pairKey = source < target ? `${source}:${target}` : `${target}:${source}`;

    if (processedPairs.has(pairKey)) continue;
    processedPairs.add(pairKey);

    // Look up reverse edge
    const reverseKey = `${target}:${source}`;
    const b = edgeMap.get(reverseKey) || 0;

    // Combine edge weights based on mode
    let combinedStrength: number;
    switch (mode) {
      case 'product':
        // Mutual proximity: only strong if both agree
        combinedStrength = a * b;
        break;
      case 'geometric':
        // Geometric mean: softer mutual proximity
        combinedStrength = Math.sqrt(a * b);
        break;
      case 'fuzzy-union':
      default:
        // Fuzzy union: a + b - a*b (standard UMAP)
        combinedStrength = a + b - a * b;
        break;
    }

    symmetrizedEdges.push({
      source,
      target,
      strength: combinedStrength,
    });
  }

  return symmetrizedEdges;
}
