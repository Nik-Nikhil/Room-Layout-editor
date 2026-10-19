# Industrial Electrical Room – 3D Layout Editor

**Live Demo:** https://room-layout-editor.vercel.app/

## 1. What is the project?

This is a browser-based 3D electrical room layout editor built for the Cloudworx frontend assessment.

The main idea is to let a user place electrical equipment in a room and arrange it easily. The project includes three equipment types:

- Control Cabinet
- Motor
- Electrical Panel

The room is **20 × 12 m** with a **0.5 m grid**.

The editor supports placing, selecting, moving, rotating and deleting equipment. It also includes undo/redo, clearance checking, wiring, a BOM, 2D plan view and English/Vietnamese support.

## 2. How I built it

I designed the UI and the overall 3D scene myself. I wanted it to feel like a simple industrial tool rather than a basic Three.js demo.

I built the application using:

- React
- TypeScript
- React Three Fiber
- Three.js
- Redux
- Vite

The original GLB models were quite large, so I optimized them and used **Draco compression** to make them smaller and more suitable for a browser application.

The main scene state contains the placed equipment, selected item, wires and undo/redo history. This keeps the 3D scene, equipment list and properties panel in sync.

The editor also checks the distance between equipment. If two items are closer than **0.6 m**, they are treated as a clearance violation.

## 3. Requirements and results

| Requirement | Result |
|---|---|
| Room size | 20 × 12 m |
| Grid | 0.5 m |
| Equipment types | 3 |
| Place / Move / Rotate / Delete | ✅ |
| Undo / Redo | ✅ |
| Selection + Properties sync | ✅ |
| Clearance check | < 0.6 m |
| BOM | ✅ |
| English / Vietnamese | ✅ |
| Wiring | ✅ |
| 2D Plan | ✅ |

### 500-item performance test

I tested the scene with **500 placed items**.

- **FPS:** 76
- **Draw calls:** 101
- **Memory:** 18 / 24 MB

The result was above the assessment target of **50 FPS** and below the **300 draw-call** target.

## 4. AI tools used

I used **ChatGPT, Claude and Grok** as development assistants during the project.

They helped me with:

- Understanding the assessment requirements
- Debugging React and Three.js issues
- Discussing implementation approaches
- Model optimization and compression
- Reviewing parts of the code and UI

I made the final decisions for the **UI, scene design and implementation**, and integrated and tested the final application myself.

## Tech Stack

**React · TypeScript · React Three Fiber · Three.js · Redux · GLB/glTF · Draco · Vite · Vercel**