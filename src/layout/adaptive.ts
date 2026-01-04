import type { LayoutOptions } from '../types';

/** Epoch settings computed from node count and options */
export interface EpochSettings {
  totalEpochs: number;
  initialAlpha: number;
  finalAlpha: number;
  negativeSampleRate: number;
  repulsionStrength: number;
}

// Front-loading parameters for alpha scheduling
const FRONTLOAD_RATIO = 0.2; // Keep alpha high for 20% of epochs
const FRONTLOAD_DECAY_EXP = 1.4; // Ease-in curve for decay once frontload ends

/**
 * Calculate adaptive alpha value based on total number of nodes.
 *
 * Small graphs (N < 10): low alpha ~0.2 (minimal movement needed)
 * Medium graphs (10 <= N < 100): increasing alpha (more mixing needed)
 * Large graphs (N >= 100): plateau at ~0.6 (maximum movement needed)
 *
 * Uses a sigmoid-like curve.
 */
export function calculateAdaptiveAlpha(nodeCount: number): number {
  const MIN_ALPHA = 0.25;
  const MAX_ALPHA = 1.0;
  const MIDPOINT = 30; // Inflection point of the S-curve
  const STEEPNESS = 0.08; // How quickly it transitions

  const range = MAX_ALPHA - MIN_ALPHA;
  const normalized = 1 / (1 + Math.exp(-STEEPNESS * (nodeCount - MIDPOINT)));
  return MIN_ALPHA + range * normalized;
}

/**
 * Calculate adaptive repulsion edge sampling ratio based on graph size.
 *
 * Small graphs (N < 1000): sample ratio ~1.0 (full sampling for better quality)
 * Large graphs (N >= 10000): sample ratio ~0.5 (still half of edges)
 *
 * Uses smooth exponential decay curve.
 */
export function calculateRepulsionEdgeSample(nodeCount: number): number {
  const MAX_SAMPLE = 1.0;
  const MIN_SAMPLE = 0.5;
  const SMALL_THRESHOLD = 1000;
  const LARGE_THRESHOLD = 9000;

  if (nodeCount <= SMALL_THRESHOLD) {
    return MAX_SAMPLE;
  }
  if (nodeCount >= LARGE_THRESHOLD) {
    return MIN_SAMPLE;
  }

  // Smooth exponential decay between thresholds
  const progress = (nodeCount - SMALL_THRESHOLD) / (LARGE_THRESHOLD - SMALL_THRESHOLD);
  const decayed = 1 - Math.pow(progress, 1.5);
  return MIN_SAMPLE + (MAX_SAMPLE - MIN_SAMPLE) * decayed;
}

/**
 * Calculate full coverage ratio for initial epochs.
 *
 * Early epochs use full edge sampling for better structure discovery,
 * then transition to partial sampling for efficiency.
 */
export function calculateFullCoverageRatio(nodeCount: number): number {
  const smoothRatio = 2500 / (nodeCount + 2500);
  return Math.min(Math.max(smoothRatio, 0.1), 0.3);
}

/**
 * Calculate epoch settings based on node count and options.
 *
 * Automatically computes optimal values for:
 * - Total epochs
 * - Initial/final learning rates
 * - Negative sampling rate
 * - Repulsion strength
 */
export function calculateEpochSettings(
  nodeCount: number,
  spread: number,
  options: LayoutOptions = {}
): EpochSettings {
  const safeCount = Math.max(1, nodeCount);
  const epochs = options.epochs ?? 300;
  const initialAlpha = options.initialAlpha ?? calculateAdaptiveAlpha(safeCount);

  const autoNegativeSampleRate = Math.min(
    12,
    Math.max(2, Math.round(Math.log10(safeCount + 10)))
  );

  const autoFinalAlpha = Math.min(initialAlpha, Math.max(0.2, initialAlpha * 0.1));

  return {
    totalEpochs: epochs,
    initialAlpha,
    finalAlpha: options.finalAlpha ?? autoFinalAlpha,
    negativeSampleRate: options.negativeSampleRate ?? autoNegativeSampleRate,
    repulsionStrength: options.repulsionStrength ?? Math.max(0.2, spread),
  };
}

/**
 * Compute front-loaded alpha value for a given progress ratio.
 *
 * Keeps alpha high for the first 20% of epochs (front-loading),
 * then applies smooth ease-in decay to final value.
 */
export function computeFrontLoadedAlpha(
  progressRatio: number,
  initialAlpha: number,
  finalAlpha: number
): number {
  if (progressRatio <= FRONTLOAD_RATIO) {
    return initialAlpha;
  }

  const decayProgress =
    (progressRatio - FRONTLOAD_RATIO) / Math.max(1e-6, 1 - FRONTLOAD_RATIO);
  const easedDecay = Math.pow(decayProgress, FRONTLOAD_DECAY_EXP);
  return initialAlpha + (finalAlpha - initialAlpha) * easedDecay;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Clamp repulsion edge sample to valid range */
export function clampRepulsionEdgeSample(value: number): number {
  return clamp(value, 0.05, 1.0);
}
