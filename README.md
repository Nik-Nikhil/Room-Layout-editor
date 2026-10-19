# Electrical Room Layout Editor

A browser-based 3D layout tool for planning electrical rooms. You drag equipment around a floor plan, check clearances, draw wires, and get a live cost estimate — all without leaving the tab.

Built with React, Three.js, and Redux Toolkit. No backend needed.

---

## What it does

- **3D room** with textured walls, ceiling lights, and a grid floor that auto-scales to fit your layout
- **Three equipment types** — Control Cabinet, Motor, Electrical Panel — each as a real GLB model
- **Drag and drop** placement directly on the floor; items snap to a 0.5 m grid
- **Clearance checker** flags any two items closer than 0.6 m apart, highlights them red
- **Wiring tool** — click two items to connect them with a routed cable that avoids obstacles; cables show their length
- **Undo / Redo** with full history (Ctrl+Z / Ctrl+Y)
- **Keyboard shortcuts**: Arrow keys to nudge, R to rotate 90°, Delete to remove
- **Stress test** — load 500, 1 000, or 2 000 items in one click; the room grows automatically to fit
- **Cost estimate** in USD, INR, and VND with per-kind breakdown
- **Camera views** — Isometric, Top, Front, Back, Left, Right with a smooth glide animation
- **Dark / Light theme** toggle
- **English / Vietnamese** UI

---

## Getting started

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`.

To build for production:

```bash
npm run build
```

The output lands in `dist/`. It's a fully static site — just serve the folder.

---

## Project structure

```
src/
  App.tsx                   # Root component, 3D scene, camera, keyboard wiring
  main.tsx                  # Entry point
  lib/
    store.ts                # Redux state — items, wires, room size, undo history
    violations.ts           # Clearance check (spatial hash, O(n) in practice)
    i18n.ts                 # English + Vietnamese strings
  components/
    scene/
      Items.tsx             # Instanced mesh renderer for all placed equipment
    panels/
      LeftPanel.tsx         # Equipment palette, wiring toggle, item list, load buttons
      RightPanel.tsx        # Clearance report, selection inspector, room size, cost
      SelectionPanel.tsx    # Detail editor for a selected item or wire
  styles/
    index.css               # Tailwind base + global tokens
    theme.css               # CSS variable definitions for dark/light themes
public/
  models/                   # GLB models + PNG thumbnails for each equipment type
```

---

## Key decisions

### State

Everything lives in a single Redux slice (`store.ts`). Components read it through a `useStore()` hook that wraps `useSyncExternalStore` — no Provider needed, and non-React code (pointer handlers, keyboard listeners) can call `useStore.getState()` directly.

Undo/redo is a plain array of `{ before, after }` snapshots. Each action that modifies items or wires pushes an entry. Drag moves are coalesced — only the final resting position goes into history, not every intermediate step.

### Rendering

Items use **instanced meshes** — one draw call per sub-mesh per equipment type, regardless of how many items are placed. At 2 000 items this keeps the renderer well under 100 draw calls.

GLB models are baked into plain `BufferGeometry` on load: the world transform is folded in, quantized attributes are expanded to `Float32`, and the geometry is centered with its base at y = 0. After that the instanced renderer just sets position/rotation matrices per frame.

### Grid

The floor is a single `ShaderMaterial` plane. The fragment shader draws three grid levels (0.5 m minor, 2.5 m mid, 5 m major) with `fwidth`-based LOD fading so lines disappear gracefully when the camera is far away. A 2.5 m checkerboard tint gives subtle depth without aliasing at oblique angles.

### Room auto-sizing

When you load N items, `addMany` computes the smallest roughly-square room that fits them all on a 0.5 m grid with 0.6 m clearance gaps. It uses a spatial hash to check each candidate slot against existing items — including slots already claimed in the same batch — so items never overlap even at 2 000.

### Wiring

Each wire finds a path between two items by trying a set of axis-aligned detour lanes, checking each against a bounding-box-filtered list of obstacles. Corners are rounded with quadratic Bézier curves. The resulting path is a `TubeGeometry`. A wider invisible hit tube sits on top to make the wire easy to click.

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `R` | Rotate selected item 90° |
| `Delete` / `Backspace` | Remove selected item |
| Arrow keys | Nudge selected item by one grid cell |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Escape` | Cancel placement / deselect |

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `@react-three/fiber` | React renderer for Three.js |
| `@react-three/drei` | OrbitControls, Html overlay, GLB loader |
| `three` | 3D engine |
| `@reduxjs/toolkit` | State management |
| `lucide-react` | Icons |
| `tailwindcss` | Utility CSS |

---

## What was built / fixed during development

1. **Initial 3D scene** — room walls, grid floor shader, GLB model loading with instanced rendering
2. **Drag and drop** — pointer events on a transparent floor plane, snapping to grid, undo history
3. **Clearance violations** — spatial hash replaces the original O(n²) loop; runs in real time during drag
4. **Wiring** — obstacle-avoiding path routing with Bézier corners, length labels, color picker
5. **Load buttons** — 500 / 1 000 / 2 000 preset targets; a button is enabled when the current count is below the target, highlighted when exactly at it, and grayed when past it. The custom input validates against the current count and shows an inline error instead of silently disabling.
6. **addMany bug fix** — the slot-filling loop now inserts each accepted slot into the spatial hash immediately, so two items in the same batch can never overlap each other. Kind sequence counters are snapshotted and restored on each room-grow retry so item numbers don't have gaps.
7. **clearScene fix** — stopped resetting kind counters on clear, which caused duplicate item numbers after undo
8. **Room size cap raised** to 200 × 200 m so 2 000 items always fit (~88 × 88 m needed)
9. **Grid shader fix** — anti-aliased checker pattern using `fwidth`, polygon offset to prevent Z-fighting with the slab
10. **Camera** — `maxDistance` raised to 500, `far` plane to 3 000 so large rooms don't clip
11. **Dark/light theme** and English/Vietnamese i18n wired through CSS variables
