# Room layout editor (Part B)

React + TypeScript + React Three Fiber + Zustand, built with Vite.

## Run
    npm install
    npm run dev      # http://localhost:5173
    npm run build    # type-check + production build

## Use
Pick a type in the palette, click the floor to place it (snaps to the 0.5 m grid). Drag to move, `R` rotate,
`Delete` remove, arrow keys move one cell, `Ctrl/Cmd+Z` undo, `Ctrl+Y` or `Ctrl+Shift+Z` redo, `Esc` deselect.
The list, properties panel and 3D view share one selection. Items closer than 0.6 m turn pink and the right panel
names both. "Add 500 items" fills the scene for the frame-rate test. The bill of materials counts from the scene;
use the language button for English / Vietnamese.

## Design notes
- `store.ts` holds all state. Every edit is one history entry (`label`, `before`, `after`); dragging changes items
  transiently and records a single entry on pointer-up. Items are immutable, so history shares structure.
- The clearance rule is a pure function (`violations`) over the item list, O(n²), fine at 500 items; use a spatial hash at 10,000.
- Items are box primitives with realistic footprints. No glTF models are used (nothing to cite).
- A hidden `aria-live` region announces each edit.

## Measured performance (fill in before submitting)
500 items: ___ fps, ___ draw calls on ___ (CPU/GPU, browser, 1080p). Read it from the header readout.
Every item is currently its own mesh (about 500 draw calls); instancing per kind would cut that to 3.

## Not done
glTF optimisation, instancing, embedded mode, assistant preview, multi-select.

## AI tools used
Claude (Anthropic) generated the initial scaffold from the assessment brief. Replace this with your own account of
how you used it and what you changed.
