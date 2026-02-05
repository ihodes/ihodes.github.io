// ─── Persistence ────────────────────────────────────────────────────

export const STORAGE_KEY = 'floppybird_current';
export const SAVED_LIST_KEY = 'floppybird_saved';

export function saveState(state, storage = globalThis.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadState(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ─── Saved Calcs List ───────────────────────────────────────────────

export function loadSavedCalcs(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(SAVED_LIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function writeSavedCalcs(list, storage) {
  storage.setItem(SAVED_LIST_KEY, JSON.stringify(list));
}

export function saveCalcToList(state, storage = globalThis.localStorage) {
  const list = loadSavedCalcs(storage);
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    savedAt: Date.now(),
    pinned: false,
    state,
  };
  list.unshift(entry);
  writeSavedCalcs(list, storage);
  return entry;
}

export function deleteCalcFromList(id, storage = globalThis.localStorage) {
  const list = loadSavedCalcs(storage);
  const next = list.filter(c => c.id !== id);
  writeSavedCalcs(next, storage);
  return next;
}

export function togglePinCalc(id, storage = globalThis.localStorage) {
  const list = loadSavedCalcs(storage);
  const entry = list.find(c => c.id === id);
  if (entry) entry.pinned = !entry.pinned;
  writeSavedCalcs(list, storage);
  return list;
}

export function getSortedCalcs(list) {
  const pinned = list.filter(c => c.pinned).sort((a, b) => b.savedAt - a.savedAt);
  const unpinned = list.filter(c => !c.pinned).sort((a, b) => b.savedAt - a.savedAt);
  return [...pinned, ...unpinned];
}

export function calcDisplayName(state, savedAt = null) {
  let name;
  if (state.modelName) {
    name = state.modelName;
  } else {
    const pActive = state.activeParams ? parseFloat(state.activeParams) : null;
    const pTotal = state.totalParams ? parseFloat(state.totalParams) : null;
    const pTokens = state.tokens ? parseFloat(state.tokens) : null;
    const pFlops = state.flops ? parseFloat(state.flops) : null;
    if (state.calcType === 'moe' && pActive && pTokens) {
      name = `MoE ${formatCount(pActive)} active ${formatCount(pTokens)} tokens`;
    } else if (state.calcType === 'dense' && pTotal && pTokens) {
      name = `Dense ${formatCount(pTotal)} ${formatCount(pTokens)} tokens`;
    } else if (state.calcType === 'flop' && pFlops) {
      name = `${formatSci(pFlops)} FLOPs`;
    } else {
      name = 'Untitled calc';
    }
  }
  if (savedAt) {
    const d = new Date(savedAt);
    const pad = n => String(n).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(2);
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    name += ` (${yy}-${mm}-${dd} ${hh}:${min})`;
  }
  return name;
}

export function formatCount(n) {
  if (n >= 1e12) return `${+(n / 1e12).toPrecision(3)}T`;
  if (n >= 1e9) return `${+(n / 1e9).toPrecision(3)}B`;
  if (n >= 1e6) return `${+(n / 1e6).toPrecision(3)}M`;
  return n.toLocaleString();
}

// Accelerator database
// BF16 FLOP/s values from README; NVIDIA values (except B200) are reasonable estimates.
export const ACCELERATORS = {
  A2: {
    name: 'A2',
    vendor: 'nvidia',
    bf16Flops: 1.8e13,
    chipsPerPod: null,
    defaultMfu: 0.35,
    defaultScalingFactor: 0.99,
    defaultCostPerChipHour: 0,
  },
  A100: {
    name: 'A100',
    vendor: 'nvidia',
    bf16Flops: 3.12e14,
    chipsPerPod: null,
    defaultMfu: 0.35,
    defaultScalingFactor: 0.99,
    defaultCostPerChipHour: 1.80,
  },
  H100: {
    name: 'H100',
    vendor: 'nvidia',
    bf16Flops: 1.979e15,
    chipsPerPod: null,
    defaultMfu: 0.35,
    defaultScalingFactor: 0.99,
    defaultCostPerChipHour: 3.00,
  },
  H200: {
    name: 'H200',
    vendor: 'nvidia',
    bf16Flops: 1.979e15,
    chipsPerPod: null,
    defaultMfu: 0.35,
    defaultScalingFactor: 0.99,
    defaultCostPerChipHour: 6.30,
  },
  B100: {
    name: 'B100',
    vendor: 'nvidia',
    bf16Flops: 1.75e15,
    chipsPerPod: null,
    defaultMfu: 0.35,
    defaultScalingFactor: 0.99,
    defaultCostPerChipHour: 0,
  },
  B200: {
    name: 'B200',
    vendor: 'nvidia',
    bf16Flops: 2.25e15,
    chipsPerPod: null,
    defaultMfu: 0.35,
    defaultScalingFactor: 0.99,
    defaultCostPerChipHour: 4.99,
  },
  v4p: {
    name: 'v4p',
    vendor: 'google',
    bf16Flops: 2.75e14,
    chipsPerPod: 4096,
    defaultMfu: 0.5,
    defaultScalingFactor: 0.94,
    defaultCostPerChipHour: 3.22,
  },
  v5e: {
    name: 'v5e',
    vendor: 'google',
    bf16Flops: 1.97e14,
    chipsPerPod: 256,
    defaultMfu: 0.6,
    defaultScalingFactor: 0.94,
    defaultCostPerChipHour: 1.20,
  },
  v5p: {
    name: 'v5p',
    vendor: 'google',
    bf16Flops: 4.59e14,
    chipsPerPod: 8960,
    defaultMfu: 0.6,
    defaultScalingFactor: 0.94,
    defaultCostPerChipHour: 4.20,
  },
  v6e: {
    name: 'v6e',
    vendor: 'google',
    bf16Flops: 9.18e14,
    chipsPerPod: 256,
    defaultMfu: 0.35,
    defaultScalingFactor: 0.94,
    defaultCostPerChipHour: 2.70,
  },
};

export const DEFAULT_VISIBLE = ['A100', 'v4p', 'v5p', 'v6e'];

export const TIME_PERIODS = [
  { label: '1 day', seconds: 86400 },
  { label: '1 week', seconds: 604800 },
  { label: '4 weeks', seconds: 2419200 },
  { label: '8 weeks', seconds: 4838400 },
];

/**
 * Calculate model FLOPs based on calculator type.
 * MoE/Dense use 6 × P × T; FLOP is passthrough.
 */
export function computeModelFlops(type, params = {}) {
  switch (type) {
    case 'moe':
      return 6 * params.activeParams * params.tokens;
    case 'dense':
      return 6 * params.totalParams * params.tokens;
    case 'flop':
      return params.flops;
    default:
      throw new Error(`Unknown calculator type: ${type}`);
  }
}

/**
 * Format number as "x.yz × 10^n".
 */
export function formatSci(n) {
  if (n === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(n)));
  const mantissa = n / 10 ** exp;
  return `${mantissa.toFixed(2)} × 10^${exp}`;
}

/**
 * Emoji indicator for extreme FLOP counts.
 */
export function formatCost(n) {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + Math.round(n).toLocaleString('en-US');
  return '$' + n.toFixed(2);
}

export function flopEmoji(flops) {
  if (flops >= 1e28) return '😱';
  if (flops <= 1e22) return '🤔';
  return '';
}

/**
 * Compute chips needed for training, with iterative scaling penalty.
 *
 * Solves: HWF = TS × TC × BF16 × min(1, ScalingCoef^log₂(DF))
 * Where DF = TC / chipsPerPod (TPU) or DF = TC (GPU)
 *
 * Iterates until chip count converges within 1 chip.
 */
export function computeChipsNeeded(hwFlops, accel, scalingFactor, durationSeconds) {
  const isGpu = accel.vendor === 'nvidia';

  // Initial guess without scaling penalty
  let nChips = hwFlops / (durationSeconds * accel.bf16Flops);

  for (let i = 0; i < 200; i++) {
    let df;
    if (isGpu) {
      df = nChips;
    } else {
      df = nChips / accel.chipsPerPod;
    }
    const doublings = Math.max(0, Math.log2(df));
    const penalty = Math.min(1, scalingFactor ** doublings);
    const next = hwFlops / (durationSeconds * accel.bf16Flops * penalty);
    if (Math.abs(next - nChips) < 1) {
      nChips = next;
      break;
    }
    nChips = next;
  }

  const chips = Math.ceil(nChips);
  const pods = isGpu ? null : Math.ceil(chips / accel.chipsPerPod);

  // Calculate final penalty for display
  let df;
  if (isGpu) {
    df = chips;
  } else {
    df = chips / accel.chipsPerPod;
  }
  const doublings = Math.max(0, Math.log2(df));
  const penalty = Math.min(1, scalingFactor ** doublings);

  return { chips, pods, penalty };
}

/**
 * Compute training time given a fixed number of chips.
 * Returns { seconds, days, hours, penalty, pods }
 */
export function computeTimeForChips(hwFlops, accel, scalingFactor, chips) {
  if (chips <= 0) return null;

  const isGpu = accel.vendor === 'nvidia';
  const pods = isGpu ? null : Math.ceil(chips / accel.chipsPerPod);

  // Calculate penalty for this chip count
  let df;
  if (isGpu) {
    df = chips;
  } else {
    df = chips / accel.chipsPerPod;
  }
  const doublings = Math.max(0, Math.log2(df));
  const penalty = Math.min(1, scalingFactor ** doublings);

  // duration = HW FLOPs / (chips × BF16 × penalty)
  const seconds = hwFlops / (chips * accel.bf16Flops * penalty);
  const days = seconds / 86400;
  const hours = (seconds % 86400) / 3600;

  return { seconds, days, hours, penalty, pods };
}

/**
 * Format duration as "X days" or "X days Y hrs" if days < 5
 */
export function formatDuration(days, hours) {
  const d = Math.floor(days);
  const h = Math.round(hours);
  if (days >= 5) {
    return `${d} days`;
  } else if (d > 0) {
    return `${d}d ${h}h`;
  } else {
    return `${h} hrs`;
  }
}

/**
 * CSV-escape a field: quote it if it contains commas, quotes, or newlines.
 */
function csvField(value) {
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/**
 * Generate CSV string from visible accelerator table data.
 * visibleKeys: array of accelerator keys to include
 * overrides: per-accelerator overrides object
 * modelFlops: current model FLOPs (null if no results)
 */
export function generateCSV(visibleKeys, overrides = {}, modelFlops = null, customDays = null) {
  const hasResults = modelFlops != null && modelFlops > 0;
  const headers = ['Accelerator', 'BF16 FLOP/s', 'Chips/Pod', 'MFU', 'Scaling Factor', '$/hr'];
  if (hasResults) {
    headers.push('HW FLOPs');
    headers.push('Total Cost');
    const periods = [...TIME_PERIODS];
    if (customDays) {
      periods.push({ label: `${customDays} days`, seconds: customDays * 86400 });
    }
    for (const p of periods) {
      headers.push(p.label + ' chips');
      headers.push(p.label + ' pods');
    }
  }

  const rows = [headers.map(csvField).join(',')];

  for (const key of visibleKeys) {
    const a = ACCELERATORS[key];
    const mfu = overrides[key]?.mfu ?? a.defaultMfu;
    const scalingFactor = overrides[key]?.scalingFactor ?? a.defaultScalingFactor;
    const costPerChipHour = overrides[key]?.costPerChipHour ?? a.defaultCostPerChipHour;

    const fields = [
      a.name,
      formatSci(a.bf16Flops),
      a.chipsPerPod ?? '\u2014',
      mfu,
      scalingFactor,
      costPerChipHour.toFixed(2),
    ];

    if (hasResults) {
      const rowOverrides = { mfu, scalingFactor, costPerChipHour };
      if (customDays) rowOverrides.customDays = customDays;
      const results = computeResults(modelFlops, key, rowOverrides);
      fields.push(formatSci(results.totalHardwareFlops));
      fields.push(formatCost(results.totalCost));
      for (const p of results.perPeriod) {
        fields.push(p.chips.toLocaleString('en-US'));
        fields.push(p.pods != null ? `${p.pods} ${p.pods === 1 ? 'pod' : 'pods'}` : '\u2014');
      }
    }

    rows.push(fields.map(csvField).join(','));
  }

  return rows.join('\n');
}

/**
 * Full results for one accelerator across all time periods.
 * overrides: { mfu?, scalingFactor?, costPerChipHour?, customDays? }
 */
export function computeResults(modelFlops, accelKey, overrides = {}) {
  const accel = ACCELERATORS[accelKey];
  if (!accel) throw new Error(`Unknown accelerator: ${accelKey}`);

  const mfu = overrides.mfu ?? accel.defaultMfu;
  const scalingFactor = overrides.scalingFactor ?? accel.defaultScalingFactor;
  const costPerChipHour = overrides.costPerChipHour ?? accel.defaultCostPerChipHour;

  const totalHardwareFlops = modelFlops / mfu;
  const chipSeconds = totalHardwareFlops / accel.bf16Flops;
  const chipHours = chipSeconds / 3600;
  const totalCost = chipHours * costPerChipHour;

  const periods = [...TIME_PERIODS];
  if (overrides.customDays) {
    periods.push({
      label: `${overrides.customDays} days`,
      seconds: overrides.customDays * 86400,
    });
  }

  const perPeriod = periods.map((period) => {
    const { chips, pods, penalty } = computeChipsNeeded(
      totalHardwareFlops, accel, scalingFactor, period.seconds,
    );
    const totalChipHours = chips * (period.seconds / 3600);
    const cost = totalChipHours * costPerChipHour;
    return {
      label: period.label,
      durationSeconds: period.seconds,
      chips,
      pods,
      penalty,
      cost,
    };
  });

  return { totalHardwareFlops, totalCost, perPeriod };
}
