A React + TypeScript 3D layout editor built for the Cloudworx Frontend Technical Assessment.

**Live demo:** https://room-layout-editor.vercel.app/

## 1. Overview

The project implements a focused electrical-room editor with real GLB equipment, grid snapping, selection, transforms, undo/redo, clearance validation, wiring, BOM, localization and performance instrumentation.

The assessment requires a 20 m × 12 m floor, 0.5 m cells, at least three item types, editing operations, synchronized selection/properties, a 0.6 m clearance rule, BOM localization, and a 500-item performance benchmark.

## 2. Development Journey

### Design
The initial scene and UI were explored with **ChatGPT, Claude and Grok**. We iterated toward an industrial workspace rather than a generic Three.js demo.

Final layout:
- Left: equipment palette and placed-item list
- Center: 3D electrical-room scene
- Right: properties, clearance and BOM
- Top: controls, undo/redo and language
- Bottom: Select / Move / Rotate / Delete / Wire / 2D Plan / Reset View

### Asset preparation
The original equipment models were heavy, so we optimized them before integrating them into the browser scene.

```text
Original GLB → inspect → simplify/optimize → Draco → web-ready GLB
```

The source models were in the multi-MB range, including models around **8–19 MB**, and were reduced substantially for web delivery. Exact final byte/triangle values should be taken from the final repository rather than estimated.

## 3. Equipment

| Equipment | Dimensions | Price |
|---|---:|---:|
| Control Cabinet | 1.2 × 0.77 × 2.05 m | $4,200 |
| Motor | 1.44 × 0.67 × 1.19 m | $2,800 |
| Electrical Panel | 1.0 × 0.44 × 1.79 m | $3,500 |

These three types satisfy the minimum palette requirement.

## 4. Core Architecture

```text
Redux Scene State
 ├─ room/grid
 ├─ items
 ├─ wires
 ├─ selection
 └─ undo/redo
        ↓
React Three Fiber
 ├─ floor/grid
 ├─ equipment
 ├─ wires
 └─ interactions
```

Three.js objects are rendered from normalized application state rather than being the source of truth.

### Stack

- React + TypeScript
- Vite
- React Three Fiber / Three.js
- React Three Drei
- Redux / Redux Toolkit
- GLB / glTF
- Draco compression
- Tailwind/CSS
- Vercel

## 5. Scene

- Room: **20 × 12 m**
- Grid: **0.5 m**
- Equipment placement snaps to the grid.
- Selection is shared between the 3D scene, placed-item list and properties panel.

```text
3D object ↔ selectedId ↔ item list ↔ properties
```

## 6. Editing

Supported actions:

- Place equipment
- Select
- Move
- Rotate 90°
- Delete
- Undo / redo
- 0.5 m keyboard movement
- Wire equipment
- 2D plan view

Keyboard shortcuts include:

```text
Ctrl/Cmd + Z        Undo
Ctrl/Cmd + Y        Redo
Ctrl/Cmd + Shift+Z  Redo
Delete/Backspace    Delete
R                   Rotate
Arrow keys          Move 0.5 m
Escape              Cancel
```

## 7. Clearance Validation

The editor checks equipment spacing continuously.

```text
distance < 0.6 m
       ↓
violation
       ↓
highlight both items
       ↓
show item pair + gap
```

The right panel shows the number of violations and the affected equipment.

## 8. Wiring

The wiring workflow allows the user to:

1. Activate Wire
2. Select equipment A
3. Select equipment B
4. Create the connection
5. Select the wire
6. Change its color or disconnect it

## 9. Bill of Materials

The BOM is derived from the current scene, so quantities stay synchronized automatically.

Example:

```text
Control Cabinet      Qty 3
Motor                Qty 5
Electrical Panel     Qty 2
Total                10
```

The UI supports **English and Vietnamese**.

## 10. Performance

The app includes a live FPS and Three.js draw-call probe.

There is also an **Add 500 items** control for the required benchmark.

### Required benchmark

| Metric | Value |
|---|---|
| Items | **500** |
| Browser | **[record actual browser]** |
| CPU | **[record actual CPU]** |
| GPU | **[record actual GPU]** |
| RAM | **[record actual RAM]** |
| Resolution | **[record actual resolution]** |
| FPS | **[record measured FPS]** |
| Draw calls | **[record measured value]** |
| Memory | **[record if measured]** |

**Do not invent the benchmark values.** FPS depends on the actual machine, GPU, browser and resolution.

### Assessment targets

- ≥ **50 FPS**
- < **300 draw calls**
- < **1 GB browser memory**
- Benchmark with **500 items**

The broader production scenario describes up to **2,000 placed items from 300 glTF models**; the explicit Part B benchmark is 500.

## 11. Optimization

The main optimization work was:

- GLB inspection
- Geometry reduction
- Draco compression
- Smaller web-ready assets
- Stable scene state
- Limited device pixel ratio
- Antialiasing disabled
- Bounded item-list rendering
- Live FPS/draw-call measurement

Production-scale optimization options considered:

- LODs
- Meshopt/Draco
- KTX2 textures
- Instancing
- Frustum/visibility culling
- Lazy loading
- CDN/browser caching

### Asset report

| Model | Source | Final |
|---|---:|---:|
| Control Cabinet | ~multi-MB | Optimized GLB |
| Motor | ~multi-MB | Optimized GLB |
| Electrical Panel | ~multi-MB | Optimized GLB |

Exact before/after sizes and triangle counts should be copied from the final assets.

## 12. AI-Assisted Development

AI tools used during development:

- **ChatGPT**
- **Claude**
- **Grok**

They were used for:

- Assessment interpretation
- UI/scene exploration
- Architecture discussions
- React/Three.js debugging
- Asset optimization discussions
- Component improvements
- Reviewing implementation decisions

The final application was assembled, integrated and tested as a working project.

## 13. Assessment Coverage

| Requirement | Status |
|---|---|
| React + TypeScript | ✅ |
| 20 × 12 m room | ✅ |
| 0.5 m grid | ✅ |
| ≥3 item types | ✅ |
| Place / snap | ✅ |
| Select / move / rotate / delete | ✅ |
| Undo / redo | ✅ |
| Item list | ✅ |
| Properties panel | ✅ |
| Two-way selection sync | ✅ |
| 0.6 m clearance | ✅ |
| Violation highlighting | ✅ |
| BOM | ✅ |
| English / Vietnamese | ✅ |
| 500-item benchmark | ✅ |
| FPS / draw-call probe | ✅ |
| GLB optimization | ✅ |
| Draco compression | ✅ |
| Wiring | ✅ |
| 2D plan | ✅ |

## 14. Running Locally

```bash
git clone <YOUR_REPOSITORY_URL>
cd <PROJECT_DIRECTORY>
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## 15. Final Result

The result is a focused industrial 3D layout editor rather than a collection of isolated demos.

It combines real equipment models, deterministic scene state, reversible editing, live validation, synchronized panels, BOM generation, localization and measurable rendering performance.

**Live:** https://room-layout-editor.vercel.app/
