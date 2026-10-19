# ⚡ Industrial Electrical Room — 3D Layout Editor

> A browser-based 3D electrical-room layout editor built for the **Cloudworx Frontend Assessment**.

**🌐 Live Demo:** [room-layout-editor.vercel.app](https://room-layout-editor.vercel.app/)

---

## 1. 🏭 What is the project?

A 3D workspace for designing an industrial electrical room.

Users can place and edit:

- 🗄️ Control Cabinets
- ⚙️ Motors
- 🔌 Electrical Panels

The editor supports **placement, 0.5 m grid snapping, selection, movement, rotation, deletion, undo/redo, clearance validation, wiring, BOM, 2D plan view, and English/Vietnamese support.**

**Room:** `20 × 12 m` &nbsp; **Grid:** `0.5 m`

---

## 2. 🛠️ How I built it

I designed the **industrial-room UI and scene myself** and built the application using:

`React` · `TypeScript` · `React Three Fiber` · `Three.js`

### 3D Asset Workflow

The original GLB models were heavy, so I prepared them for browser use:

```text
Original GLB
    ↓
Model optimization
    ↓
Geometry / asset reduction
    ↓
Draco compression
    ↓
Web-ready GLB
    ↓
React Three Fiber
```

The scene uses centralized state for **equipment, selection, wires and undo/redo**, keeping the 3D scene, item list and properties panel synchronized.

---

## 3. 📊 Requirements & Results

| Requirement | Result |
|---|:---:|
| Room | **20 × 12 m** |
| Grid | **0.5 m** |
| Equipment types | **3** |
| Place / Move / Rotate / Delete | ✅ |
| Undo / Redo | ✅ |
| Selection + Properties sync | ✅ |
| Clearance rule | **< 0.6 m** |
| BOM | ✅ |
| English / Vietnamese | ✅ |
| Wiring | ✅ |
| 2D Plan | ✅ |
| Performance test | **500 items** |

### 🚀 500-Item Performance

| Metric | Measured |
|---|---:|
| Placed items | **500** |
| FPS | **76 FPS** |
| Draw calls | **101** |
| Memory | **18 / 24 MB** |

**Result:** 500 placed items maintained **76 FPS** with only **101 draw calls**, exceeding the **50 FPS** target and staying below the **300 draw-call** target.

---

## 4. 🤖 AI Tools Used

I used **ChatGPT, Claude and Grok** as development assistants for:

- Understanding and breaking down the assessment
- Debugging React / Three.js issues
- Exploring implementation approaches
- Model optimization and compression discussions
- Reviewing UI and code decisions

The **final UI, scene design and implementation decisions were mine**, and I integrated and tested the resulting code in the project.

---

### 💻 Tech Stack

`React` `TypeScript` `Vite` `Three.js` `React Three Fiber` `Redux` `GLB/glTF` `Draco` `Vercel`

