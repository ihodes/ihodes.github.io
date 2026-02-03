Floppybird Implementation Plan

# Phase 1: Scaffold & Static Layout ✅

~~HTML/CSS/JS file structure~~ ✅ `index.html`, `style.css`, `app.js`
~~Tufte styling: serif font, off-white background, minimal borders~~ ✅ CSS custom properties, Georgia serif
~~Dark mode via prefers-color-scheme~~ ✅ CSS `prefers-color-scheme` media query
~~Placeholder sections for menubar, model spec, table~~ ✅ React components via htm (no build step)

Verify: Page loads, dark mode toggles automatically, typography looks right.

> **Note:** Uses React 18 + htm (tagged template JSX alternative). Browser loads deps via importmap (esm.sh CDN). Node tests use npm-installed packages. Components are static placeholders — state/interactivity comes in Phase 2+. 7 scaffold tests in `app.test.js`.

# Phase 2: Model Specification & FLOP Display

~~Calculator type dropdown (MoE / Dense / FLOP)~~ ✅ `useState` wired to `<select>`
~~Conditional input fields per type~~ ✅ MoE: active params + tokens, Dense: total params + tokens, FLOP: total FLOPs
~~FLOP calculation: 6 * P * T for both MoE and Dense~~ ✅ `calc.js: computeModelFlops()`
~~Scientific notation display with emoji thresholds~~ ✅ `calc.js: formatSci(), flopEmoji()`
~~Model name field with auto-naming fallback~~ ✅ Dynamic placeholder (e.g. "MoE 8B active 7T tokens")

Verify: Changing inputs updates FLOP display reactively. Emoji appears at extremes.

> **Note:** Phase 2 UI complete. `ModelSpec` uses `useState` for all inputs. `parseNum()` accepts scientific notation (e.g. `8e9`). Formula desc shown for MoE/Dense. 5 new tests in `app.test.js` (12 total).

# Phase 3: Accelerator Table (Read-Only)

~~Render table from accelerator data constant~~ ✅ `calc.js: ACCELERATORS, DEFAULT_VISIBLE`
~~Columns: name, BF16 FLOP/s, chips/pod, MFU, scaling factor, $/hr~~ ✅ wired in Phase 5
~~Info tooltips on column headers~~ ✅
~~Hide chips/pod column for NVIDIA rows~~ ✅ shows "—" for NVIDIA
~~Accelerator visibility toggles (checkboxes or similar)~~ ✅ checkbox row above table, `useState` tracks per-key visibility

Verify: Default 4 accelerators shown. Can toggle others on. Tooltips work.

> **Note:** Visibility toggles use `useState` initialized from `DEFAULT_VISIBLE`. All 8 accelerators shown as checkboxes; table body filters by checked state. Info tooltips use `COLUMN_TOOLTIPS` dict in `app.js` → `<span class="info-tip" title="...">ⓘ</span>` in each `<th>`. 3 tooltip tests added (43 total in `app.test.js`).

# Phase 4: Editable Cells ✅

~~MFU, scaling factor, $/hr become editable inputs~~ ✅
~~Track default vs. user-edited state per cell~~ ✅ `overrides` state in `AcceleratorTable`
~~Gray text for defaults, normal for edited~~ ✅ `.cell-default` / `.cell-edited` CSS classes
~~Reset button (↺) appears on edited cells~~ ✅ `.btn-reset` shown conditionally
~~Input validation (clamp or reject out-of-range)~~ ✅ MFU/scaling: min=0.01, max=1; cost: min=0

Verify: Edit a cell → turns normal color, reset appears. Reset → returns to gray default.

> **Note:** `AcceleratorTable` holds `overrides` state (`{ [accelKey]: { mfu?, scalingFactor?, costPerChipHour? } }`), passed to `computeResults()`. Column headers prefixed with `*` for editable columns. Number inputs hide spinners via CSS. 7 new tests (27 total in `app.test.js`).

# Phase 5: Results Calculation ✅

~~Iterative scaling penalty algorithm (converge within 1 chip)~~ ✅ `calc.js: computeChipsNeeded()`
~~Result columns: total HW FLOPs, then per time period (1d, 1w, 4w, 8w, custom):~~ ✅ `calc.js: computeResults()`

~~Chips needed~~ ✅
~~Pods needed (TPU rows only)~~ ✅
~~Total cost~~ ✅

~~Custom days input inline in header~~ ✅
~~Number formatting (commas, scientific notation where appropriate)~~ ✅ `formatSci()` + `toLocaleString('en-US')` for chip counts

~~Verify: Hand-calculate one example, compare.~~ ✅ 26 tests in `calc.test.js`, including hand-verified v5p example (73 chips, $171k @ 4wks).
~~Changing FLOP input updates all results~~ ✅ UI wired via lifted state in App.

> **Note:** Math + UI wired. `App` lifts `modelFlops`: `ModelSpec` reports via `onFlopChange` (`useEffect`), `AcceleratorTable` calls `computeResults()` per row. Result columns (HW FLOPs + chips/pods per period) render when FLOPs set. Custom days: `AcceleratorTable` holds `customDays` state, renders `<input class="custom-days-input">` in the header row (visible when results shown). Passed to `computeResults()` via `overrides.customDays` and to `generateCSV()` as 4th arg. Value persisted via `onTableStateChange`, restored via `initialCustomDays` prop. 5 new tests (113 total).

# Phase 6: Keyboard Shortcuts

~~n → focus name, m → focus model dropdown~~ ✅
~~s → open saved calcs modal~~ ✅ (action mapped; modal is Phase 7)
~~Shift+= → new calc~~ ✅ (action mapped; handler is Phase 7)
~~j/k → navigate modal list, Enter → select, Escape → close~~ ✅
~~Suppress shortcuts when focused on inputs~~ ✅
~~Escape → blur active element~~ ✅

Verify: All shortcuts work. Typing in an input doesn't trigger shortcuts.

> **Note:** `handleKeyboardShortcut(e)` is a pure function (exported, tested) that maps KeyboardEvent → action string. `App` wires it via `useEffect` + `document.addEventListener('keydown', ...)`. Modal-specific keys (j/k/ArrowDown/ArrowUp/Enter/Escape) handled in a separate branch when `modalOpen` is true. 10 new tests (63 total).

# Phase 7: Persistence & Saved Calcs

~~Auto-save current state to localStorage (debounced)~~ ✅
~~Load on page refresh~~ ✅
~~Saved calcs modal: infinite scroll, newest first~~ ✅
~~Pin/unpin calcs (pinned stay at top)~~ ✅
~~New calc: saves current, resets form~~ ✅
~~Delete saved calcs~~ ✅

Verify: Refresh retains state. Modal shows history. Pinning works.

> **Note:** `saveState()`/`loadState()` in `calc.js` (key: `floppybird_current`). `App` lifts state: `ModelSpec` reports via `onStateChange`, `AcceleratorTable` via `onTableStateChange`. Both accept `initialState`/`initialOverrides`/`initialVisible` props for restore. Debounced save (400ms) in `App` via `setTimeout`. Saved calcs list in `calc.js` (key: `floppybird_saved`): `saveCalcToList`, `deleteCalcFromList`, `togglePinCalc`, `getSortedCalcs`, `calcDisplayName`. `SavedCalcsModal` component renders list with pin/delete/select. `App` manages `modalOpen` state, `resetKey` for form reset, j/k/Enter/Esc nav in modal. Selecting a calc saves current first, loads selected, removes it from list. 22 new tests (96 total).

# Phase 8: Polish

~~Copy table as CSV button~~ ✅
~~Mobile responsiveness (table scrolls horizontally)~~ ✅
~~Accessibility: focus indicators, aria labels~~ ✅
~~Loading state during hydration~~ ✅

Verify: CSV pastes correctly into spreadsheet. Usable on phone. Tab navigation logical.

> **Note:** `generateCSV()` in `calc.js` is a pure function (tested) that builds CSV from visible keys, overrides, and modelFlops. `AcceleratorTable` has a `btn-copy-csv` button in a new toolbar div (`.accel-table-toolbar`) that calls `navigator.clipboard.writeText()`. Button shows "Copied!" feedback for 1.5s. Mobile: `@media (max-width: 600px)` breakpoint in `style.css` adjusts padding/font sizes. Table has `min-width: 700px` + `overflow-x: auto` for horizontal scroll. `calc-inputs` uses `flex-wrap` so fields stack on narrow screens. Accessibility: `aria-label` on all buttons, inputs, select, and table. Modal has `role="dialog"`, `aria-modal="true"`, `aria-labelledby`. FLOP display uses `aria-live="polite"`. `:focus-visible` outlines on all interactive elements replace removed `outline: none`. Loading state: inline-styled `<p class="loading">` inside `#root` in `index.html`; React's `createRoot().render()` replaces it on mount. 3 new hydration tests (137 total).