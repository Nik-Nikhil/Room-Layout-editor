Industrial Electrical Room — 3D Layout Editor

Live Demo: https://room-layout-editor.vercel.app/

1. What is the project?

A browser-based 3D electrical-room layout editor built for the Cloudworx frontend assessment.
Users can place and edit equipment such as Control Cabinets, Motors and Electrical Panels on a 20 × 12 m room with a 0.5 m grid. The editor also provides selection, movement, rotation, deletion, undo/redo, clearance validation, wiring, BOM, 2D plan view and English/Vietnamese support.


2. How I built it?

I designed the industrial-room UI and scene myself , then built it with React + TypeScript, React Three Fiber and Three.js.
The equipment models were prepared for web use by optimizing the original GLB files and applying Draco compression, reducing the heavy source assets to much smaller browser-ready models.
The scene uses centralized state for equipment, selection, wires and undo/redo. The 3D view, item list and properties panel stay synchronized through the same scene state.

3. Requirements & Results

Requirement	Result
Room	20 × 12 m
Grid	0.5 m
Equipment types	3
Placement / Move / Rotate / Delete	✅
Undo / Redo	✅
Selection + Properties sync	✅
Clearance rule	< 0.6 m
BOM	✅
English / Vietnamese	✅
Wiring	✅
2D Plan	✅
Performance test	500 items
FPS	76 FPS
Draw calls	101
Memory	18 / 24 MB


500-item performance
With 500 placed items, the scene maintained 76 FPS and 101 draw calls, exceeding the assessment target of 50 FPS and staying below the 300 draw-call target.


4. AI Tools Used
I used ChatGPT, Claude and Grok as development assistants for:
- Understanding and breaking down the assessment
- Debugging React / Three.js issues
- Exploring implementation approaches
- Model optimization and compression discussions
- Reviewing UI and code decisions


I made the final UI, scene and implementation decisions and integrated the resulting code into the project.