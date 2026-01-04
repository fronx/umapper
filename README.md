# umapper

UMAP-inspired layout algorithm for k-NN graphs. Transform pre-computed k-nearest neighbor data into 2D positions suitable for visualization.

## Features

- **Zero dependencies** - Pure TypeScript, works anywhere
- **Pre-computed k-NN input** - Bring your own neighbor data from any source
- **UMAP-style graph construction** - Sigma calibration, exponential kernel, fuzzy union
- **SGD force-directed layout** - Adaptive learning rates, negative sampling
- **Progress callbacks** - Stream intermediate positions during computation
- **Cancellation support** - Stop layout early by returning `false` from callback

## Installation

```bash
npm install umapper
```

## Quick Start

```typescript
import { umapLayout } from 'umapper';

// k-NN data: Map from point ID to sorted neighbors
const knn = new Map([
  ['point1', [{ id: 'point2', distance: 0.1 }, { id: 'point3', distance: 0.2 }]],
  ['point2', [{ id: 'point1', distance: 0.1 }, { id: 'point3', distance: 0.15 }]],
  ['point3', [{ id: 'point2', distance: 0.15 }, { id: 'point1', distance: 0.2 }]],
]);

// Run layout
const positions = await umapLayout(knn, {
  minDist: 0.1,    // Minimum separation
  spread: 1.5,     // Overall scale
  epochs: 200,     // Optimization iterations
  onProgress: ({ progress, nodes }) => {
    console.log(`${progress}% complete`);
    renderToCanvas(nodes);  // Visualize intermediate state
  }
});

// positions: [{ id: 'point1', x: 12.3, y: 45.6 }, ...]
```

## API

### `umapLayout(knn, options?)`

Combined function that builds the graph and runs layout in one call.

```typescript
function umapLayout(
  knn: KnnGraph | KnnGraphObject,
  options?: UmapLayoutOptions
): Promise<LayoutNode[]>
```

### `buildGraph(knn, options?)`

Build weighted edges from k-NN data using UMAP's fuzzy simplicial set approach.

```typescript
function buildGraph(
  knn: KnnGraph,
  options?: GraphOptions
): WeightedEdge[]
```

Options:
- `k` - Number of effective neighbors (default: auto-calculated from dataset size)
- `symmetryMode` - Edge combination: `'fuzzy-union'` | `'product'` | `'geometric'`

### `runLayout(nodes, edges, options?)`

Run SGD force-directed layout on a weighted graph.

```typescript
function runLayout(
  nodes: LayoutNode[],
  edges: WeightedEdge[],
  options?: LayoutOptions
): Promise<LayoutNode[]>
```

Options:
- `minDist` - Minimum distance between points (default: 0.1)
- `spread` - Scale of embedded points (default: 2.0)
- `epochs` - Number of optimization iterations (default: 300)
- `initialAlpha` - Starting learning rate (default: auto)
- `onProgress` - Callback for intermediate results

## Advanced Usage

### Separate Graph + Layout Steps

```typescript
import { buildGraph, runLayout } from 'umapper';

// Build graph with custom symmetrization
const edges = buildGraph(knn, { symmetryMode: 'geometric' });

// Provide custom initial positions
const nodes = Array.from(knn.keys()).map(id => ({
  id,
  x: myInitialX(id),
  y: myInitialY(id)
}));

// Run layout with fine-grained control
const positions = await runLayout(nodes, edges, {
  epochs: 500,
  minDist: 0.2,
  onProgress: (p) => {
    if (userCancelled) return false;  // Cancel layout
    updateVisualization(p.nodes);
  }
});
```

### Object Format k-NN

```typescript
// Also accepts plain object format (easier for JSON serialization)
const knn = {
  'point1': [{ id: 'point2', distance: 0.1 }],
  'point2': [{ id: 'point1', distance: 0.1 }],
};

const positions = await umapLayout(knn);
```

## Types

```typescript
interface Neighbor {
  id: string;
  distance: number;
}

type KnnGraph = Map<string, Neighbor[]>;

interface LayoutNode {
  id: string;
  x: number;
  y: number;
}

interface WeightedEdge {
  source: string;
  target: string;
  strength: number;
}

interface LayoutProgress {
  progress: number;      // 0-100
  epoch: number;
  alpha: number;
  isIntermediate: boolean;
  nodes: LayoutNode[];
}
```

## Algorithm Details

This implements a UMAP-inspired layout in JavaScript:

1. **Graph Construction**
   - Calibrate per-point sigma via binary search (target: log2(k) effective neighbors)
   - Apply exponential kernel: `weight = exp(-(d - rho) / sigma)`
   - Symmetrize with fuzzy union: `a + b - a*b`

2. **SGD Layout**
   - Attractive forces between connected nodes
   - Repulsive forces via negative sampling
   - Front-loaded alpha schedule for initial mixing
   - Adaptive parameters based on graph size

## Using with Electron

When using umapper in an Electron app during development:

### Local Development

Use `file:` protocol in package.json (not `npm link`):

```json
{
  "dependencies": {
    "umapper": "file:../path/to/umapper"
  }
}
```

### Renderer vs Main Process

umapper works best when imported in the **renderer process** (bundled by Vite/webpack). If you need shared utilities like `calculateK` in the main process, keep a local copy rather than importing from umapper - this avoids ESM/CJS resolution issues with symlinked packages.

See [MusicMapper's local-npm-packages guide](https://github.com/fronx/musicmapper.electron/blob/main/docs/guides/local-npm-packages.md) for detailed patterns.

## License

MIT
