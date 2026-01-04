import type { SgdNode, PreparedEdge, ABParams } from '../types';

const MAX_ATTRACTIVE_STEP = 4.0;
const MAX_REPULSIVE_STEP = 4.0;
const MIN_DIST_SQUARED = 1e-7;

// Default attractive distance parameters
const DEFAULT_MIN_ATTRACTIVE_BASE = 3;
const DEFAULT_MIN_ATTRACTIVE_SCALE = 50;
const DEFAULT_MIN_ATTRACTIVE_PUSH = 0.45;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculate the gradient of the UMAP kernel function.
 *
 * The kernel is: 1 / (1 + a * d^(2b))
 * This returns the derivative with respect to distance squared.
 */
export function kernelGradient(distSquared: number, a: number, b: number): number {
  const distPow = Math.pow(distSquared, b);
  const numerator = 2.0 * a * b * Math.pow(distSquared, b - 1.0);
  return numerator / (1.0 + a * distPow);
}

/** Options for attractive force calculation */
export interface AttractiveForceOptions {
  minDist: number;
  minAttractiveBase?: number;
  minAttractiveScale?: number;
  minAttractivePush?: number;
}

/**
 * Apply attractive force update between two connected nodes.
 *
 * Implements UMAP's attractive force with:
 * - Gradient-based attraction proportional to edge weight
 * - Minimum distance enforcement with push-back
 * - Clamped step size to prevent instability
 */
export function applyAttractiveUpdate(
  nodes: SgdNode[],
  edge: PreparedEdge,
  alpha: number,
  ab: ABParams,
  options: AttractiveForceOptions
): void {
  const source = nodes[edge.sourceIndex];
  const target = nodes[edge.targetIndex];

  let diffX = source.x - target.x;
  let diffY = source.y - target.y;
  let distSquared = diffX * diffX + diffY * diffY;

  // Add small noise to prevent division by zero
  if (distSquared < MIN_DIST_SQUARED) {
    diffX = (Math.random() - 0.5) * 1e-3;
    diffY = (Math.random() - 0.5) * 1e-3;
    distSquared = diffX * diffX + diffY * diffY;
  }

  let gradCoeff = -kernelGradient(distSquared, ab.a, ab.b);
  gradCoeff *= edge.weight * alpha;

  // Calculate minimum attractive distance
  const minAttractiveBase = options.minAttractiveBase ?? DEFAULT_MIN_ATTRACTIVE_BASE;
  const minAttractiveScale = options.minAttractiveScale ?? DEFAULT_MIN_ATTRACTIVE_SCALE;
  const minAttractivePush = options.minAttractivePush ?? DEFAULT_MIN_ATTRACTIVE_PUSH;

  const minAttractiveDistance = minAttractiveBase + options.minDist * minAttractiveScale;
  const minAttractiveDistanceSq = minAttractiveDistance * minAttractiveDistance;
  let spacingAttenuation = 1.0;

  // If nodes are closer than minimum, apply push-back
  if (distSquared < minAttractiveDistanceSq) {
    const dist = Math.sqrt(distSquared);
    if (dist > 0) {
      const overlap = minAttractiveDistance - dist;
      const overlapRatio = overlap / minAttractiveDistance;
      spacingAttenuation = Math.max(0, 1 - overlapRatio);

      const normX = diffX / dist;
      const normY = diffY / dist;
      const push = overlapRatio * minAttractivePush * alpha;

      source.x += push * normX;
      source.y += push * normY;
      target.x -= push * normX;
      target.y -= push * normY;
    }
  }

  gradCoeff *= spacingAttenuation;
  gradCoeff = clamp(gradCoeff, -MAX_ATTRACTIVE_STEP, MAX_ATTRACTIVE_STEP);

  source.x += gradCoeff * diffX;
  source.y += gradCoeff * diffY;
  target.x -= gradCoeff * diffX;
  target.y -= gradCoeff * diffY;
}

/**
 * Apply repulsive force update between two nodes (negative sampling).
 *
 * Implements UMAP's repulsive force:
 * - Pushes non-neighboring nodes apart
 * - Uses same kernel function but with opposite sign
 * - Clamped step size to prevent instability
 */
export function applyRepulsiveUpdate(
  nodes: SgdNode[],
  sourceIndex: number,
  targetIndex: number,
  alpha: number,
  ab: ABParams,
  repulsionStrength: number
): void {
  if (sourceIndex === targetIndex) return;

  const source = nodes[sourceIndex];
  const target = nodes[targetIndex];

  let diffX = source.x - target.x;
  let diffY = source.y - target.y;
  let distSquared = diffX * diffX + diffY * diffY;

  // Add small noise to prevent division by zero
  if (distSquared < MIN_DIST_SQUARED) {
    diffX = (Math.random() - 0.5) * 1e-3;
    diffY = (Math.random() - 0.5) * 1e-3;
    distSquared = diffX * diffX + diffY * diffY;
  }

  const distPow = Math.pow(distSquared, ab.b);
  let gradCoeff = 2.0 * repulsionStrength * ab.b;
  gradCoeff /= (0.001 + distSquared) * (1.0 + ab.a * distPow);
  gradCoeff *= alpha;
  gradCoeff = clamp(gradCoeff, -MAX_REPULSIVE_STEP, MAX_REPULSIVE_STEP);

  source.x += gradCoeff * diffX;
  source.y += gradCoeff * diffY;
  target.x -= gradCoeff * diffX;
  target.y -= gradCoeff * diffY;
}
