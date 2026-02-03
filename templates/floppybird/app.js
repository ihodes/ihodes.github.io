import { createElement, useState, useEffect, useCallback, useRef } from 'react';
import htm from 'htm';
import { ACCELERATORS, DEFAULT_VISIBLE, TIME_PERIODS, formatSci, formatCount, formatCost, computeModelFlops, computeResults, flopEmoji, saveState, loadState, loadSavedCalcs, saveCalcToList, deleteCalcFromList, togglePinCalc, getSortedCalcs, calcDisplayName, generateCSV, SAVED_LIST_KEY } from './calc.js';

const html = htm.bind(createElement);

export function Menubar({ onOpenSaved, onNewCalc } = {}) {
  return html`
    <header className="menubar">
      <span className="logo"><span className="pixel-bird"></span>floppybird <span className="logo-subtitle">model budget calculator</span></span>
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
            onFocus=${e => { if (!modelName) { setModelName(autoName); e.target.select(); } }} />
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
              placeholder="e.g. 8e9"
              value=${activeParams}
              onFocus=${handleSpecFocus} onBlur=${handleSpecBlur}
              onChange=${e => setActiveParams(e.target.value)} />
          </label>
          <label className="tufte-field">
            <span className="tufte-label">Tokens</span>
            <input className="input-tokens" type="text"
              placeholder="e.g. 7e12"
              value=${tokens}
              onFocus=${handleSpecFocus} onBlur=${handleSpecBlur}
              onChange=${e => setTokens(e.target.value)} />
          </label>
        `}
        ${calcType === 'dense' && html`
          <label className="tufte-field">
            <span className="tufte-label">Total params</span>
            <input className="input-total-params" type="text"
              placeholder="e.g. 70e9"
              value=${totalParams}
              onFocus=${handleSpecFocus} onBlur=${handleSpecBlur}
              onChange=${e => setTotalParams(e.target.value)} />
          </label>
          <label className="tufte-field">
            <span className="tufte-label">Tokens</span>
            <input className="input-tokens" type="text"
              placeholder="e.g. 2e12"
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
        <span className="flop-value">${modelFlops ? formatSci(modelFlops) : '\u2014'}</span>
        ${displayEmoji && html`<span className="flop-emoji">${' '}${displayEmoji}</span>`}
      </div>
      ${(calcType === 'moe' || calcType === 'dense') && html`
        <div className="formula-desc">Training FLOPs = 6 × P × T</div>
      `}
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

const ALL_ACCEL_KEYS = Object.keys(ACCELERATORS);

export function AcceleratorTable({ modelFlops, initialOverrides, initialVisible, initialCustomDays, onTableStateChange } = {}) {
  const [visible, setVisible] = useState(() => {
    if (initialVisible) return initialVisible;
    const init = {};
    for (const key of ALL_ACCEL_KEYS) {
      init[key] = DEFAULT_VISIBLE.includes(key);
    }
    return init;
  });

  // Per-accelerator overrides: { [accelKey]: { mfu?, scalingFactor?, costPerChipHour? } }
  const [overrides, setOverrides] = useState(initialOverrides || {});
  const [customDays, setCustomDays] = useState(initialCustomDays || '');

  useEffect(() => {
    if (onTableStateChange) onTableStateChange({ overrides, visible, customDays });
  }, [overrides, visible, customDays]);

  const hasResults = modelFlops != null && modelFlops > 0;
  const visibleKeys = ALL_ACCEL_KEYS.filter(k => visible[k]);

  function toggleAccel(key) {
    setVisible(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function setOverride(accelKey, field, value) {
    setOverrides(prev => {
      const accelOverrides = { ...prev[accelKey] };
      accelOverrides[field] = value;
      return { ...prev, [accelKey]: accelOverrides };
    });
  }

  function resetField(accelKey, field) {
    setOverrides(prev => {
      const accelOverrides = { ...prev[accelKey] };
      delete accelOverrides[field];
      const next = { ...prev, [accelKey]: accelOverrides };
      if (Object.keys(next[accelKey]).length === 0) delete next[accelKey];
      return next;
    });
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
          ${hasResults && html`
            <tr className="super-header-row">
              <th colSpan="8"></th>
              <th colSpan=${TIME_PERIODS.length + 1} className="super-header col-sep">
                # of chips required to train model
              </th>
            </tr>
          `}
          <tr>
            <th>Accelerator</th>
            <th data-formula="Peak BF16 throughput per chip">BF16 FLOP/s <span className="info-tip" data-tip=${COLUMN_TOOLTIPS.bf16}>ⓘ</span></th>
            <th data-formula="Chips per pod (TPUs only)">Chips/Pod <span className="info-tip" data-tip=${COLUMN_TOOLTIPS.chipsPod}>ⓘ</span></th>
            <th data-formula="Effective FLOP/s = BF16 × MFU">MFU <span className="info-tip" data-tip=${COLUMN_TOOLTIPS.mfu}>ⓘ</span></th>
            <th data-formula="Penalty = SF^log₂(pods or chips)">Scale Coef. <span className="info-tip" data-tip=${COLUMN_TOOLTIPS.scaling}>ⓘ</span></th>
            <th data-formula="Cost per chip-hour in USD">$/hr <span className="info-tip" data-tip=${COLUMN_TOOLTIPS.cost}>ⓘ</span></th>
            ${hasResults && html`
              <th className="col-sep" data-formula="HW FLOPs = Model FLOPs / MFU">HW FLOPs</th>
              <th data-formula="Cost = (HW FLOPs / BF16) / 3600 × $/hr">Total Cost</th>
              ${TIME_PERIODS.map((p, i) => html`
                <th key=${p.label} className=${i === 0 ? 'col-sep' : ''} data-formula="Chips = HW FLOPs / (BF16 × penalty × seconds)">${p.label}</th>
              `)}
              <th data-formula="Chips = HW FLOPs / (BF16 × penalty × seconds)">
                <input type="number" className="custom-days-input"
                  placeholder="#"
                  value=${customDays}
                  min="1" step="1"
                  onChange=${e => setCustomDays(e.target.value)} />${' '}days
              </th>
            `}
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
                  <input type="number"
                    className=${`cell-editable ${isEdited(key, 'mfu') ? 'cell-edited' : 'cell-default'}`}
                    value=${mfu}
                    step="0.01" min="0.01" max="1"
                    onChange=${e => {
                      const v = parseFloat(e.target.value);
                      if (isFinite(v) && v >= 0.01 && v <= 1) setOverride(key, 'mfu', v);
                    }} />
                  ${isEdited(key, 'mfu') && html`
                    <button className="btn-reset" onClick=${() => resetField(key, 'mfu')}
                      aria-label=${`Reset MFU for ${a.name}`}
                      title="Reset to default">↺</button>
                  `}
                </td>
                <td className="editable-cell">
                  <input type="number"
                    className=${`cell-editable ${isEdited(key, 'scalingFactor') ? 'cell-edited' : 'cell-default'}`}
                    value=${scalingFactor}
                    step="0.01" min="0.01" max="1"
                    onChange=${e => {
                      const v = parseFloat(e.target.value);
                      if (isFinite(v) && v >= 0.01 && v <= 1) setOverride(key, 'scalingFactor', v);
                    }} />
                  ${isEdited(key, 'scalingFactor') && html`
                    <button className="btn-reset" onClick=${() => resetField(key, 'scalingFactor')}
                      aria-label=${`Reset scaling factor for ${a.name}`}
                      title="Reset to default">↺</button>
                  `}
                </td>
                <td className="editable-cell">
                  <input type="number"
                    className=${`cell-editable ${isEdited(key, 'costPerChipHour') ? 'cell-edited' : 'cell-default'}`}
                    value=${costPerChipHour.toFixed(2)}
                    step="0.10" min="0"
                    onChange=${e => {
                      const v = parseFloat(e.target.value);
                      if (isFinite(v) && v >= 0) setOverride(key, 'costPerChipHour', v);
                    }} />
                  ${isEdited(key, 'costPerChipHour') && html`
                    <button className="btn-reset" onClick=${() => resetField(key, 'costPerChipHour')}
                      aria-label=${`Reset cost for ${a.name}`}
                      title="Reset to default">↺</button>
                  `}
                </td>
                ${results && html`
                  <td className="col-sep">${formatSci(results.totalHardwareFlops)}</td>
                  <td className="result-cell">${formatCost(results.totalCost)}</td>
                  ${results.perPeriod.map((p, i) => {
                    const isGpu = a.chipsPerPod == null;
                    const dfExpr = isGpu ? 'chips' : 'chips / chipsPerPod';
                    const penaltyTip = `scaling penalty = min(1, ${scalingFactor}^log₂(${dfExpr}))`;
                    return html`
                    <td key=${p.label} className=${`result-cell${i === 0 ? ' col-sep' : ''}`}>
                      <span className="chip-count">${p.chips.toLocaleString('en-US')}</span>
                      ${p.pods != null && html`
                        <span className="pod-count">${p.pods} ${p.pods === 1 ? 'pod' : 'pods'} (<span className="penalty-hint" title=${penaltyTip}>${p.penalty.toFixed(2)}×</span>)</span>
                      `}
                      ${p.pods == null && html`
                        <span className="pod-count"><span className="penalty-hint" title=${penaltyTip}>${p.penalty.toFixed(2)}×</span></span>
                      `}
                    </td>
                  `})}
                  ${!rowOverrides.customDays && html`<td></td>`}
                `}
              </tr>
            `;
          })}
        </tbody>
      </table>
    </section>
  `;
}

export function App() {
  const saved = useRef(loadState());
  const [modelFlops, setModelFlops] = useState(null);
  const modelStateRef = useRef(null);
  const tableStateRef = useRef(null);
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
    return { ...ms, overrides: ts.overrides || {}, visible: ts.visible || {}, customDays: ts.customDays || '' };
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

  const initState = saved.current;

  return html`
    <div className="app">
      <${Menubar} onOpenSaved=${openModal} onNewCalc=${handleNewCalc} />
      <main>
        <${ModelSpec}
          key=${'ms-' + resetKey}
          onFlopChange=${setModelFlops}
          onStateChange=${onModelStateChange}
          onSave=${handleSaveCalc}
          initialState=${initState} />
        <${AcceleratorTable}
          key=${'at-' + resetKey}
          modelFlops=${modelFlops}
          onTableStateChange=${onTableStateChange}
          initialOverrides=${initState?.overrides}
          initialVisible=${initState?.visible}
          initialCustomDays=${initState?.customDays} />
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
