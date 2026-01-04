/** A single neighbor with ID and distance */
export interface Neighbor {
  id: string;
  distance: number;
}

/** k-NN input: mapping from point ID to sorted neighbor list */
export type KnnGraph = Map<string, Neighbor[]>;

/** Alternative object format for k-NN (easier serialization) */
export type KnnGraphObject = Record<string, Neighbor[]>;

/** A point with 2D position */
export interface LayoutNode {
  id: string;
  x: number;
  y: number;
}

/** Edge with combined strength after symmetrization */
export interface WeightedEdge {
  source: string;
  target: string;
  strength: number;
}

/** Symmetrization mode for edge combination */
export type SymmetryMode = 'fuzzy-union' | 'product' | 'geometric';

/** Graph construction options */
export interface GraphOptions {
  /** Number of effective neighbors for sigma calibration (default: auto-calculated) */
  k?: number | ((datasetSize: number) => number);

  /** Symmetrization mode (default: 'fuzzy-union') */
  symmetryMode?: SymmetryMode;
}

/** Layout algorithm options */
export interface LayoutOptions {
  /** Minimum distance between embedded points (default: 0.1) */
  minDist?: number;

  /** Scale of embedded points (default: 2.0) */
  spread?: number;

  /** Total optimization epochs (default: 300) */
  epochs?: number;

  /** Initial learning rate (default: auto-calculated based on node count) */
  initialAlpha?: number;

  /** Final learning rate (default: auto-calculated) */
  finalAlpha?: number;

  /** Negative sampling rate for repulsion (default: auto-calculated) */
  negativeSampleRate?: number;

  /** Repulsion strength multiplier (default: spread value) */
  repulsionStrength?: number;

  /** Minimum ms between progress callbacks (default: 32) */
  progressInterval?: number;

  /** Skip initial N updates before reporting (default: 10) */
  skipInitialUpdates?: number;

  /** Render every Nth update after warmup (default: 2) */
  renderSampleRate?: number;
}

/** Progress callback data */
export interface LayoutProgress {
  /** Percentage complete (0-100) */
  progress: number;

  /** Current epoch number */
  epoch: number;

  /** Current learning rate */
  alpha: number;

  /** Whether this is an intermediate update */
  isIntermediate: boolean;

  /** Current node positions */
  nodes: LayoutNode[];
}

/** Callback for layout progress updates. Return false to cancel. */
export type ProgressCallback = (progress: LayoutProgress) => void | boolean;

/** Options for the combined layout function */
export interface UmapLayoutOptions extends GraphOptions, LayoutOptions {
  /** Initial positions for nodes (optional, for warm starts) */
  initialPositions?: LayoutNode[];

  /** Progress callback (optional) */
  onProgress?: ProgressCallback;
}

/** Internal node with velocity for SGD */
export interface SgdNode extends LayoutNode {
  vx?: number;
  vy?: number;
}

/** Prepared edge with indices for fast lookup */
export interface PreparedEdge {
  sourceIndex: number;
  targetIndex: number;
  weight: number;
}

/** UMAP curve parameters */
export interface ABParams {
  a: number;
  b: number;
}
