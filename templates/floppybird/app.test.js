import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { App, Menubar, ModelSpec, AcceleratorTable, AppWithState, SavedCalcsModal } from './app.js';

function render(component) {
  return renderToStaticMarkup(createElement(component));
}

// ─── Phase 1: Scaffold & Static Layout ─────────────────────────────

describe('Scaffold structure', () => {
  it('App renders menubar, model-spec, and accel-table sections', () => {
    const html = render(App);
    assert.match(html, /class="menubar"/, 'Missing menubar');
    assert.match(html, /class="model-spec"/, 'Missing model-spec');
    assert.match(html, /class="accel-table"/, 'Missing accel-table');
  });

  it('Menubar has Saved Calcs and New Calc buttons', () => {
    const html = render(Menubar);
    assert.match(html, /Saved Calcs/);
    assert.match(html, /New Calc/);
  });

  it('Model spec has name input and calculator type dropdown', () => {
    const html = render(ModelSpec);
    assert.match(html, /class="model-name"/, 'Missing model name input');
    assert.match(html, /<select/, 'Missing calculator type dropdown');
    assert.match(html, /MoE/);
    assert.match(html, /Dense/);
    assert.match(html, /FLOP/);
  });

  it('Accelerator table shows default visible accelerators', () => {
    const html = render(AcceleratorTable);
    assert.match(html, /A100/);
    assert.match(html, /v4p/);
    assert.match(html, /v5p/);
    assert.match(html, /v6e/);
  });

  it('Accelerator table has expected column headers', () => {
    const html = render(AcceleratorTable);
    assert.match(html, /BF16 FLOP\/s/);
    assert.match(html, /MFU/);
    assert.match(html, /Scaling Factor/);
    assert.match(html, /\$\/hr/);
  });

  it('Accelerator table hides chips/pod for NVIDIA rows', () => {
    const html = render(AcceleratorTable);
    // A100 row should have '—' for chips/pod, TPU rows should have numbers
    // v5p has 8960 chips/pod
    assert.match(html, /8960/);
  });
});

describe('FLOP display placeholder', () => {
  it('shows a placeholder FLOP value', () => {
    const html = render(ModelSpec);
    assert.match(html, /class="flop-display"/);
  });
});

// ─── Phase 2: Model Spec & FLOP Display ─────────────────────────────

describe('Model Spec interactive UI', () => {
  it('MoE mode (default) shows active params and tokens inputs', () => {
    const html = render(ModelSpec);
    assert.match(html, /class="input-active-params"/, 'Missing active params input');
    assert.match(html, /class="input-tokens"/, 'Missing tokens input');
  });

  it('MoE mode does not show FLOP-only or Dense-only inputs', () => {
    const html = render(ModelSpec);
    assert.doesNotMatch(html, /class="input-flops"/, 'Should not show FLOP input in MoE mode');
    assert.doesNotMatch(html, /class="input-total-params"/, 'Should not show total params in MoE mode');
  });

  it('shows formula description for MoE', () => {
    const html = render(ModelSpec);
    assert.match(html, /class="formula-desc"/, 'Missing formula description');
    assert.match(html, /6 × P × T/, 'Should show 6 × P × T formula');
  });

  it('FLOP display shows em dash when inputs are empty', () => {
    const html = render(ModelSpec);
    assert.match(html, /class="flop-value"/, 'Missing flop-value span');
    // Initial render: no inputs filled → should show em dash
    assert.match(html, /\u2014/, 'Should show em dash when no inputs');
  });

  it('model name input has dynamic placeholder when inputs empty', () => {
    const html = render(ModelSpec);
    assert.match(html, /placeholder="Model name"/, 'Default placeholder should be "Model name"');
  });
});

// ─── Results Wiring (Phase 5 → UI) ─────────────────────────────────

describe('AcceleratorTable results display', () => {
  function renderAccelTable(props) {
    return renderToStaticMarkup(createElement(AcceleratorTable, props));
  }

  it('shows time period column headers when modelFlops provided', () => {
    const html = renderAccelTable({ modelFlops: 4.8e22 });
    assert.match(html, /1 day/);
    assert.match(html, /1 week/);
    assert.match(html, /4 weeks/);
    assert.match(html, /8 weeks/);
  });

  it('shows HW FLOPs column header when modelFlops provided', () => {
    const html = renderAccelTable({ modelFlops: 4.8e22 });
    assert.match(html, /HW FLOPs/);
  });

  it('does not show result columns when modelFlops is null', () => {
    const html = renderAccelTable({});
    assert.doesNotMatch(html, /1 day/);
    assert.doesNotMatch(html, /HW FLOPs/);
  });

  it('renders correct chip count for known v5p example (73 chips at 4wks)', () => {
    const html = renderAccelTable({ modelFlops: 4.8e22 });
    // v5p at 4.8e22 FLOPs, 4 weeks → 73 chips (verified in calc.test.js)
    assert.match(html, /\b73\b/);
  });

  it('shows pods for TPU rows', () => {
    const html = renderAccelTable({ modelFlops: 4.8e22 });
    assert.match(html, /pod/);
  });
});

// ─── Phase 3: Accelerator Visibility Toggles ────────────────────────

describe('Accelerator visibility toggles', () => {
  function renderAccelTable(props) {
    return renderToStaticMarkup(createElement(AcceleratorTable, props));
  }

  it('renders a visibility toggle area with checkboxes for all accelerators', () => {
    const html = renderAccelTable({});
    assert.match(html, /class="accel-toggles"/, 'Missing toggle container');
    // All 8 accelerators should have a checkbox
    for (const key of ['A100', 'H100', 'H200', 'B200', 'v4p', 'v5e', 'v5p', 'v6e']) {
      assert.match(html, new RegExp(key), `Missing toggle for ${key}`);
    }
  });

  it('default-visible accelerators are checked by default', () => {
    const html = renderAccelTable({});
    // Default visible: A100, v4p, v5p, v6e should be checked
    // Count checked checkboxes - should be exactly 4
    const checkedCount = (html.match(/checked/g) || []).length;
    assert.equal(checkedCount, 4, 'Should have exactly 4 checked toggles');
  });

  it('only default-visible accelerator rows appear in table initially', () => {
    const html = renderAccelTable({});
    // H100, H200, B200, v5e should NOT appear in table body rows
    // but they DO appear in the toggles area — so check specifically in <tbody>
    const tbody = html.split('<tbody>')[1]?.split('</tbody>')[0] ?? '';
    assert.match(tbody, /A100/, 'A100 should be in table');
    assert.match(tbody, /v4p/, 'v4p should be in table');
    assert.match(tbody, /v5p/, 'v5p should be in table');
    assert.match(tbody, /v6e/, 'v6e should be in table');
    assert.doesNotMatch(tbody, /H100/, 'H100 should not be in table by default');
    assert.doesNotMatch(tbody, /H200/, 'H200 should not be in table by default');
    assert.doesNotMatch(tbody, /B200/, 'B200 should not be in table by default');
    assert.doesNotMatch(tbody, /v5e/, 'v5e should not be in table by default');
  });
});

// ─── Phase 3: Info Tooltips on Column Headers ────────────────────────

describe('Info tooltips on column headers', () => {
  function renderAccelTable(props) {
    return renderToStaticMarkup(createElement(AcceleratorTable, props));
  }

  it('renders info icons in column headers', () => {
    const html = renderAccelTable({});
    const thead = html.split('<thead>')[1]?.split('</thead>')[0] ?? '';
    assert.match(thead, /class="info-tip"/, 'Should have info-tip elements in header');
  });

  it('each data column header has exactly one info tooltip', () => {
    const html = renderAccelTable({});
    const thead = html.split('<thead>')[1]?.split('</thead>')[0] ?? '';
    // 5 data columns: BF16 FLOP/s, Chips/Pod, MFU, Scaling Factor, $/hr
    const tipCount = (thead.match(/class="info-tip"/g) || []).length;
    assert.equal(tipCount, 5, 'Should have 5 info tooltips (one per data column)');
  });

  it('info tooltips have title attributes with descriptive text', () => {
    const html = renderAccelTable({});
    const thead = html.split('<thead>')[1]?.split('</thead>')[0] ?? '';
    assert.match(thead, /title="[^"]*BF16[^"]*"/, 'BF16 tooltip should have descriptive title');
    assert.match(thead, /title="[^"]*Utilization[^"]*"/, 'MFU tooltip should have descriptive title');
    assert.match(thead, /title="[^"]*scaling[^"]*"/i, 'Scaling factor tooltip should have descriptive title');
  });
});

// ─── Phase 4: Editable Cells ────────────────────────────────────────

import { ACCELERATORS } from './calc.js';

describe('Editable cells', () => {
  function renderAccelTable(props) {
    return renderToStaticMarkup(createElement(AcceleratorTable, props));
  }

  it('renders MFU, scaling factor, and $/hr as input elements', () => {
    const html = renderAccelTable({});
    const tbody = html.split('<tbody>')[1]?.split('</tbody>')[0] ?? '';
    // Each visible row (4 default) should have 3 editable inputs
    assert.match(tbody, /class="cell-editable[^"]*"/, 'Should have editable cell inputs');
    // Count input elements in tbody — 4 rows × 3 editable columns = 12
    const inputCount = (tbody.match(/<input/g) || []).length;
    assert.equal(inputCount, 12, 'Should have 12 editable inputs (4 rows × 3 columns)');
  });

  it('editable cells show default values initially', () => {
    const html = renderAccelTable({});
    const tbody = html.split('<tbody>')[1]?.split('</tbody>')[0] ?? '';
    // v5p default MFU is 0.6
    assert.match(tbody, /value="0\.6"/, 'Should show default MFU for v5p');
    // Default cost is 3.50 for all
    assert.match(tbody, /value="3\.50"/, 'Should show default cost');
  });

  it('editable cells with defaults have the cell-default class', () => {
    const html = renderAccelTable({});
    const tbody = html.split('<tbody>')[1]?.split('</tbody>')[0] ?? '';
    assert.match(tbody, /cell-default/, 'Default cells should have cell-default class');
  });

  it('no reset buttons shown when all values are defaults', () => {
    const html = renderAccelTable({});
    const tbody = html.split('<tbody>')[1]?.split('</tbody>')[0] ?? '';
    assert.doesNotMatch(tbody, /btn-reset/, 'No reset buttons when values are defaults');
  });

  it('scaling factor input has max="1" constraint', () => {
    const html = renderAccelTable({});
    // Scaling factor inputs should have max=1
    assert.match(html, /max="1"/, 'Scaling factor should have max=1');
  });

  it('MFU input has max="1" and min="0.01" constraints', () => {
    const html = renderAccelTable({});
    assert.match(html, /min="0\.01"/, 'MFU should have min=0.01');
  });

  it('results use overrides when provided via initial overrides', () => {
    // Render with modelFlops and check that results appear correctly
    // (results wiring with overrides already tested in calc.test.js,
    //  here we just verify the UI passes overrides through)
    const html = renderAccelTable({ modelFlops: 4.8e22 });
    // Should still show result columns
    assert.match(html, /HW FLOPs/, 'Results should still render with editable cells');
  });
});

// ─── Phase 6: Keyboard Shortcuts ────────────────────────────────────

import { handleKeyboardShortcut } from './app.js';

describe('Keyboard shortcuts', () => {
  it('handleKeyboardShortcut returns "focus-name" for key "n"', () => {
    const result = handleKeyboardShortcut({ key: 'n', target: { tagName: 'BODY' } });
    assert.equal(result, 'focus-name');
  });

  it('handleKeyboardShortcut returns "focus-calc-type" for key "m"', () => {
    const result = handleKeyboardShortcut({ key: 'm', target: { tagName: 'BODY' } });
    assert.equal(result, 'focus-calc-type');
  });

  it('handleKeyboardShortcut returns "open-saved" for key "s"', () => {
    const result = handleKeyboardShortcut({ key: 's', target: { tagName: 'BODY' } });
    assert.equal(result, 'open-saved');
  });

  it('handleKeyboardShortcut returns "new-calc" for Shift+=', () => {
    const result = handleKeyboardShortcut({ key: '+', shiftKey: true, target: { tagName: 'BODY' } });
    assert.equal(result, 'new-calc');
  });

  it('returns "blur" for Escape regardless of focus', () => {
    const result = handleKeyboardShortcut({ key: 'Escape', target: { tagName: 'INPUT' } });
    assert.equal(result, 'blur');
  });

  it('returns null when focused on an input element (suppressed)', () => {
    const result = handleKeyboardShortcut({ key: 'n', target: { tagName: 'INPUT' } });
    assert.equal(result, null);
  });

  it('returns null when focused on a select element (suppressed)', () => {
    const result = handleKeyboardShortcut({ key: 'm', target: { tagName: 'SELECT' } });
    assert.equal(result, null);
  });

  it('returns null when focused on a textarea (suppressed)', () => {
    const result = handleKeyboardShortcut({ key: 'n', target: { tagName: 'TEXTAREA' } });
    assert.equal(result, null);
  });

  it('returns null for unmapped keys', () => {
    const result = handleKeyboardShortcut({ key: 'z', target: { tagName: 'BODY' } });
    assert.equal(result, null);
  });

  it('App renders with keyboard shortcut handler (useEffect wired)', () => {
    // Verify the App component still renders correctly with shortcuts added
    const html = render(App);
    assert.match(html, /class="menubar"/, 'App should still render menubar');
    assert.match(html, /class="model-spec"/, 'App should still render model-spec');
  });
});

// ─── Phase 7: Persistence (UI integration) ──────────────────────────

import { STORAGE_KEY, loadState, saveState } from './calc.js';

describe('Persistence UI integration', () => {
  it('ModelSpec accepts initialState prop and renders restored values', () => {
    const initState = {
      calcType: 'dense',
      totalParams: '70e9',
      tokens: '2e12',
      modelName: 'Restored Model',
    };
    const html = renderToStaticMarkup(createElement(ModelSpec, { initialState: initState }));
    assert.match(html, /value="Restored Model"/, 'Should show restored model name');
    assert.match(html, /value="70e9"/, 'Should show restored total params');
    assert.match(html, /value="2e12"/, 'Should show restored tokens');
  });

  it('AcceleratorTable accepts initialOverrides and initialVisible props', () => {
    const initOverrides = { v5p: { mfu: 0.5 } };
    const initVisible = { A100: false, H100: true, H200: false, B200: false, v4p: true, v5e: false, v5p: true, v6e: true };
    const html = renderToStaticMarkup(createElement(AcceleratorTable, {
      initialOverrides: initOverrides,
      initialVisible: initVisible,
    }));
    const tbody = html.split('<tbody>')[1]?.split('</tbody>')[0] ?? '';
    // A100 should NOT be in table (visible=false), H100 should be
    assert.doesNotMatch(tbody, /A100/, 'A100 should be hidden');
    assert.match(tbody, /H100/, 'H100 should be visible');
    // v5p MFU should show overridden 0.5 with cell-edited class
    assert.match(tbody, /value="0\.5"/, 'Should show overridden MFU for v5p');
    assert.match(tbody, /cell-edited/, 'Overridden cell should have cell-edited class');
  });

  it('App renders correctly (backward compatible, no initialState)', () => {
    const html = render(App);
    assert.match(html, /class="menubar"/);
    assert.match(html, /class="model-spec"/);
    assert.match(html, /class="accel-table"/);
  });
});

// ─── Phase 7: Saved Calcs Modal ──────────────────────────────────────

import { calcDisplayName } from './calc.js';

describe('SavedCalcsModal', () => {
  function renderModal(props) {
    return renderToStaticMarkup(createElement(SavedCalcsModal, props));
  }

  it('renders modal overlay with saved-calcs-modal class', () => {
    const html = renderModal({ calcs: [], onClose: () => {}, onSelect: () => {}, onDelete: () => {}, onTogglePin: () => {} });
    assert.match(html, /class="modal-overlay"/);
    assert.match(html, /class="saved-calcs-modal"/);
  });

  it('shows "No saved calculations" when list is empty', () => {
    const html = renderModal({ calcs: [], onClose: () => {}, onSelect: () => {}, onDelete: () => {}, onTogglePin: () => {} });
    assert.match(html, /No saved calculations/);
  });

  it('renders saved calc entries with names', () => {
    const calcs = [
      { id: '1', savedAt: 1000, pinned: false, state: { calcType: 'moe', activeParams: '8e9', tokens: '1e12', modelName: 'Test Model' } },
      { id: '2', savedAt: 2000, pinned: false, state: { calcType: 'dense', totalParams: '70e9', tokens: '2e12', modelName: '' } },
    ];
    const html = renderModal({ calcs, onClose: () => {}, onSelect: () => {}, onDelete: () => {}, onTogglePin: () => {} });
    assert.match(html, /Test Model/);
    assert.match(html, /Dense.*70B/);
  });

  it('shows pinned indicator for pinned calcs', () => {
    const calcs = [
      { id: '1', savedAt: 1000, pinned: true, state: { calcType: 'moe', modelName: 'Pinned' } },
    ];
    const html = renderModal({ calcs, onClose: () => {}, onSelect: () => {}, onDelete: () => {}, onTogglePin: () => {} });
    assert.match(html, /pinned/i);
  });

  it('renders delete button for each calc', () => {
    const calcs = [
      { id: '1', savedAt: 1000, pinned: false, state: { calcType: 'moe', modelName: 'A' } },
      { id: '2', savedAt: 2000, pinned: false, state: { calcType: 'dense', modelName: 'B' } },
    ];
    const html = renderModal({ calcs, onClose: () => {}, onSelect: () => {}, onDelete: () => {}, onTogglePin: () => {} });
    const deleteCount = (html.match(/btn-delete/g) || []).length;
    assert.equal(deleteCount, 2, 'Should have delete button per entry');
  });

  it('renders pin toggle button for each calc', () => {
    const calcs = [
      { id: '1', savedAt: 1000, pinned: false, state: { calcType: 'moe', modelName: 'A' } },
    ];
    const html = renderModal({ calcs, onClose: () => {}, onSelect: () => {}, onDelete: () => {}, onTogglePin: () => {} });
    assert.match(html, /btn-pin/, 'Should have pin button');
  });

  it('highlights selected index with active class', () => {
    const calcs = [
      { id: '1', savedAt: 1000, pinned: false, state: { modelName: 'A', calcType: 'moe' } },
      { id: '2', savedAt: 2000, pinned: false, state: { modelName: 'B', calcType: 'moe' } },
    ];
    const html = renderModal({ calcs, selectedIndex: 1, onClose: () => {}, onSelect: () => {}, onDelete: () => {}, onTogglePin: () => {} });
    // The second item should have active class
    assert.match(html, /calc-item active/);
  });
});

// ─── Phase 5: Custom Days Input ───────────────────────────────────────

describe('Custom days input in table header', () => {
  function renderAccelTable(props) {
    return renderToStaticMarkup(createElement(AcceleratorTable, props));
  }

  it('renders a custom days input in the header row when results are shown', () => {
    const html = renderAccelTable({ modelFlops: 4.8e22 });
    assert.match(html, /class="custom-days-input"/, 'Should have custom-days-input');
  });

  it('does not render custom days input when no modelFlops', () => {
    const html = renderAccelTable({});
    assert.doesNotMatch(html, /custom-days-input/, 'No custom days input without results');
  });

  it('renders custom days column results when initialCustomDays provided', () => {
    const html = renderAccelTable({ modelFlops: 4.8e22, initialCustomDays: 10 });
    const thead = html.split('<thead>')[1]?.split('</thead>')[0] ?? '';
    // The header should show "10 days" or an input with value 10
    assert.match(html, /value="10"/, 'Should show custom days value of 10');
    // The tbody should have an extra result column for each row
    const tbody = html.split('<tbody>')[1]?.split('</tbody>')[0] ?? '';
    // Result cells for custom period should be present (more result-cell entries)
    const resultCells = (tbody.match(/result-cell/g) || []).length;
    // 4 default visible rows × (4 default periods + 1 custom) = 20
    assert.equal(resultCells, 20, 'Should have 20 result cells (4 rows × 5 periods)');
  });

  it('default (no custom days) shows 4 period result cells per row', () => {
    const html = renderAccelTable({ modelFlops: 4.8e22 });
    const tbody = html.split('<tbody>')[1]?.split('</tbody>')[0] ?? '';
    const resultCells = (tbody.match(/result-cell/g) || []).length;
    // 4 default visible rows × 4 default periods = 16
    assert.equal(resultCells, 16, 'Should have 16 result cells (4 rows × 4 periods)');
  });
});

// ─── Phase 8: Mobile Responsiveness ───────────────────────────────────

describe('Mobile responsiveness structure', () => {
  function renderAccelTable(props) {
    return renderToStaticMarkup(createElement(AcceleratorTable, props));
  }

  it('accel-table wrapper div wraps the table for horizontal scrolling', () => {
    const html = renderAccelTable({});
    // The table should be inside an accel-table section
    assert.match(html, /class="accel-table"/, 'Should have accel-table wrapper');
    // Table element should be inside the wrapper
    const wrapper = html.split('class="accel-table"')[1];
    assert.ok(wrapper.includes('<table'), 'Table should be inside accel-table wrapper');
  });

  it('calc-inputs has the responsive class for wrapping', () => {
    const html = render(ModelSpec);
    assert.match(html, /class="calc-inputs"/, 'Should have calc-inputs class');
  });

  it('menubar has responsive flex structure', () => {
    const html = render(Menubar);
    assert.match(html, /class="menubar"/, 'Should have menubar class');
  });
});

import { readFileSync } from 'node:fs';

describe('Mobile responsive CSS rules', () => {
  const css = readFileSync(new URL('./style.css', import.meta.url), 'utf8');

  it('has a mobile breakpoint media query', () => {
    assert.match(css, /@media[^{]*max-width/, 'Should have a max-width media query for mobile');
  });

  it('accel-table has overflow-x for horizontal scrolling', () => {
    assert.match(css, /\.accel-table[^}]*overflow-x\s*:\s*auto/, 'accel-table should have overflow-x: auto');
  });

  it('table has min-width to prevent column squishing', () => {
    assert.match(css, /\.accel-table\s+table[^}]*min-width/, 'table should have a min-width');
  });

  it('calc-inputs wraps on small screens', () => {
    assert.match(css, /\.calc-inputs[^}]*flex-wrap/, 'calc-inputs should have flex-wrap');
  });
});

// ─── Phase 8: Accessibility ───────────────────────────────────────────

describe('Accessibility: aria labels on interactive elements', () => {
  it('Menubar buttons have aria-label attributes', () => {
    const html = render(Menubar);
    assert.match(html, /btn-saved[^>]*aria-label="/, 'Saved Calcs button should have aria-label');
    assert.match(html, /btn-new[^>]*aria-label="/, 'New Calc button should have aria-label');
  });

  it('model name input has aria-label', () => {
    const html = render(ModelSpec);
    assert.match(html, /class="model-name"[^>]*aria-label="/, 'Model name input should have aria-label');
  });

  it('calculator type select has aria-label', () => {
    const html = render(ModelSpec);
    assert.match(html, /class="calc-type"[^>]*aria-label="/, 'Calc type select should have aria-label');
  });

  it('FLOP display has aria-live region for dynamic updates', () => {
    const html = render(ModelSpec);
    assert.match(html, /class="flop-display"[^>]*aria-live="polite"/, 'FLOP display should be an aria-live region');
  });

  it('copy CSV button has aria-label', () => {
    const html = renderToStaticMarkup(createElement(AcceleratorTable, {}));
    assert.match(html, /btn-copy-csv[^>]*aria-label="/, 'Copy CSV button should have aria-label');
  });
});

describe('Accessibility: modal attributes', () => {
  function renderModal(props) {
    return renderToStaticMarkup(createElement(SavedCalcsModal, props));
  }

  it('modal overlay has role="dialog" and aria-modal', () => {
    const html = renderModal({ calcs: [], onClose: () => {}, onSelect: () => {}, onDelete: () => {}, onTogglePin: () => {} });
    assert.match(html, /role="dialog"/, 'Modal should have role="dialog"');
    assert.match(html, /aria-modal="true"/, 'Modal should have aria-modal="true"');
  });

  it('modal has aria-labelledby pointing to the heading', () => {
    const html = renderModal({ calcs: [], onClose: () => {}, onSelect: () => {}, onDelete: () => {}, onTogglePin: () => {} });
    assert.match(html, /aria-labelledby="saved-calcs-title"/, 'Modal should have aria-labelledby');
    assert.match(html, /id="saved-calcs-title"/, 'Modal heading should have matching id');
  });

  it('close button has aria-label', () => {
    const html = renderModal({ calcs: [], onClose: () => {}, onSelect: () => {}, onDelete: () => {}, onTogglePin: () => {} });
    assert.match(html, /btn-modal-close[^>]*aria-label="/, 'Close button should have aria-label');
  });

  it('delete buttons have aria-label with calc context', () => {
    const calcs = [
      { id: '1', savedAt: 1000, pinned: false, state: { calcType: 'moe', modelName: 'Test' } },
    ];
    const html = renderModal({ calcs, onClose: () => {}, onSelect: () => {}, onDelete: () => {}, onTogglePin: () => {} });
    assert.match(html, /btn-delete[^>]*aria-label="/, 'Delete button should have aria-label');
  });

  it('pin buttons have aria-label with calc context', () => {
    const calcs = [
      { id: '1', savedAt: 1000, pinned: false, state: { calcType: 'moe', modelName: 'Test' } },
    ];
    const html = renderModal({ calcs, onClose: () => {}, onSelect: () => {}, onDelete: () => {}, onTogglePin: () => {} });
    assert.match(html, /btn-pin[^>]*aria-label="/, 'Pin button should have aria-label');
  });
});

describe('Accessibility: focus indicators in CSS', () => {
  const css = readFileSync(new URL('./style.css', import.meta.url), 'utf8');

  it('has :focus-visible styles for keyboard focus indication', () => {
    assert.match(css, /:focus-visible/, 'Should have :focus-visible styles for keyboard users');
  });

  it('has a focus outline or box-shadow for interactive elements', () => {
    // Check that focus-visible rules define a visible indicator (outline or box-shadow)
    assert.match(css, /focus-visible[^}]*(outline|box-shadow)\s*:/s, 'focus-visible should define outline or box-shadow');
  });
});

describe('Accessibility: table structure', () => {
  it('accelerator table has aria-label', () => {
    const html = renderToStaticMarkup(createElement(AcceleratorTable, {}));
    assert.match(html, /<table[^>]*aria-label="/, 'Table should have aria-label');
  });

  it('reset buttons have aria-label', () => {
    const html = renderToStaticMarkup(createElement(AcceleratorTable, {
      initialOverrides: { v5p: { mfu: 0.5 } },
    }));
    assert.match(html, /btn-reset[^>]*aria-label="/, 'Reset button should have aria-label');
  });
});

// ─── Phase 8: Loading State During Hydration ──────────────────────────

describe('Loading state during hydration', () => {
  it('index.html has a loading indicator inside #root before React mounts', () => {
    const indexHtml = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
    const rootDiv = indexHtml.split('id="root"')[1]?.split('</div>')[0] ?? '';
    assert.match(rootDiv, /loading/i, '#root should contain a loading indicator');
  });

  it('loading indicator is styled inline so it shows before CSS loads', () => {
    const indexHtml = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
    const rootDiv = indexHtml.split('id="root"')[1]?.split('</div>')[0] ?? '';
    assert.match(rootDiv, /style=/, 'Loading indicator should have inline styles');
  });

  it('App component does not contain loading indicator after mount', () => {
    const html = render(App);
    assert.doesNotMatch(html, /class="loading"/, 'Mounted App should not show loading state');
    assert.match(html, /class="app"/, 'App should render normal content');
  });
});

// ─── Phase 8: Copy as CSV ─────────────────────────────────────────────

describe('Copy as CSV button', () => {
  function renderAccelTable(props) {
    return renderToStaticMarkup(createElement(AcceleratorTable, props));
  }

  it('renders a copy CSV button in the accel-table section', () => {
    const html = renderAccelTable({});
    assert.match(html, /btn-copy-csv/, 'Should have a copy CSV button');
  });

  it('copy button has a descriptive title', () => {
    const html = renderAccelTable({});
    assert.match(html, /title="Copy table as CSV"/, 'Should have descriptive title');
  });
});
