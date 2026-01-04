import type { Neighbor } from '../types';

/** Neighbor with computed weight */
export interface WeightedNeighbor extends Neighbor {
  weight: number;
}

/**
 * Calibrate sigma for a single point using binary search.
 *
 * This implements UMAP's smooth_knn_dist logic to find a sigma value
 * such that the sum of membership strengths approximates log2(k).
 *
 * @param neighbors - Sorted array of neighbor distances (excluding self)
 * @param k - Target number of effective neighbors
 * @param rho - Distance to nearest neighbor (for normalization)
 * @param maxIterations - Maximum binary search iterations
 * @returns Calibrated sigma value
 */
function calibrateSigma(
  neighbors: Neighbor[],
  k: number,
  rho: number,
  maxIterations = 64
): number {
  const target = Math.log2(k);
  let lo = 0.0;
  let hi = Infinity;
  let mid = 1.0;

  const tolerance = 1e-5;

  for (let iter = 0; iter < maxIterations; iter++) {
    // Compute sum of membership strengths with current sigma
    let psum = 0.0;
    for (let j = 0; j < neighbors.length; j++) {
      const d = neighbors[j].distance - rho;
      if (d > 0) {
        psum += Math.exp(-d / mid);
      } else {
        psum += 1.0;
      }
    }

    if (Math.abs(psum - target) < tolerance) {
      break;
    }

    if (psum > target) {
      hi = mid;
      mid = (lo + hi) / 2.0;
    } else {
      lo = mid;
      if (hi === Infinity) {
        mid *= 2.0;
      } else {
        mid = (lo + hi) / 2.0;
      }
    }

    // Prevent infinite loop if we can't converge
    if (mid === 0 || !isFinite(mid)) {
      mid = 1.0;
      break;
    }
  }

  return mid;
}

/**
 * Apply weight-space scaling to neighbors based on nearest neighbor distance.
 *
 * This implements local metric scaling similar to UMAP's first step:
 * - Normalizes distances by subtracting the nearest neighbor distance (rho)
 * - Calibrates sigma via binary search to achieve ~log2(k) effective neighbors
 * - Applies exponential decay: weight = exp(-(distance - rho) / sigma)
 *
 * @param neighbors - Array of neighbor objects with distance property
 *   Expected format: [{ id: string, distance: number }, ...]
 *   MUST be pre-sorted by distance (ascending)
 * @param k - Target number of effective neighbors (for sigma calibration)
 * @returns Array of neighbors with weight property added
 */
export function applyWeightSpaceScaling(
  neighbors: Neighbor[],
  k = 15
): WeightedNeighbor[] {
  if (!neighbors?.length) return [];

  // In UMAP terminology, this is rho - the distance to the nearest neighbor
  // We assume neighbors are pre-sorted by distance
  const rho = neighbors[0].distance;

  // Calibrate sigma for this specific point
  const sigma = calibrateSigma(neighbors, k, rho);

  // Apply exponential decay: exp(-(d - rho) / sigma)
  // This creates smooth falloff from the nearest neighbor
  const result = neighbors.map((neighbor) => {
    const d = neighbor.distance - rho;
    const weight = d > 0 ? Math.exp(-d / sigma) : 1.0;
    return {
      ...neighbor,
      weight,
    };
  });

  return result;
}
