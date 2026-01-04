import { describe, it, expect } from 'vitest';
import {
  buildGraph,
  runLayout,
  umapLayout,
  calculateK,
  findABParams,
  applyWeightSpaceScaling,
  symmetrizeEdges,
} from '../src';

describe('calculateK', () => {
  it('returns small k for small datasets', () => {
    // Sigmoid curve starts at ~2, reaches ~6 at 10 nodes
    expect(calculateK(10)).toBeLessThanOrEqual(10);
  });

  it('returns larger k for larger datasets', () => {
    expect(calculateK(5000)).toBeGreaterThan(20);
  });

  it('caps at maximum for very large datasets', () => {
    expect(calculateK(100000)).toBeLessThanOrEqual(26);
  });
});

describe('findABParams', () => {
  it('returns reasonable a and b values', () => {
    const { a, b } = findABParams(1.0, 0.1);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(0);
  });

  it('adjusts for different spread values', () => {
    const params1 = findABParams(0.5, 0.1);
    const params2 = findABParams(2.0, 0.1);
    // Different spreads should produce different parameters
    expect(params1.a !== params2.a || params1.b !== params2.b).toBe(true);
  });
});

describe('applyWeightSpaceScaling', () => {
  it('assigns highest weight to nearest neighbor', () => {
    const neighbors = [
      { id: 'a', distance: 0.1 },
      { id: 'b', distance: 0.5 },
      { id: 'c', distance: 1.0 },
    ];
    const scaled = applyWeightSpaceScaling(neighbors, 3);

    expect(scaled[0].weight).toBe(1.0); // Nearest gets weight 1.0
    expect(scaled[1].weight).toBeLessThan(1.0);
    expect(scaled[2].weight).toBeLessThan(scaled[1].weight);
  });

  it('returns empty array for empty input', () => {
    expect(applyWeightSpaceScaling([], 3)).toEqual([]);
  });
});

describe('symmetrizeEdges', () => {
  it('combines directed edges using fuzzy union', () => {
    const directed = [
      { source: 'a', target: 'b', strength: 0.8 },
      { source: 'b', target: 'a', strength: 0.6 },
    ];
    const symmetric = symmetrizeEdges(directed, 'fuzzy-union');

    expect(symmetric).toHaveLength(1);
    // Fuzzy union: 0.8 + 0.6 - 0.8*0.6 = 0.92
    expect(symmetric[0].strength).toBeCloseTo(0.92);
  });

  it('combines using product mode', () => {
    const directed = [
      { source: 'a', target: 'b', strength: 0.8 },
      { source: 'b', target: 'a', strength: 0.6 },
    ];
    const symmetric = symmetrizeEdges(directed, 'product');

    expect(symmetric).toHaveLength(1);
    // Product: 0.8 * 0.6 = 0.48
    expect(symmetric[0].strength).toBeCloseTo(0.48);
  });

  it('combines using geometric mode', () => {
    const directed = [
      { source: 'a', target: 'b', strength: 0.8 },
      { source: 'b', target: 'a', strength: 0.6 },
    ];
    const symmetric = symmetrizeEdges(directed, 'geometric');

    expect(symmetric).toHaveLength(1);
    // Geometric: sqrt(0.8 * 0.6) ≈ 0.693
    expect(symmetric[0].strength).toBeCloseTo(Math.sqrt(0.48));
  });
});

describe('buildGraph', () => {
  it('creates edges from k-NN data', () => {
    const knn = new Map([
      ['a', [{ id: 'b', distance: 0.1 }, { id: 'c', distance: 0.2 }]],
      ['b', [{ id: 'a', distance: 0.1 }, { id: 'c', distance: 0.3 }]],
      ['c', [{ id: 'a', distance: 0.2 }, { id: 'b', distance: 0.3 }]],
    ]);

    const edges = buildGraph(knn);

    // Should have 3 symmetric edges (a-b, a-c, b-c)
    expect(edges).toHaveLength(3);
    expect(edges.every((e) => e.strength > 0)).toBe(true);
  });

  it('returns empty array for empty input', () => {
    expect(buildGraph(new Map())).toEqual([]);
  });
});

describe('runLayout', () => {
  it('returns positioned nodes', async () => {
    const nodes = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 0, y: 0 },
      { id: 'c', x: 0, y: 0 },
    ];
    const edges = [
      { source: 'a', target: 'b', strength: 0.9 },
      { source: 'b', target: 'c', strength: 0.9 },
      { source: 'a', target: 'c', strength: 0.1 },
    ];

    const result = await runLayout(nodes, edges, { epochs: 50 });

    expect(result).toHaveLength(3);
    // Nodes should have moved from origin
    const moved = result.some((n) => n.x !== 0 || n.y !== 0);
    expect(moved).toBe(true);
  });

  it('calls progress callback', async () => {
    const nodes = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 10, y: 10 },
    ];
    const edges = [{ source: 'a', target: 'b', strength: 0.5 }];

    const progressCalls: number[] = [];
    await runLayout(nodes, edges, {
      epochs: 30,
      skipInitialUpdates: 0,
      onProgress: (p) => {
        progressCalls.push(p.progress);
      },
    });

    expect(progressCalls.length).toBeGreaterThan(0);
  });

  it('can be cancelled via callback', async () => {
    const nodes = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 10, y: 10 },
    ];
    const edges = [{ source: 'a', target: 'b', strength: 0.5 }];

    let callCount = 0;
    await runLayout(nodes, edges, {
      epochs: 1000,
      skipInitialUpdates: 0,
      progressInterval: 1,
      onProgress: () => {
        callCount++;
        if (callCount >= 3) return false; // Cancel
      },
    });

    expect(callCount).toBe(3);
  });
});

describe('umapLayout', () => {
  it('runs complete pipeline from k-NN to positions', async () => {
    const knn = new Map([
      ['a', [{ id: 'b', distance: 0.1 }, { id: 'c', distance: 0.5 }]],
      ['b', [{ id: 'a', distance: 0.1 }, { id: 'c', distance: 0.4 }]],
      ['c', [{ id: 'b', distance: 0.4 }, { id: 'a', distance: 0.5 }]],
    ]);

    const result = await umapLayout(knn, { epochs: 30 });

    expect(result).toHaveLength(3);
    expect(result.map((n) => n.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('accepts object format k-NN', async () => {
    const knn = {
      a: [{ id: 'b', distance: 0.1 }],
      b: [{ id: 'a', distance: 0.1 }],
    };

    const result = await umapLayout(knn, { epochs: 20 });

    expect(result).toHaveLength(2);
  });

  it('strongly connected nodes end up closer together', async () => {
    // a-b are strongly connected, c is weakly connected
    // Using very extreme distance differences to ensure topology emerges
    const knn = new Map([
      ['a', [{ id: 'b', distance: 0.01 }, { id: 'c', distance: 1.0 }]],
      ['b', [{ id: 'a', distance: 0.01 }, { id: 'c', distance: 1.0 }]],
      ['c', [{ id: 'a', distance: 1.0 }, { id: 'b', distance: 1.0 }]],
    ]);

    // Run multiple times and check that on average the topology is preserved
    // This accounts for random initialization
    let passCount = 0;
    const trials = 5;

    for (let i = 0; i < trials; i++) {
      const result = await umapLayout(knn, { epochs: 200, spread: 2.0 });

      const nodeMap = new Map(result.map((n) => [n.id, n]));
      const a = nodeMap.get('a')!;
      const b = nodeMap.get('b')!;
      const c = nodeMap.get('c')!;

      const distAB = Math.hypot(a.x - b.x, a.y - b.y);
      const distAC = Math.hypot(a.x - c.x, a.y - c.y);

      // a and b should be closer to each other than to c
      if (distAB < distAC) {
        passCount++;
      }
    }

    // Should pass majority of trials
    expect(passCount).toBeGreaterThanOrEqual(3);
  });
});
