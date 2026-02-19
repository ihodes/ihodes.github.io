import React, { createElement, useState, useEffect, useCallback, useRef } from 'react';
import htm from 'htm';
import { ACCELERATORS, DEFAULT_VISIBLE, TIME_PERIODS, UNIT_TO_SECONDS, formatSci, formatEng, formatCount, formatCost, computeModelFlops, computeModelFlopsFromChips, computeResults, computeChipsNeeded, computeTimeForChips, formatDuration, flopEmoji, saveState, loadState, loadSavedCalcs, saveCalcToList, deleteCalcFromList, togglePinCalc, getSortedCalcs, calcDisplayName, generateCSV, SAVED_LIST_KEY } from './calc.js';

const html = htm.bind(createElement);

export function Menubar({ page, onPageChange, onOpenSaved, onNewCalc } = {}) {
  return html`
    <header className="menubar">
      <div className="menubar-left">
        <span className="logo"><span className="pixel-bird"></span>floppybird</span>
        <div className="nav-tabs">
          <button className=${`tab${page === 'forward' ? ' tab-active' : ''}`}
            onClick=${() => onPageChange('forward')}>FLOPs → Chips <span className="kbd-hint">1</span></button>
          <button className=${`tab${page === 'reverse' ? ' tab-active' : ''}`}
            onClick=${() => onPageChange('reverse')}>Chips → FLOPs <span className="kbd-hint">2</span></button>
        </div>
        <span className="page-desc">${page === 'forward'
          ? 'Given model FLOPs, how many chips and how much time do I need?'
          : 'Given chips and time, how many model FLOPs do I get?'}</span>
      </div>
      <nav>
        <button className="btn-saved" aria-label="Saved Calcs (s)" onClick=${onOpenSaved}>Saved Calcs <span className="kbd-hint">s</span></button>
        <button className="btn-new" aria-label="New Calc (Shift+=)" onClick=${onNewCalc}>New Calc <span className="kbd-hint">⇧+</span></button>
      </nav>
    </header>
  `;
}

export function SavedCalcsModal({ calcs, selectedIndex, onClose, onSelect, onDelete, onTogglePin } = {}) {
  return html`
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="saved-calcs-title" onClick=${onClose}>
      <div className="saved-calcs-modal" onClick=${e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="saved-calcs-title">Saved Calculations</h2>
          <span className="modal-kbd-hints">
            <span className="kbd-hint">j/k</span> navigate
            <span className="kbd-hint">p</span> pin
            <span className="kbd-hint">⏎</span> select
            <span className="kbd-hint">esc</span> close
          </span>
          <button className="btn-modal-close" aria-label="Close modal" onClick=${onClose}>×</button>
        </div>
        <div className="modal-body">
          ${(!calcs || calcs.length === 0) && html`
            <p className="modal-empty">No saved calculations</p>
          `}
          ${calcs && calcs.length > 0 && html`
            <ul className="calc-list">
              ${calcs.map((c, i) => {
                const name = calcDisplayName(c.state, c.savedAt);
                return html`
                <li key=${c.id}
                    className=${`calc-item${i === selectedIndex ? ' active' : ''}${c.pinned ? ' pinned' : ''}`}
                    onClick=${() => onSelect(c.id)}>
                  <span className="calc-item-name">
                    ${c.pinned && html`<span className="pin-indicator">📌 </span>`}
                    ${name}
                  </span>
                  <span className="calc-item-actions">
                    <button className="btn-pin" onClick=${e => { e.stopPropagation(); onTogglePin(c.id); }}
                      aria-label=${`${c.pinned ? 'Unpin' : 'Pin'} ${name}`}
                      title=${c.pinned ? 'Unpin' : 'Pin'}>${c.pinned ? 'Unpin' : 'Pin'}</button>
                    <button className="btn-delete" onClick=${e => { e.stopPropagation(); onDelete(c.id); }}
                      aria-label=${`Delete ${name}`}
                      title="Delete">×</button>
                  </span>
                </li>
              `})}
            </ul>
          `}
        </div>
      </div>
    </div>
  `;
}

function parseNum(str) {
  if (!str || str.trim() === '') return null;
  const s = str.trim().toUpperCase();
  // Check for M/B/T suffix (million/billion/trillion)
  const suffixMatch = s.match(/^([\d.e+-]+)\s*([MBT])$/i);
  if (suffixMatch) {
    const num = parseFloat(suffixMatch[1]);
    const suffix = suffixMatch[2].toUpperCase();
    const multiplier = suffix === 'M' ? 1e6 : suffix === 'B' ? 1e9 : 1e12;
    const result = num * multiplier;
    return isFinite(result) && result > 0 ? result : null;
  }
  const n = parseFloat(str);
  return isFinite(n) && n > 0 ? n : null;
}

export function ModelSpec({ onFlopChange, onStateChange, onSave, initialState } = {}) {
  const init = initialState || {};
  const [calcType, setCalcType] = useState(init.calcType || 'moe');
  const [activeParams, setActiveParams] = useState(init.activeParams || '');
  const [totalParams, setTotalParams] = useState(init.totalParams || '');
  const [tokens, setTokens] = useState(init.tokens || '');
  const [flops, setFlops] = useState(init.flops || '');
  const [modelName, setModelName] = useState(init.modelName || '');

  const pActive = parseNum(activeParams);
  const pTotal = parseNum(totalParams);
  const pTokens = parseNum(tokens);
  const pFlops = parseNum(flops);

  let modelFlops = null;
  if (calcType === 'moe' && pActive && pTokens) {
    modelFlops = computeModelFlops('moe', { activeParams: pActive, tokens: pTokens });
  } else if (calcType === 'dense' && pTotal && pTokens) {
    modelFlops = computeModelFlops('dense', { totalParams: pTotal, tokens: pTokens });
  } else if (calcType === 'flop' && pFlops) {
    modelFlops = computeModelFlops('flop', { flops: pFlops });
  }

  useEffect(() => {
    if (onFlopChange) onFlopChange(modelFlops);
  }, [modelFlops]);

  useEffect(() => {
    if (onStateChange) onStateChange({ calcType, activeParams, totalParams, tokens, flops, modelName });
  }, [calcType, activeParams, totalParams, tokens, flops, modelName]);

  let autoName = 'Model name';
  if (calcType === 'moe' && pActive && pTokens) {
    autoName = `MoE ${formatCount(pActive)} active ${formatCount(pTokens)} tokens`;
  } else if (calcType === 'dense' && pTotal && pTokens) {
    autoName = `Dense ${formatCount(pTotal)} ${formatCount(pTokens)} tokens`;
  } else if (calcType === 'flop' && pFlops) {
    autoName = `${formatSci(pFlops)} FLOPs`;
  }

  // Defer emoji updates until all spec inputs are unfocused
  const modelFlopsRef = useRef(modelFlops);
  modelFlopsRef.current = modelFlops;
  const focusCount = useRef(0);
  const [displayEmoji, setDisplayEmoji] = useState('');

  useEffect(() => {
    if (focusCount.current === 0) {
      setDisplayEmoji(modelFlops ? flopEmoji(modelFlops) : '');
    }
  }, [modelFlops]);

  function handleSpecFocus() { focusCount.current++; }
  function handleSpecBlur() {
    focusCount.current--;
    setTimeout(() => {
      if (focusCount.current === 0) {
        const f = modelFlopsRef.current;
        setDisplayEmoji(f ? flopEmoji(f) : '');
      }
    }, 0);
  }

  return html`
    <section className="model-spec">
      <div className="model-name-row">
        <label className="tufte-field model-name-field">
          <span className="tufte-label">Model calc name</span>
          <input className="model-name" type="text"
            aria-label="Model name"
            value=${modelName || autoName}
            onChange=${e => setModelName(e.target.value)}
            onFocus=${e => e.target.select()} />
        </label>
        ${onSave && html`
          <button className="btn-save" onClick=${onSave}
            aria-label="Save calc">Save <span className="kbd-hint">⌘S</span></button>
        `}
      </div>
      <div className="calc-inputs">
        <label className="tufte-field">
          <span className="tufte-label">Model type</span>
          <select className="calc-type" aria-label="Calculator type" value=${calcType}
            onChange=${e => setCalcType(e.target.value)}>
            <option value="moe">MoE</option>
            <option value="dense">Dense</option>
            <option value="flop">FLOP</option>
          </select>
        </label>
        ${calcType === 'moe' && html`
          <label className="tufte-field">
            <span className="tufte-label">Active params</span>
            <input className="input-active-params" type="text"
              placeholder="e.g. 8B or 8e9"
              value=${activeParams}
              onFocus=${handleSpecFocus} onBlur=${handleSpecBlur}
              onChange=${e => setActiveParams(e.target.value)} />
          </label>
          <label className="tufte-field">
            <span className="tufte-label">Tokens</span>
            <input className="input-tokens" type="text"
              placeholder="e.g. 7T or 7e12"
              value=${tokens}
              onFocus=${handleSpecFocus} onBlur=${handleSpecBlur}
              onChange=${e => setTokens(e.target.value)} />
          </label>
        `}
        ${calcType === 'dense' && html`
          <label className="tufte-field">
            <span className="tufte-label">Total params</span>
            <input className="input-total-params" type="text"
              placeholder="e.g. 70B or 70e9"
              value=${totalParams}
              onFocus=${handleSpecFocus} onBlur=${handleSpecBlur}
              onChange=${e => setTotalParams(e.target.value)} />
          </label>
          <label className="tufte-field">
            <span className="tufte-label">Tokens</span>
            <input className="input-tokens" type="text"
              placeholder="e.g. 2T or 2e12"
              value=${tokens}
              onFocus=${handleSpecFocus} onBlur=${handleSpecBlur}
              onChange=${e => setTokens(e.target.value)} />
          </label>
        `}
        ${calcType === 'flop' && html`
          <label className="tufte-field">
            <span className="tufte-label">Total FLOPs</span>
            <input className="input-flops" type="text"
              placeholder="e.g. 5e24"
              value=${flops}
              onFocus=${handleSpecFocus} onBlur=${handleSpecBlur}
              onChange=${e => setFlops(e.target.value)} />
          </label>
        `}
      </div>
      <div className="flop-display" aria-live="polite">
        <div className="flop-main-row">
          <span className="flop-value">${modelFlops ? html`${(() => {
            const exp = Math.floor(Math.log10(Math.abs(modelFlops)));
            const mantissa = (modelFlops / 10 ** exp).toFixed(2);
            return html`${mantissa} × 10<sup className="flop-exp">${exp}</sup>`;
          })()}` : '\u2014'}</span>
          <span className="flop-label">${' '}model FLOPs</span>
          ${(calcType === 'moe' || calcType === 'dense') && html`<span className="formula-desc">${' '}= 6 × P × T</span>`}
          ${displayEmoji && html`<span className="flop-emoji">${' '}${displayEmoji}</span>`}
        </div>
        ${modelFlops && html`<div className="flop-eng">${(() => {
          const exp = Math.floor(Math.log10(Math.abs(modelFlops)));
          const mantissa = (modelFlops / 10 ** exp).toFixed(2);
          return html`${mantissa}<span className="flop-eng-e">e</span>${exp}`;
        })()}</div>`}
      </div>
    </section>
  `;
}

/**
 * Pure function mapping keyboard events to action strings.
 * Returns null if the shortcut should be suppressed (e.g. when typing in an input).
 * Escape always works regardless of focus.
 */
export function handleKeyboardShortcut(e) {
  if (e.key === 'Escape') return 'blur';
  if (e.key === 's' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); return 'save'; }

  const tag = e.target?.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return null;

  if (e.key === '1') return 'page-forward';
  if (e.key === '2') return 'page-reverse';
  if (e.key === 'n') return 'focus-name';
  if (e.key === 'm') return 'focus-calc-type';
  if (e.key === 's') return 'open-saved';
  if (e.key === '+' && e.shiftKey) return 'new-calc';

  return null;
}

const COLUMN_TOOLTIPS = {
  bf16: 'BF16 peak FLOP/s per chip (bfloat16 throughput)',
  chipsPod: 'Number of chips in one pod (TPUs only; GPUs scale per-chip)',
  mfu: 'Model FLOPs Utilization — fraction of peak FLOP/s achieved in practice',
  scaling: 'Penalty applied per doubling of pods (TPU) or chips (GPU).',
  cost: 'Cost per chip per hour in USD',
};

function EditableCell({ value, defaultValue, onChange, onReset, isEdited, step, min, max, formatValue }) {
  const displayValue = formatValue ? formatValue(value) : String(value);
  const [inputValue, setInputValue] = useState(displayValue);
  const [isFocused, setIsFocused] = useState(false);
  const [error, setError] = useState(null);

  // Sync inputValue when value changes externally (e.g., reset)
  useEffect(() => {
    if (!isFocused) {
      setInputValue(formatValue ? formatValue(value) : String(value));
    }
  }, [value, isFocused]);

  // Clear error after a delay
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  function handleBlur() {
    setIsFocused(false);
    const parsed = parseFloat(inputValue);
    if (!isFinite(parsed)) {
      setError('Enter a valid number');
      setInputValue(formatValue ? formatValue(value) : String(value));
    } else if (min != null && parsed < min) {
      setError(`Min: ${min}`);
      const clamped = min;
      if (clamped !== value) onChange(clamped);
      setInputValue(formatValue ? formatValue(clamped) : String(clamped));
    } else if (max != null && parsed > max) {
      setError(`Max: ${max}`);
      const clamped = max;
      if (clamped !== value) onChange(clamped);
      setInputValue(formatValue ? formatValue(clamped) : String(clamped));
    } else {
      // Only trigger onChange if value actually changed
      if (parsed !== value) onChange(parsed);
      setInputValue(formatValue ? formatValue(parsed) : String(parsed));
    }
  }

  return html`
    <${React.Fragment}>
      <input type="text"
        className=${`cell-editable ${isEdited ? 'cell-edited' : 'cell-default'}${error ? ' cell-error' : ''}`}
        value=${inputValue}
        onFocus=${() => setIsFocused(true)}
        onBlur=${handleBlur}
        onChange=${e => setInputValue(e.target.value)} />
      ${isEdited && html`
        <button className="btn-reset" onClick=${onReset}
          aria-label="Reset to default"
          title="Reset to default">↺</button>
      `}
      ${error && html`<span className="cell-error-msg">${error}</span>`}
    </${React.Fragment}>
  `;
}

const ALL_ACCEL_KEYS = Object.keys(ACCELERATORS);

export function AcceleratorTable({ modelFlops, overrides, onOverrideChange, onOverrideReset, initialVisible, initialCustomDays, initialCustomChips, onTableStateChange } = {}) {
  const [visible, setVisible] = useState(() => {
    if (initialVisible) return initialVisible;
    const init = {};
    for (const key of ALL_ACCEL_KEYS) {
      init[key] = DEFAULT_VISIBLE.includes(key);
    }
    return init;
  });

  const [customDays, setCustomDays] = useState(initialCustomDays || '');
  const [customChips, setCustomChips] = useState(initialCustomChips || '');

  useEffect(() => {
    if (onTableStateChange) onTableStateChange({ visible, customDays, customChips });
  }, [visible, customDays, customChips]);

  const hasResults = modelFlops != null && modelFlops > 0;
  const visibleKeys = ALL_ACCEL_KEYS.filter(k => visible[k]);

  function toggleAccel(key) {
    setVisible(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function getVal(accelKey, field) {
    return overrides[accelKey]?.[field] ?? null;
  }

  function isEdited(accelKey, field) {
    return overrides[accelKey]?.[field] != null;
  }

  const [copyLabel, setCopyLabel] = useState('Copy CSV');

  function handleCopyCSV() {
    const parsedDays = parseFloat(customDays);
    const csvCustomDays = isFinite(parsedDays) && parsedDays > 0 ? parsedDays : null;
    const csv = generateCSV(visibleKeys, overrides, modelFlops, csvCustomDays);

    // Try modern clipboard API first, fall back to execCommand
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(csv).then(() => {
        setCopyLabel('Copied!');
        setTimeout(() => setCopyLabel('Copy CSV'), 1500);
      }).catch(() => {
        fallbackCopy(csv);
      });
    } else {
      fallbackCopy(csv);
    }

    function fallbackCopy(text) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopyLabel('Copied!');
        setTimeout(() => setCopyLabel('Copy CSV'), 1500);
      } catch (e) {
        setCopyLabel('Failed');
        setTimeout(() => setCopyLabel('Copy CSV'), 1500);
      }
      document.body.removeChild(textarea);
    }
  }

  return html`
    <section className="accel-table">
      <div className="accel-table-toolbar">
        <div className="accel-toggles">
          ${ALL_ACCEL_KEYS.map(key => html`
            <label key=${key} className="accel-toggle">
              <input type="checkbox"
                checked=${visible[key]}
                onChange=${() => toggleAccel(key)} />
              ${' '}${key}
            </label>
          `)}
        </div>
        <button className="btn-copy-csv" onClick=${handleCopyCSV}
          aria-label="Copy table as CSV"
          title="Copy table as CSV">${copyLabel}</button>
      </div>
      <table aria-label="Accelerator comparison">
        <thead>
          <tr className="super-header-row">
            <th colSpan="6"></th>
            <th colSpan="2" className="super-header col-sep">Total</th>
            <th rowSpan="2" className="super-header col-sep chips-train-header" data-formula="Time = HW FLOPs / (BF16 × chips × penalty)">
              <input type="number" className="custom-chips-input"
                placeholder="#"
                value=${customChips}
                min="1" step="1"
                onChange=${e => setCustomChips(e.target.value)} />${' '}chips train in...
            </th>
            <th colSpan=${TIME_PERIODS.length + 1} className="super-header col-sep">
              # of chips required to train model in...
            </th>
          </tr>
          <tr>
            <th>Accelerator</th>
            <th data-formula="Peak BF16 throughput per chip">BF16 FLOP/s <span className="info-tip" data-tip=${COLUMN_TOOLTIPS.bf16}>ⓘ</span></th>
            <th data-formula="Chips per pod (TPUs only)">Chips/Pod <span className="info-tip" data-tip=${COLUMN_TOOLTIPS.chipsPod}>ⓘ</span></th>
            <th data-formula=${COLUMN_TOOLTIPS.mfu}>MFU</th>
            <th data-formula=${COLUMN_TOOLTIPS.scaling}>Scale Coef.</th>
            <th data-formula=${COLUMN_TOOLTIPS.cost}>$/hr</th>
            <th className="col-sep" data-formula="HW FLOPs = Model FLOPs / MFU">HW FLOPs</th>
            <th className="result-header" data-formula="Cost = (HW FLOPs / BF16) / 3600 × $/hr">Cost</th>
            ${TIME_PERIODS.map((p, i) => html`
              <th key=${p.label} className=${`result-header${i === 0 ? ' col-sep' : ''}`} data-formula="Chips = HW FLOPs / (BF16 × penalty × seconds)">${p.label}</th>
            `)}
            <th className="result-header" data-formula="Chips = HW FLOPs / (BF16 × penalty × seconds)">
              <input type="number" className="custom-days-input"
                placeholder="#"
                value=${customDays}
                min="1" step="1"
                onChange=${e => setCustomDays(e.target.value)} />${' '}days
            </th>
          </tr>
        </thead>
        <tbody>
          ${visibleKeys.map(key => {
            const a = ACCELERATORS[key];
            const mfu = getVal(key, 'mfu') ?? a.defaultMfu;
            const scalingFactor = getVal(key, 'scalingFactor') ?? a.defaultScalingFactor;
            const costPerChipHour = getVal(key, 'costPerChipHour') ?? a.defaultCostPerChipHour;
            const parsedDays = parseFloat(customDays);
            const rowOverrides = { mfu, scalingFactor, costPerChipHour };
            if (isFinite(parsedDays) && parsedDays > 0) rowOverrides.customDays = parsedDays;
            const results = hasResults ? computeResults(modelFlops, key, rowOverrides) : null;
            return html`
              <tr key=${key}>
                <td>${a.name}</td>
                <td>${formatSci(a.bf16Flops)}</td>
                <td>${a.chipsPerPod ?? '\u2014'}</td>
                <td className="editable-cell">
                  <${EditableCell}
                    value=${mfu}
                    defaultValue=${a.defaultMfu}
                    onChange=${v => onOverrideChange(key, 'mfu', v)}
                    onReset=${() => onOverrideReset(key, 'mfu')}
                    isEdited=${isEdited(key, 'mfu')}
                    min=${0.01}
                    max=${1} />
                </td>
                <td className="editable-cell">
                  <${EditableCell}
                    value=${scalingFactor}
                    defaultValue=${a.defaultScalingFactor}
                    onChange=${v => onOverrideChange(key, 'scalingFactor', v)}
                    onReset=${() => onOverrideReset(key, 'scalingFactor')}
                    isEdited=${isEdited(key, 'scalingFactor')}
                    min=${0.01}
                    max=${1} />
                </td>
                <td className="editable-cell"><span className="cell-prefix">$</span><${EditableCell}
                    value=${costPerChipHour}
                    defaultValue=${a.defaultCostPerChipHour}
                    onChange=${v => onOverrideChange(key, 'costPerChipHour', v)}
                    onReset=${() => onOverrideReset(key, 'costPerChipHour')}
                    isEdited=${isEdited(key, 'costPerChipHour')}
                    formatValue=${v => v.toFixed(2)}
                    min=${0} />
                </td>
                <td className="col-sep">${results ? formatSci(results.totalHardwareFlops) : '\u2014'}</td>
                <td className="result-cell">${results ? formatCost(results.totalCost) : '\u2014'}</td>
                <td className="result-cell col-sep">${(() => {
                  const parsedChips = parseInt(customChips, 10);
                  if (!results || !isFinite(parsedChips) || parsedChips <= 0) return '\u2014';
                  const timeResult = computeTimeForChips(results.totalHardwareFlops, a, scalingFactor, parsedChips);
                  if (!timeResult) return '\u2014';
                  const isGpu = a.chipsPerPod == null;
                  const dfExpr = isGpu ? 'chips' : 'pods';
                  const penaltyTip = `scaling penalty = min(1, ${scalingFactor}^log₂(${dfExpr}))`;
                  return html`
                    <span className="time-value">${formatDuration(timeResult.days, timeResult.hours)}</span>
                    ${timeResult.pods != null && html`
                      <span className="pod-count">${timeResult.pods} ${timeResult.pods === 1 ? 'pod' : 'pods'} (<span className="penalty-hint" title=${penaltyTip}>${timeResult.penalty.toFixed(2)}×</span>)</span>
                    `}
                    ${timeResult.pods == null && html`
                      <span className="pod-count"><span className="penalty-hint" title=${penaltyTip}>${timeResult.penalty.toFixed(2)}×</span></span>
                    `}
                  `;
                })()}</td>
                ${TIME_PERIODS.map((period, i) => {
                  const p = results?.perPeriod?.find(r => r.label === period.label);
                  if (p) {
                    const isGpu = a.chipsPerPod == null;
                    const dfExpr = isGpu ? 'chips' : 'pods';
                    const penaltyTip = `scaling penalty = min(1, ${scalingFactor}^log₂(${dfExpr}))`;
                    return html`
                    <td key=${period.label} className=${`result-cell${i === 0 ? ' col-sep' : ''}`}>
                      <span className="chip-count">${p.chips.toLocaleString('en-US')}</span>
                      ${p.pods != null && html`
                        <span className="pod-count">${p.pods} ${p.pods === 1 ? 'pod' : 'pods'} (<span className="penalty-hint" title=${penaltyTip}>${p.penalty.toFixed(2)}×</span>)</span>
                      `}
                      ${p.pods == null && html`
                        <span className="pod-count"><span className="penalty-hint" title=${penaltyTip}>${p.penalty.toFixed(2)}×</span></span>
                      `}
                    </td>
                  `} else {
                    return html`<td key=${period.label} className=${`result-cell${i === 0 ? ' col-sep' : ''}`}>\u2014</td>`;
                  }
                })}
                <td className="result-cell">${(() => {
                  const customResult = results?.perPeriod?.find(r => r.label.includes('days'));
                  if (customResult) {
                    const isGpu = a.chipsPerPod == null;
                    const dfExpr = isGpu ? 'chips' : 'pods';
                    const penaltyTip = `scaling penalty = min(1, ${scalingFactor}^log₂(${dfExpr}))`;
                    return html`
                      <span className="chip-count">${customResult.chips.toLocaleString('en-US')}</span>
                      ${customResult.pods != null && html`
                        <span className="pod-count">${customResult.pods} ${customResult.pods === 1 ? 'pod' : 'pods'} (<span className="penalty-hint" title=${penaltyTip}>${customResult.penalty.toFixed(2)}×</span>)</span>
                      `}
                      ${customResult.pods == null && html`
                        <span className="pod-count"><span className="penalty-hint" title=${penaltyTip}>${customResult.penalty.toFixed(2)}×</span></span>
                      `}
                    `;
                  }
                  return '\u2014';
                })()}</td>
              </tr>
            `;
          })}
        </tbody>
      </table>
    </section>
  `;
}

const ALL_UNIT_KEYS = Object.keys(UNIT_TO_SECONDS);

export function ReverseSpec({ onResultChange, onStateChange, initialState, overrides = {} } = {}) {
  const init = initialState || {};
  const [chips, setChips] = useState(init.reverseChips || '');
  const [accelKey, setAccelKey] = useState(init.reverseAccelKey || 'H100');
  const [timeValue, setTimeValue] = useState(init.reverseTimeValue || '');
  const [timeUnit, setTimeUnit] = useState(init.reverseTimeUnit || 'days');

  const parsedChips = (() => { const n = parseInt(chips, 10); return isFinite(n) && n > 0 ? n : null; })();
  const parsedTime = parseFloat(timeValue);
  const durationSeconds = isFinite(parsedTime) && parsedTime > 0
    ? parsedTime * UNIT_TO_SECONDS[timeUnit]
    : null;

  const accel = ACCELERATORS[accelKey];
  const accelOverrides = {
    mfu: overrides[accelKey]?.mfu ?? accel.defaultMfu,
    scalingFactor: overrides[accelKey]?.scalingFactor ?? accel.defaultScalingFactor,
    costPerChipHour: overrides[accelKey]?.costPerChipHour ?? accel.defaultCostPerChipHour,
  };
  const result = (parsedChips && durationSeconds)
    ? computeModelFlopsFromChips(parsedChips, accelKey, durationSeconds, accelOverrides)
    : null;

  useEffect(() => {
    if (onResultChange) {
      onResultChange(result ? {
        chips: parsedChips,
        accelKey,
        durationSeconds,
        modelFlops: result.modelFlops,
        hardwareFlops: result.hardwareFlops,
        timeValue: parsedTime,
        timeUnit,
      } : null);
    }
  }, [parsedChips, accelKey, durationSeconds, overrides]);

  useEffect(() => {
    if (onStateChange) onStateChange({ reverseChips: chips, reverseAccelKey: accelKey, reverseTimeValue: timeValue, reverseTimeUnit: timeUnit });
  }, [chips, accelKey, timeValue, timeUnit]);

  return html`
    <section className="model-spec">
      <div className="calc-inputs">
        <label className="tufte-field">
          <span className="tufte-label">Number of chips</span>
          <input className="input-chips" type="text"
            placeholder="e.g. 1024"
            value=${chips}
            onChange=${e => setChips(e.target.value)} />
        </label>
        <label className="tufte-field">
          <span className="tufte-label">Chip type</span>
          <select className="calc-type" aria-label="Chip type"
            value=${accelKey}
            onChange=${e => setAccelKey(e.target.value)}>
            ${ALL_ACCEL_KEYS.map(k => html`<option key=${k} value=${k}>${ACCELERATORS[k].name}</option>`)}
          </select>
        </label>
        <label className="tufte-field">
          <span className="tufte-label">Time</span>
          <input className="input-time-value" type="text"
            placeholder="e.g. 30"
            value=${timeValue}
            onChange=${e => setTimeValue(e.target.value)} />
        </label>
        <label className="tufte-field">
          <span className="tufte-label">Period</span>
          <select className="calc-type" aria-label="Time unit"
            value=${timeUnit}
            onChange=${e => setTimeUnit(e.target.value)}>
            ${ALL_UNIT_KEYS.map(u => html`<option key=${u} value=${u}>${u}</option>`)}
          </select>
        </label>
      </div>
      <div className="reverse-info-line">
        A single ${accel.name} provides ${formatSci(accel.bf16Flops)} BF16 FLOP/s
      </div>
      <div className="flop-display" aria-live="polite">
        <div className="flop-main-row">
          <span className="flop-value">${result ? html`${(() => {
            const exp = Math.floor(Math.log10(Math.abs(result.modelFlops)));
            const mantissa = (result.modelFlops / 10 ** exp).toFixed(2);
            return html`${mantissa} × 10<sup className="flop-exp">${exp}</sup>`;
          })()}` : '\u2014'}</span>
          <span className="flop-label">${' '}model FLOPs</span>
          <span className="formula-desc">${' '}= chips × BF16 × penalty × time × MFU</span>
        </div>
        ${result && html`<div className="flop-eng">${(() => {
          const exp = Math.floor(Math.log10(Math.abs(result.modelFlops)));
          const mantissa = (result.modelFlops / 10 ** exp).toFixed(2);
          return html`${mantissa}<span className="flop-eng-e">e</span>${exp}`;
        })()}</div>`}
      </div>
    </section>
  `;
}

export function ReverseResultsTable({ result, overrides = {}, onOverrideChange, onOverrideReset } = {}) {
  if (!result) return null;

  const { chips: inputChips, accelKey: selectedKey, durationSeconds, modelFlops, hardwareFlops, timeValue, timeUnit } = result;
  const timeLabel = `${timeValue} ${timeUnit}`;

  function getVal(accelKey, field) {
    return overrides[accelKey]?.[field] ?? null;
  }
  function isEdited(accelKey, field) {
    return overrides[accelKey]?.[field] != null;
  }

  const rows = ALL_ACCEL_KEYS.map(key => {
    const accel = ACCELERATORS[key];
    const isSelected = key === selectedKey;
    const mfu = getVal(key, 'mfu') ?? accel.defaultMfu;
    const scalingFactor = getVal(key, 'scalingFactor') ?? accel.defaultScalingFactor;
    const costPerChipHour = getVal(key, 'costPerChipHour') ?? accel.defaultCostPerChipHour;
    const accelOverrides = { mfu, scalingFactor, costPerChipHour };

    if (isSelected) {
      const selectedResult = computeModelFlopsFromChips(inputChips, key, durationSeconds, accelOverrides);
      return {
        key, accel, isSelected: true,
        chips: inputChips,
        mfu, scalingFactor, costPerChipHour,
        pods: selectedResult.pods,
        penalty: selectedResult.penalty,
        hardwareFlops: selectedResult.hardwareFlops,
        cost: selectedResult.cost,
      };
    }

    // For other accelerators: how many chips needed for the same modelFlops in the same duration?
    const hwFlopsNeeded = modelFlops / mfu;
    const { chips, pods, penalty } = computeChipsNeeded(hwFlopsNeeded, accel, scalingFactor, durationSeconds);
    const revResult = computeModelFlopsFromChips(chips, key, durationSeconds, accelOverrides);
    const chipHours = chips * (durationSeconds / 3600);
    const cost = chipHours * costPerChipHour;

    return {
      key, accel, isSelected: false,
      chips, pods, penalty,
      mfu, scalingFactor, costPerChipHour,
      hardwareFlops: revResult.hardwareFlops,
      cost,
    };
  });

  const [copyLabel, setCopyLabel] = useState('Copy CSV');

  function handleCopyCSV() {
    const headers = ['Accelerator', 'Chips', 'Pods', 'MFU', 'Scale Coef.', 'Penalty', 'HW FLOPs', '$/hr', 'Cost'];
    const csvRows = [headers.join(',')];
    for (const r of rows) {
      csvRows.push([
        r.accel.name,
        r.chips,
        r.pods != null ? r.pods : '',
        r.mfu,
        r.scalingFactor,
        r.penalty.toFixed(3),
        formatSci(r.hardwareFlops),
        r.costPerChipHour.toFixed(2),
        r.cost > 0 ? formatCost(r.cost) : '',
      ].join(','));
    }
    const csv = csvRows.join('\n');
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(csv).then(() => {
        setCopyLabel('Copied!');
        setTimeout(() => setCopyLabel('Copy CSV'), 1500);
      }).catch(() => { setCopyLabel('Failed'); setTimeout(() => setCopyLabel('Copy CSV'), 1500); });
    }
  }

  return html`
    <section className="accel-table reverse-table">
      <div className="accel-table-toolbar">
        <div></div>
        <button className="btn-copy-csv" onClick=${handleCopyCSV}
          aria-label="Copy table as CSV"
          title="Copy table as CSV">${copyLabel}</button>
      </div>
      <table aria-label="Equivalent chip counts">
        <thead>
          <tr>
            <th>Accelerator</th>
            <th data-formula="Number of chips required">Chips</th>
            <th data-formula="Number of pods (TPUs only)">Pods</th>
            <th data-formula=${COLUMN_TOOLTIPS.mfu}>MFU</th>
            <th data-formula=${COLUMN_TOOLTIPS.scaling}>Scale Coef.</th>
            <th data-formula="Penalty = Scale Coef.^log₂(pods or chips)">Penalty</th>
            <th className="result-header" data-formula="HW FLOPs = chips × BF16 × penalty × time">HW FLOPs</th>
            <th data-formula=${COLUMN_TOOLTIPS.cost}>$/hr</th>
            <th className="result-header" data-formula="Cost = chips × hours × $/hr">Cost</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => html`
            <tr key=${r.key} className=${r.isSelected ? 'reverse-selected-row' : ''}>
              <td>${r.accel.name}</td>
              <td title=${`${r.chips.toLocaleString('en-US')} chips over ${timeLabel}`}>${r.chips.toLocaleString('en-US')}</td>
              <td>${r.pods != null ? r.pods : '\u2014'}</td>
              <td className="editable-cell">
                <${EditableCell}
                  value=${r.mfu}
                  defaultValue=${r.accel.defaultMfu}
                  onChange=${v => onOverrideChange(r.key, 'mfu', v)}
                  onReset=${() => onOverrideReset(r.key, 'mfu')}
                  isEdited=${isEdited(r.key, 'mfu')}
                  min=${0.01}
                  max=${1} />
              </td>
              <td className="editable-cell">
                <${EditableCell}
                  value=${r.scalingFactor}
                  defaultValue=${r.accel.defaultScalingFactor}
                  onChange=${v => onOverrideChange(r.key, 'scalingFactor', v)}
                  onReset=${() => onOverrideReset(r.key, 'scalingFactor')}
                  isEdited=${isEdited(r.key, 'scalingFactor')}
                  min=${0.01}
                  max=${1} />
              </td>
              <td title=${`min(1, ${r.scalingFactor}^log₂(${r.accel.vendor === 'nvidia' ? 'chips' : 'pods'}))`}>${r.penalty.toFixed(3)}</td>
              <td className="result-cell" title=${`${formatSci(r.hardwareFlops)} = ${r.chips} × ${formatSci(r.accel.bf16Flops)} × ${r.penalty.toFixed(3)} × ${durationSeconds}s`}>${formatSci(r.hardwareFlops)}</td>
              <td className="editable-cell"><span className="cell-prefix">$</span><${EditableCell}
                  value=${r.costPerChipHour}
                  defaultValue=${r.accel.defaultCostPerChipHour}
                  onChange=${v => onOverrideChange(r.key, 'costPerChipHour', v)}
                  onReset=${() => onOverrideReset(r.key, 'costPerChipHour')}
                  isEdited=${isEdited(r.key, 'costPerChipHour')}
                  formatValue=${v => v.toFixed(2)}
                  min=${0} />
              </td>
              <td className="result-cell">${r.cost > 0 ? formatCost(r.cost) : '\u2014'}</td>
            </tr>
          `)}
        </tbody>
      </table>
    </section>
  `;
}

export function App() {
  const saved = useRef(loadState());
  const [page, setPage] = useState(saved.current?.page || 'forward');
  const [modelFlops, setModelFlops] = useState(null);
  const [overrides, setOverrides] = useState(saved.current?.overrides || {});
  const initState = saved.current || {};
  const modelStateRef = useRef({
    calcType: initState.calcType, activeParams: initState.activeParams,
    totalParams: initState.totalParams, tokens: initState.tokens,
    flops: initState.flops, modelName: initState.modelName,
  });
  const tableStateRef = useRef({
    visible: initState.visible, customDays: initState.customDays, customChips: initState.customChips,
  });
  const reverseStateRef = useRef({
    reverseChips: initState.reverseChips, reverseAccelKey: initState.reverseAccelKey,
    reverseTimeValue: initState.reverseTimeValue, reverseTimeUnit: initState.reverseTimeUnit,
  });
  const reverseResultRef = useRef(null);
  const [reverseResult, setReverseResult] = useState(null);
  const saveTimer = useRef(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [savedCalcs, setSavedCalcs] = useState(() => getSortedCalcs(loadSavedCalcs()));
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [resetKey, setResetKey] = useState(0);

  function refreshSavedCalcs() {
    setSavedCalcs(getSortedCalcs(loadSavedCalcs()));
  }

  function openModal() {
    refreshSavedCalcs();
    setSelectedIndex(0);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  function getCurrentState() {
    const ms = modelStateRef.current || {};
    const ts = tableStateRef.current || {};
    const rs = reverseStateRef.current || {};
    return { ...ms, ...rs, page, overrides, visible: ts.visible || {}, customDays: ts.customDays || '', customChips: ts.customChips || '' };
  }

  function handleSaveCalc() {
    const current = getCurrentState();
    saveCalcToList(current);
    refreshSavedCalcs();
  }

  function handleNewCalc() {
    const current = getCurrentState();
    saveCalcToList(current);
    saveState({});
    setResetKey(k => k + 1);
    saved.current = null;
    refreshSavedCalcs();
  }

  function handleSelectCalc(id) {
    const current = getCurrentState();
    saveCalcToList(current);
    const entry = savedCalcs.find(c => c.id === id);
    if (entry) {
      deleteCalcFromList(id);
      saveState(entry.state);
      saved.current = entry.state;
      setResetKey(k => k + 1);
    }
    closeModal();
    refreshSavedCalcs();
  }

  const [deletedCalc, setDeletedCalc] = useState(null);
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef(null);

  function handleDeleteCalc(id) {
    const entry = savedCalcs.find(c => c.id === id);
    if (entry) {
      setDeletedCalc(entry);
      setToastVisible(true);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => {
        setToastVisible(false);
        setDeletedCalc(null);
      }, 5000);
    }
    deleteCalcFromList(id);
    refreshSavedCalcs();
    setSavedCalcs(prev => {
      const next = prev.filter(c => c.id !== id);
      if (selectedIndex >= next.length && next.length > 0) {
        setSelectedIndex(next.length - 1);
      }
      return next;
    });
  }

  function handleUndoDelete() {
    if (deletedCalc) {
      // Re-add the deleted calc
      const list = loadSavedCalcs();
      list.push(deletedCalc);
      localStorage.setItem(SAVED_LIST_KEY, JSON.stringify(list));
      refreshSavedCalcs();
      setDeletedCalc(null);
      setToastVisible(false);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    }
  }

  function handleTogglePin(id) {
    togglePinCalc(id);
    refreshSavedCalcs();
  }

  function handleTogglePinKeepSelection(id) {
    togglePinCalc(id);
    const newCalcs = getSortedCalcs(loadSavedCalcs());
    setSavedCalcs(newCalcs);
    // Find new index of the same calc
    const newIndex = newCalcs.findIndex(c => c.id === id);
    if (newIndex >= 0) setSelectedIndex(newIndex);
  }

  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveState(getCurrentState());
    }, 400);
  }

  function onModelStateChange(state) {
    modelStateRef.current = state;
    scheduleSave();
  }

  function onTableStateChange(state) {
    tableStateRef.current = state;
    scheduleSave();
  }

  function handleOverrideChange(accelKey, field, value) {
    setOverrides(prev => {
      const accelOverrides = { ...prev[accelKey] };
      accelOverrides[field] = value;
      return { ...prev, [accelKey]: accelOverrides };
    });
    scheduleSave();
  }

  function handleOverrideReset(accelKey, field) {
    setOverrides(prev => {
      const accelOverrides = { ...prev[accelKey] };
      delete accelOverrides[field];
      const next = { ...prev, [accelKey]: accelOverrides };
      if (Object.keys(next[accelKey]).length === 0) delete next[accelKey];
      return next;
    });
    scheduleSave();
  }

  function onReverseStateChange(state) {
    reverseStateRef.current = state;
    scheduleSave();
  }

  function onReverseResultChange(result) {
    reverseResultRef.current = result;
    setReverseResult(result);
  }

  function handlePageChange(p) {
    // Persist current state and update initState before switching
    const current = { ...getCurrentState(), page: p };
    saveState(current);
    saved.current = current;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setPage(p);
  }

  useEffect(() => {
    function onKeyDown(e) {
      // Modal-specific keyboard navigation
      if (modalOpen) {
        if (e.key === 'Escape') { closeModal(); return; }
        if (e.key === 'j' || e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, savedCalcs.length - 1));
          return;
        }
        if (e.key === 'k' || e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
          return;
        }
        if (e.key === 'p') {
          if (savedCalcs.length > 0) {
            const calc = savedCalcs[selectedIndex];
            if (calc) handleTogglePinKeepSelection(calc.id);
          }
          return;
        }
        if (e.key === 'z') {
          handleUndoDelete();
          return;
        }
        if (e.key === 'Enter') {
          if (savedCalcs.length > 0) {
            handleSelectCalc(savedCalcs[selectedIndex]?.id);
          }
          return;
        }
        return;
      }

      const action = handleKeyboardShortcut(e);
      if (!action) return;

      switch (action) {
        case 'blur':
          if (typeof document !== 'undefined') document.activeElement?.blur();
          break;
        case 'page-forward':
          handlePageChange('forward');
          break;
        case 'page-reverse':
          handlePageChange('reverse');
          break;
        case 'focus-name':
          document.querySelector('.model-name')?.focus();
          break;
        case 'focus-calc-type':
          document.querySelector('.calc-type')?.focus();
          break;
        case 'open-saved':
          openModal();
          break;
        case 'new-calc':
          handleNewCalc();
          break;
        case 'save':
          handleSaveCalc();
          break;
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [modalOpen, savedCalcs, selectedIndex]);

  return html`
    <div className="app">
      <${Menubar} page=${page} onPageChange=${handlePageChange} onOpenSaved=${openModal} onNewCalc=${handleNewCalc} />
      <main>
        ${page === 'forward' && html`
          <${ModelSpec}
            key=${'ms-' + resetKey}
            onFlopChange=${setModelFlops}
            onStateChange=${onModelStateChange}
            onSave=${handleSaveCalc}
            initialState=${initState} />
          <${AcceleratorTable}
            key=${'at-' + resetKey}
            modelFlops=${modelFlops}
            overrides=${overrides}
            onOverrideChange=${handleOverrideChange}
            onOverrideReset=${handleOverrideReset}
            onTableStateChange=${onTableStateChange}
            initialVisible=${initState?.visible}
            initialCustomDays=${initState?.customDays}
            initialCustomChips=${initState?.customChips} />
        `}
        ${page === 'reverse' && html`
          <${ReverseSpec}
            key=${'rs-' + resetKey}
            onResultChange=${onReverseResultChange}
            onStateChange=${onReverseStateChange}
            overrides=${overrides}
            initialState=${initState} />
          <${ReverseResultsTable}
            result=${reverseResult}
            overrides=${overrides}
            onOverrideChange=${handleOverrideChange}
            onOverrideReset=${handleOverrideReset} />
        `}
      </main>
      ${modalOpen && html`
        <${SavedCalcsModal}
          calcs=${savedCalcs}
          selectedIndex=${selectedIndex}
          onClose=${closeModal}
          onSelect=${handleSelectCalc}
          onDelete=${handleDeleteCalc}
          onTogglePin=${handleTogglePinKeepSelection} />
      `}
      ${toastVisible && html`
        <div className="toast">
          Deleted "${deletedCalc ? calcDisplayName(deletedCalc.state) : ''}"
          <button className="toast-undo" onClick=${handleUndoDelete}>Undo <span className="kbd-hint">z</span></button>
        </div>
      `}
    </div>
  `;
}

// Exported for testing — App with explicit initial state (no localStorage)
export function AppWithState() {
  return html`<${App} />`;
}

// Mount in browser only
if (typeof document !== 'undefined') {
  import('react-dom/client').then(({ createRoot }) => {
    createRoot(document.getElementById('root')).render(html`<${App} />`);
  });
}
