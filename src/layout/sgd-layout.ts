import type {
  LayoutNode,
  WeightedEdge,
  LayoutOptions,
  LayoutProgress,
  ProgressCallback,
  SgdNode,
  PreparedEdge,
} from '../types';
import { findABParams } from '../graph/find-ab-params';
import { applyAttractiveUpdate, applyRepulsiveUpdate } from './forces';
import {
  calculateEpochSettings,
  calculateRepulsionEdgeSample,
  calculateFullCoverageRatio,
  computeFrontLoadedAlpha,
  clampRepulsionEdgeSample,
} from './adaptive';

const DEFAULT_FRAME_MS = 32;
const DEFAULT_RENDER_SAMPLE_RATE = 2;
const YIELD_EVERY_EPOCHS = 5;

/**
 * Prepare edge list with node indices for fast lookup.
 */
function prepareEdgeList(nodes: SgdNode[], edges: WeightedEdge[]): PreparedEdge[] {
  const nodeIndexMap = new Map<string, number>();
  nodes.forEach((node, index) => nodeIndexMap.set(node.id, index));

  const prepared: PreparedEdge[] = [];
  for (const edge of edges) {
    const sourceIndex = nodeIndexMap.get(edge.source);
    const targetIndex = nodeIndexMap.get(edge.target);
    if (sourceIndex === undefined || targetIndex === undefined) continue;
    if (sourceIndex === targetIndex) continue;

    prepared.push({
      sourceIndex,
      targetIndex,
      weight: Math.max(0.0001, edge.strength || 0.0001),
    });
  }

  return prepared;
}

/**
 * Convert LayoutNode array to SgdNode array.
 */
function toSgdNodes(nodes: LayoutNode[]): SgdNode[] {
  return nodes.map((node) => ({
    id: node.id,
    x: node.x,
    y: node.y,
  }));
}

/**
 * Convert SgdNode array back to LayoutNode array.
 */
function toLayoutNodes(nodes: SgdNode[]): LayoutNode[] {
  return nodes.map((node) => ({
    id: node.id,
    x: node.x,
    y: node.y,
  }));
}

/** Extended layout options with progress callback */
export interface RunLayoutOptions extends LayoutOptions {
  /** Progress callback (optional). Return false to cancel. */
  onProgress?: ProgressCallback;
}

/**
 * Run SGD-based force layout on a weighted edge graph.
 *
 * Uses UMAP's attractive/repulsive force model with:
 * - Adaptive learning rate scheduling
 * - Front-loaded alpha for initial mixing
 * - Negative sampling for efficient repulsion
 *
 * @param nodes - Array of nodes with initial positions
 * @param edges - Weighted edges from buildGraph()
 * @param options - Layout algorithm options
 * @returns Promise resolving to final node positions
 */
export async function runLayout(
  nodes: LayoutNode[],
  edges: WeightedEdge[],
  options: RunLayoutOptions = {}
): Promise<LayoutNode[]> {
  if (!nodes?.length) {
    return [];
  }

  // Convert to internal format
  const sgdNodes = toSgdNodes(nodes);

  // Prepare edges with indices
  const preparedEdges = prepareEdgeList(sgdNodes, edges);
  if (preparedEdges.length === 0) {
    return toLayoutNodes(sgdNodes);
  }

  // Get layout parameters
  const minDist = options.minDist ?? 0.1;
  const spread = options.spread ?? 2.0;
  const progressInterval = options.progressInterval ?? DEFAULT_FRAME_MS;
  const skipInitialUpdates = options.skipInitialUpdates ?? 10;
  const renderSampleRate = options.renderSampleRate ?? DEFAULT_RENDER_SAMPLE_RATE;

  // Calculate epoch settings
  const epochSettings = calculateEpochSettings(sgdNodes.length, spread, options);
  const { totalEpochs, initialAlpha, finalAlpha, negativeSampleRate, repulsionStrength } =
    epochSettings;

  // Calculate UMAP curve parameters
  const ab = findABParams(spread, minDist);

  // Calculate adaptive sampling ratios
  const repulsionEdgeSample = clampRepulsionEdgeSample(
    calculateRepulsionEdgeSample(sgdNodes.length)
  );
  const fullCoverageRatio = calculateFullCoverageRatio(sgdNodes.length);

  // Cancellation flag
  let cancelled = false;

  // Progress tracking
  let lastMessageTime = Date.now();
  let updateCount = 0;

  // Main SGD loop
  for (let epoch = 0; epoch < totalEpochs; epoch++) {
    if (cancelled) break;

    const isFinalEpoch = epoch === totalEpochs - 1;
    const progressRatio = totalEpochs <= 1 ? 1 : epoch / (totalEpochs - 1);
    const currentAlpha = computeFrontLoadedAlpha(progressRatio, initialAlpha, finalAlpha);

    // Apply attractive forces
    for (let i = 0; i < preparedEdges.length; i++) {
      const edge = preparedEdges[i];
      applyAttractiveUpdate(sgdNodes, edge, currentAlpha, ab, { minDist });
    }

    // Apply repulsive forces (negative sampling)
    if (sgdNodes.length > 1) {
      const currentSampleRatio = progressRatio < fullCoverageRatio ? 1.0 : repulsionEdgeSample;
      const stride =
        currentSampleRatio >= 0.999 ? 1 : Math.max(1, Math.round(1 / currentSampleRatio));
      const offset = stride === 1 ? 0 : epoch % stride;

      for (let i = offset; i < preparedEdges.length; i += stride) {
        const edge = preparedEdges[i];
        for (let n = 0; n < negativeSampleRate; n++) {
          const randomIndex = Math.floor(Math.random() * sgdNodes.length);
          if (randomIndex === edge.sourceIndex || randomIndex === edge.targetIndex) continue;
          applyRepulsiveUpdate(
            sgdNodes,
            edge.sourceIndex,
            randomIndex,
            currentAlpha,
            ab,
            repulsionStrength
          );
        }
      }
    }

    // Progress callback
    const now = Date.now();
    if ((now - lastMessageTime > progressInterval || isFinalEpoch) && options.onProgress) {
      lastMessageTime = now;
      updateCount++;

      if (updateCount > skipInitialUpdates || isFinalEpoch) {
        const sampleIndex = Math.max(0, updateCount - skipInitialUpdates - 1);
        const shouldRender =
          isFinalEpoch || renderSampleRate <= 1 || sampleIndex % renderSampleRate === 0;

        if (shouldRender) {
          const progressData: LayoutProgress = {
            progress: Math.round(progressRatio * 100),
            epoch: epoch + 1,
            alpha: currentAlpha,
            isIntermediate: !isFinalEpoch,
            nodes: toLayoutNodes(sgdNodes),
          };

          const result = options.onProgress(progressData);
          if (result === false) {
            cancelled = true;
            break;
          }

          // Yield to event loop
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
    }

    // Periodic yield to prevent blocking
    if (epoch % YIELD_EVERY_EPOCHS === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return toLayoutNodes(sgdNodes);
}
