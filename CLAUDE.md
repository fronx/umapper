# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Build library (outputs to dist/)
npm run build

# Run tests
npm run test

# Run single test file
npx vitest run tests/basic.test.ts

# Run tests in watch mode
npm run test:watch

# Type check
npx tsc --noEmit

# Build and link for local development
npm run link:local
```

## Architecture

umapper is a zero-dependency TypeScript library that transforms k-NN (k-nearest neighbor) data into 2D positions using a UMAP-inspired algorithm.

### Module Structure

**`src/graph/`** - Graph construction from k-NN data
- `calculate-k.ts` - Auto-calculate effective neighbor count based on dataset size
- `edge-builder.ts` - Convert neighbor lists to weighted directed edges with sigma calibration
- `symmetrize.ts` - Combine directed edges into undirected (fuzzy-union, product, geometric)
- `weight-scaling.ts` - Apply exponential kernel to normalize distances
- `find-ab-params.ts` - Compute UMAP curve parameters (a, b) from minDist/spread

**`src/layout/`** - SGD force-directed layout
- `sgd-layout.ts` - Main layout loop with edge sampling and progress callbacks
- `forces.ts` - Attractive/repulsive force calculations using UMAP kernel gradient
- `adaptive.ts` - Auto-tune learning rates, sampling rates based on graph size

**`src/types.ts`** - All TypeScript interfaces and types

### Data Flow

```
KnnGraph (Map<id, Neighbor[]>)
    ↓ buildGraph()
    ↓   1. calculateK() - determine effective neighbors
    ↓   2. neighborhoodsToEdges() - sigma calibration + exponential decay
    ↓   3. symmetrizeEdges() - combine bidirectional edges
WeightedEdge[]
    ↓ runLayout()
    ↓   1. findABParams() - compute UMAP curve params
    ↓   2. SGD loop: attractive + repulsive forces
    ↓   3. Progress callbacks with cancellation support
LayoutNode[] (final positions)
```

### Key Concepts

- **Sigma calibration**: Binary search to find per-point sigma that achieves target effective neighbors (log2(k))
- **Fuzzy union**: Default symmetrization combining weights as `a + b - a*b`
- **Front-loaded alpha**: Learning rate schedule that applies most movement early for faster convergence
- **Negative sampling**: Repulsive forces applied to random non-neighbor pairs each epoch
