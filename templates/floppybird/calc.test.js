import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCELERATORS,
  computeModelFlops,
  formatSci,
  flopEmoji,
  computeChipsNeeded,
  computeResults,
  STORAGE_KEY,
  SAVED_LIST_KEY,
  saveState,
  loadState,
  loadSavedCalcs,
  saveCalcToList,
  deleteCalcFromList,
  togglePinCalc,
  getSortedCalcs,
  calcDisplayName,
} from './calc.js';

// ─── FLOP Calculation ──────────────────────────────────────────────

describe('computeModelFlops', () => {
  it('MoE: 6 × activeParams × tokens', () => {
    assert.equal(computeModelFlops('moe', { activeParams: 8e9, tokens: 1e12 }), 4.8e22);
  });

  it('Dense: 6 × totalParams × tokens', () => {
    assert.equal(computeModelFlops('dense', { totalParams: 70e9, tokens: 2e12 }), 8.4e23);
  });

  it('FLOP: passthrough', () => {
    assert.equal(computeModelFlops('flop', { flops: 1e25 }), 1e25);
  });

  it('throws on unknown type', () => {
    assert.throws(() => computeModelFlops('unknown', {}), /Unknown calculator type/);
  });
});

// ─── Formatting ────────────────────────────────────────────────────

describe('formatSci', () => {
  it('formats 4.8e22', () => {
    assert.equal(formatSci(4.8e22), '4.80 × 10^22');
  });

  it('formats 1.23e15', () => {
    assert.equal(formatSci(1.23e15), '1.23 × 10^15');
  });

  it('formats zero', () => {
    assert.equal(formatSci(0), '0');
  });
});

describe('flopEmoji', () => {
  it('😱 at 10^28', () => assert.equal(flopEmoji(1e28), '😱'));
  it('😱 above 10^28', () => assert.equal(flopEmoji(5e29), '😱'));
  it('🤔 at 10^22', () => assert.equal(flopEmoji(1e22), '🤔'));
  it('🤔 below 10^22', () => assert.equal(flopEmoji(1e20), '🤔'));
  it('empty in between', () => assert.equal(flopEmoji(1e25), ''));
});

// ─── Core: Chip Calculation with Scaling Penalty ───────────────────

describe('computeChipsNeeded', () => {
  it('no scaling penalty when training fits in a fraction of one pod', () => {
    // Dense 8B, 1T tokens → 4.8e22 FLOPs on v5p, 4 weeks
    // effective = 4.59e14 * 0.6 = 2.754e14; duration = 2419200s
    // chips = 4.8e22 / (2.754e14 * 2419200) ≈ 72.04 → 73
    // 73 chips / 8960 chips_per_pod < 1 pod → no penalty
    const result = computeChipsNeeded(4.8e22, ACCELERATORS.v5p, 0.6, 0.94, 2419200);
    assert.equal(result.chips, 73);
    assert.equal(result.pods, 1);
    assert.ok(Math.abs(result.penalty - 1) < 1e-10);
  });

  it('applies scaling penalty when multiple pods needed', () => {
    // 3.6e25 FLOPs on v6e (256 chips/pod, sf=0.7, mfu=0.35), 4 weeks
    // Naive estimate ~46k chips → ~181 pods → heavy penalty → millions of chips
    const result = computeChipsNeeded(3.6e25, ACCELERATORS.v6e, 0.35, 0.7, 2419200);
    assert.ok(result.chips > 100_000, `Expected > 100k chips, got ${result.chips}`);
    assert.ok(result.penalty < 0.01, `Expected penalty < 0.01, got ${result.penalty}`);
    assert.ok(result.pods > 1);
  });

  it('converged result delivers enough FLOPs (round-trip check)', () => {
    const flops = 3.6e25;
    const accel = ACCELERATORS.v6e;
    const mfu = 0.35;
    const duration = 2419200;
    const result = computeChipsNeeded(flops, accel, mfu, 0.7, duration);

    const delivered = result.chips * accel.bf16Flops * mfu * result.penalty * duration;
    assert.ok(delivered >= flops * 0.99, `Delivered ${delivered} < required ${flops}`);
  });

  it('GPU: no pods field, per-chip scaling penalty', () => {
    const result = computeChipsNeeded(1e24, ACCELERATORS.A100, 0.35, 0.9, 604800);
    assert.equal(result.pods, null);
    assert.ok(result.chips > 0);
    assert.ok(result.penalty < 1);
  });

  it('tiny FLOPs needing 1 chip → no penalty for GPU', () => {
    // H100: effective = 9.89e14 * 0.35 = 3.46e14; 1 week → 2.09e20 per chip
    // 1e20 FLOPs → need < 1 chip → ceil to 1 → penalty = 0.9^log2(1) = 1
    const result = computeChipsNeeded(1e20, ACCELERATORS.H100, 0.35, 0.9, 604800);
    assert.equal(result.chips, 1);
    assert.ok(result.penalty >= 0.99);
  });

  it('v5p with good scaling factor converges near naive estimate', () => {
    // v5p has sf=0.94 and large pods (8960). Moderate workload that needs ~2 pods
    // should have only modest penalty.
    const accel = ACCELERATORS.v5p;
    const flops = 1e25; // big but not huge
    const naive = flops / (accel.bf16Flops * 0.6 * 604800); // ~60k chips, ~7 pods
    const result = computeChipsNeeded(flops, accel, 0.6, 0.94, 604800);

    // With sf=0.94 and ~3 doublings, penalty ≈ 0.94^3 ≈ 0.83
    // So chips should be ~20% more than naive, not orders of magnitude more
    assert.ok(result.chips < naive * 2, `Expected < 2× naive, got ${result.chips} vs naive ${Math.ceil(naive)}`);
    assert.ok(result.chips > naive, `Expected > naive, got ${result.chips}`);
  });
});

// ─── Full Results ──────────────────────────────────────────────────

describe('computeResults', () => {
  it('returns 4 default time periods', () => {
    const result = computeResults(4.8e22, 'v5p');
    assert.equal(result.perPeriod.length, 4);
    assert.deepEqual(
      result.perPeriod.map((p) => p.label),
      ['1 day', '1 week', '4 weeks', '8 weeks'],
    );
  });

  it('includes custom days when specified', () => {
    const result = computeResults(4.8e22, 'v5p', { customDays: 10 });
    assert.equal(result.perPeriod.length, 5);
    assert.equal(result.perPeriod[4].label, '10 days');
  });

  it('more time → fewer chips', () => {
    const result = computeResults(1e24, 'v5p');
    for (let i = 1; i < result.perPeriod.length; i++) {
      assert.ok(
        result.perPeriod[i].chips <= result.perPeriod[i - 1].chips,
        `${result.perPeriod[i].label} needs more chips than ${result.perPeriod[i - 1].label}`,
      );
    }
  });

  it('totalHardwareFlops = modelFlops / MFU', () => {
    const flops = 1e24;
    const result = computeResults(flops, 'v6e');
    const expected = flops / ACCELERATORS.v6e.defaultMfu;
    assert.ok(Math.abs(result.totalHardwareFlops - expected) / expected < 1e-10);
  });

  it('cost = chips × hours × $/chip/hr', () => {
    const result = computeResults(4.8e22, 'v5p');
    const fourWeeks = result.perPeriod.find((p) => p.label === '4 weeks');
    assert.equal(fourWeeks.chips, 73);
    const expectedCost = 73 * (2419200 / 3600) * 3.5;
    assert.ok(Math.abs(fourWeeks.cost - expectedCost) < 0.01);
  });

  it('respects MFU override', () => {
    const high = computeResults(1e24, 'A100', { mfu: 0.5 });
    const low = computeResults(1e24, 'A100', { mfu: 0.2 });
    assert.ok(high.perPeriod[0].chips < low.perPeriod[0].chips);
  });

  it('throws on unknown accelerator', () => {
    assert.throws(() => computeResults(1e24, 'unknown'), /Unknown accelerator/);
  });

  it('TPU rows have pods, GPU rows do not', () => {
    const tpu = computeResults(1e24, 'v5p');
    const gpu = computeResults(1e24, 'A100');
    assert.ok(tpu.perPeriod[0].pods !== null);
    assert.equal(gpu.perPeriod[0].pods, null);
  });
});

// ─── Phase 7: Persistence ──────────────────────────────────────────

// Minimal localStorage mock for Node tests
function makeMockStorage() {
  const store = {};
  return {
    getItem(k) { return store[k] ?? null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; },
    _store: store,
  };
}

describe('saveState / loadState', () => {
  it('round-trips state through localStorage', () => {
    const storage = makeMockStorage();
    const state = {
      calcType: 'dense',
      activeParams: '',
      totalParams: '70e9',
      tokens: '2e12',
      flops: '',
      modelName: 'My Model',
      overrides: { v5p: { mfu: 0.5 } },
      visible: { A100: true, H100: false, H200: false, B200: false, v4p: true, v5e: false, v5p: true, v6e: true },
    };
    saveState(state, storage);
    const loaded = loadState(storage);
    assert.deepEqual(loaded, state);
  });

  it('loadState returns null when nothing saved', () => {
    const storage = makeMockStorage();
    assert.equal(loadState(storage), null);
  });

  it('loadState returns null for corrupted JSON', () => {
    const storage = makeMockStorage();
    storage.setItem(STORAGE_KEY, '{not valid json!!!');
    assert.equal(loadState(storage), null);
  });

  it('loadState returns null for non-object values', () => {
    const storage = makeMockStorage();
    storage.setItem(STORAGE_KEY, '"just a string"');
    assert.equal(loadState(storage), null);
  });

  it('saveState overwrites previous state', () => {
    const storage = makeMockStorage();
    saveState({ calcType: 'moe', activeParams: '8e9', totalParams: '', tokens: '1e12', flops: '', modelName: '', overrides: {}, visible: {} }, storage);
    saveState({ calcType: 'flop', activeParams: '', totalParams: '', tokens: '', flops: '1e25', modelName: 'Test', overrides: {}, visible: {} }, storage);
    const loaded = loadState(storage);
    assert.equal(loaded.calcType, 'flop');
    assert.equal(loaded.flops, '1e25');
  });
});

// ─── Saved Calcs List ───────────────────────────────────────────────

describe('loadSavedCalcs', () => {
  it('returns empty array when nothing saved', () => {
    const storage = makeMockStorage();
    assert.deepEqual(loadSavedCalcs(storage), []);
  });

  it('returns empty array for corrupted JSON', () => {
    const storage = makeMockStorage();
    storage.setItem(SAVED_LIST_KEY, '{bad json');
    assert.deepEqual(loadSavedCalcs(storage), []);
  });

  it('returns empty array for non-array value', () => {
    const storage = makeMockStorage();
    storage.setItem(SAVED_LIST_KEY, '"string"');
    assert.deepEqual(loadSavedCalcs(storage), []);
  });
});

describe('saveCalcToList', () => {
  it('adds a calc entry with id, savedAt, pinned=false, and state', () => {
    const storage = makeMockStorage();
    const state = { calcType: 'moe', activeParams: '8e9', tokens: '1e12', modelName: 'Test' };
    const entry = saveCalcToList(state, storage);
    assert.ok(entry.id, 'should have an id');
    assert.ok(entry.savedAt > 0, 'should have a savedAt timestamp');
    assert.equal(entry.pinned, false);
    assert.deepEqual(entry.state, state);
  });

  it('prepends new entries (newest first)', () => {
    const storage = makeMockStorage();
    saveCalcToList({ calcType: 'moe', modelName: 'First' }, storage);
    saveCalcToList({ calcType: 'dense', modelName: 'Second' }, storage);
    const list = loadSavedCalcs(storage);
    assert.equal(list.length, 2);
    assert.equal(list[0].state.modelName, 'Second');
    assert.equal(list[1].state.modelName, 'First');
  });
});

describe('deleteCalcFromList', () => {
  it('removes entry by id', () => {
    const storage = makeMockStorage();
    const e1 = saveCalcToList({ modelName: 'A' }, storage);
    const e2 = saveCalcToList({ modelName: 'B' }, storage);
    const remaining = deleteCalcFromList(e2.id, storage);
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, e1.id);
  });

  it('no-op when id not found', () => {
    const storage = makeMockStorage();
    saveCalcToList({ modelName: 'A' }, storage);
    const remaining = deleteCalcFromList('nonexistent', storage);
    assert.equal(remaining.length, 1);
  });
});

describe('togglePinCalc', () => {
  it('pins an unpinned calc', () => {
    const storage = makeMockStorage();
    const entry = saveCalcToList({ modelName: 'A' }, storage);
    togglePinCalc(entry.id, storage);
    const list = loadSavedCalcs(storage);
    assert.equal(list[0].pinned, true);
  });

  it('unpins a pinned calc', () => {
    const storage = makeMockStorage();
    const entry = saveCalcToList({ modelName: 'A' }, storage);
    togglePinCalc(entry.id, storage);
    togglePinCalc(entry.id, storage);
    const list = loadSavedCalcs(storage);
    assert.equal(list[0].pinned, false);
  });
});

describe('getSortedCalcs', () => {
  it('pinned calcs come first, then unpinned, both newest-first', () => {
    const list = [
      { id: '1', savedAt: 100, pinned: false },
      { id: '2', savedAt: 200, pinned: true },
      { id: '3', savedAt: 300, pinned: false },
      { id: '4', savedAt: 150, pinned: true },
    ];
    const sorted = getSortedCalcs(list);
    assert.deepEqual(sorted.map(c => c.id), ['2', '4', '3', '1']);
  });
});

describe('calcDisplayName', () => {
  it('uses modelName when present', () => {
    assert.equal(calcDisplayName({ modelName: 'My Model', calcType: 'moe' }), 'My Model');
  });

  it('auto-names MoE calc', () => {
    const name = calcDisplayName({ calcType: 'moe', activeParams: '8e9', tokens: '1e12', modelName: '' });
    assert.match(name, /MoE.*8B.*1T/);
  });

  it('auto-names Dense calc', () => {
    const name = calcDisplayName({ calcType: 'dense', totalParams: '70e9', tokens: '2e12', modelName: '' });
    assert.match(name, /Dense.*70B.*2T/);
  });

  it('auto-names FLOP calc', () => {
    const name = calcDisplayName({ calcType: 'flop', flops: '1e25', modelName: '' });
    assert.match(name, /10\^25.*FLOPs/);
  });

  it('returns Untitled calc when no data', () => {
    assert.equal(calcDisplayName({ calcType: 'moe', modelName: '' }), 'Untitled calc');
  });
});

// ─── Phase 8: CSV Export ─────────────────────────────────────────────

import { generateCSV } from './calc.js';

describe('generateCSV', () => {
  it('includes header row with accelerator columns', () => {
    const csv = generateCSV(['A100'], {}, null);
    const lines = csv.split('\n');
    assert.match(lines[0], /Accelerator/);
    assert.match(lines[0], /BF16 FLOP\/s/);
    assert.match(lines[0], /MFU/);
    assert.match(lines[0], /Scaling Factor/);
    assert.match(lines[0], /\$\/hr/);
  });

  it('includes one data row per visible accelerator', () => {
    const csv = generateCSV(['A100', 'v5p'], {}, null);
    const lines = csv.trim().split('\n');
    assert.equal(lines.length, 3); // header + 2 rows
    assert.match(lines[1], /A100/);
    assert.match(lines[2], /v5p/);
  });

  it('includes Chips/Pod column for TPU rows', () => {
    const csv = generateCSV(['v5p'], {}, null);
    const lines = csv.trim().split('\n');
    assert.match(lines[0], /Chips\/Pod/);
    assert.match(lines[1], /8960/);
  });

  it('shows dash for Chips/Pod on GPU rows', () => {
    const csv = generateCSV(['A100'], {}, null);
    const lines = csv.trim().split('\n');
    // A100 has no chipsPerPod
    assert.match(lines[1], /—/);
  });

  it('uses overrides when provided', () => {
    const csv = generateCSV(['v5p'], { v5p: { mfu: 0.5 } }, null);
    const lines = csv.trim().split('\n');
    assert.match(lines[1], /0\.5/);
  });

  it('includes result columns when modelFlops provided', () => {
    const csv = generateCSV(['v5p'], {}, 4.8e22);
    const header = csv.split('\n')[0];
    assert.match(header, /HW FLOPs/);
    assert.match(header, /1 day/);
    assert.match(header, /1 week/);
    assert.match(header, /4 weeks/);
    assert.match(header, /8 weeks/);
  });

  it('result columns include chip counts', () => {
    const csv = generateCSV(['v5p'], {}, 4.8e22);
    const dataRow = csv.trim().split('\n')[1];
    // v5p at 4 weeks = 73 chips
    assert.match(dataRow, /73/);
  });

  it('includes pods for TPU rows in results', () => {
    const csv = generateCSV(['v5p'], {}, 4.8e22);
    const dataRow = csv.trim().split('\n')[1];
    // 73 chips / 8960 chips per pod = 1 pod
    assert.match(dataRow, /1 pod/);
  });

  it('includes custom days columns when customDays provided', () => {
    const csv = generateCSV(['v5p'], {}, 4.8e22, 10);
    const header = csv.split('\n')[0];
    assert.match(header, /10 days chips/);
    assert.match(header, /10 days pods/);
  });

  it('no result columns when modelFlops is null', () => {
    const csv = generateCSV(['A100'], {}, null);
    const header = csv.split('\n')[0];
    assert.doesNotMatch(header, /HW FLOPs/);
    assert.doesNotMatch(header, /1 day/);
  });

  it('quotes fields that contain commas', () => {
    // Chip counts with commas (e.g. 1,234) should be quoted
    const csv = generateCSV(['A100'], {}, 1e25);
    // Large FLOP count should produce chip counts > 999
    const dataRow = csv.trim().split('\n')[1];
    // Check that fields with commas are quoted
    const fields = dataRow.match(/"[^"]*,\d+[^"]*"/);
    assert.ok(fields, 'Fields with commas should be quoted');
  });
});
