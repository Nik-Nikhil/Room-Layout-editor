import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import { Activity, Grid3x3, Ruler, Boxes, Undo2, Redo2, Cpu } from 'lucide-react'
import * as THREE from 'three'
import { useEffect, useMemo, useRef, Suspense, useState, useCallback } from 'react'
import {
  useStore, GRID, ROOM_LIMITS, snap, violations,
  WIRE_COLORS, footprint,
  type Item, type Kind, type Wire,
} from './lib/store'
import { T } from './lib/i18n'
import { Items } from './components/scene/Items'
import RightPanel from './components/panels/RightPanel'
import LeftPanel from './components/panels/LeftPanel'

// ─── Wiring geometry ──────────────────────────────────────────────────────────
// Builds a proper 3D tube that runs in right-angle legs with rounded elbows.

const WIRE_RADIUS = 0.06   // thick enough to be clearly visible as a tube
const WIRE_Y      = 0.045  // sits just on top of the floor

interface WireRoute {
  path:   THREE.CurvePath<THREE.Vector3>   // straight legs joined by rounded bends
  length: number
  mid:    THREE.Vector3
  start:  THREE.Vector3
  end:    THREE.Vector3
}

type P2 = [number, number]   // (x, z) on the floor

// Does an axis-aligned leg p→q pass through this item's footprint (plus the cable's clearance)?
function legHitsItem(p: P2, q: P2, it: Item): boolean {
  const f = footprint(it), m = WIRE_RADIUS + 0.1
  const ox = Math.min(Math.max(p[0], q[0]), it.x + f.w / 2 + m) - Math.max(Math.min(p[0], q[0]), it.x - f.w / 2 - m)
  const oz = Math.min(Math.max(p[1], q[1]), it.z + f.d / 2 + m) - Math.max(Math.min(p[1], q[1]), it.z - f.d / 2 - m)
  return ox > 0 && oz > 0   // real overlap on both axes (a leg is a zero-width box on its own axis)
}

const pathClear = (pts: P2[], others: Item[]) =>
  others.every((o) => pts.every((p, i) => i === 0 || !legHitsItem(pts[i - 1], p, o)))

// Cable routing, like an electrician would run it on the floor:
//  1. leave the face of item A that looks towards B, from the middle of that face, and enter B the same way;
//  2. run in right-angle legs only (a "Z": out, across on a lane, in), never diagonally;
//  3. pick the lane nearest the middle that does not cross any other item;
//  4. round every bend.
function buildWireRoute(a: Item, b: Item, all: Item[]): WireRoute {
  const fa = footprint(a), fb = footprint(b)
  const dx = b.x - a.x, dz = b.z - a.z
  const gapX = Math.abs(dx) - (fa.w + fb.w) / 2
  const gapZ = Math.abs(dz) - (fa.d + fb.d) / 2
  const horizontal = gapX >= gapZ                       // items are mainly side by side, otherwise front to back
  const sx = Math.sign(dx) || 1, sz = Math.sign(dz) || 1

  const S: P2 = horizontal ? [a.x + sx * fa.w / 2, a.z] : [a.x, a.z + sz * fa.d / 2]
  const E: P2 = horizontal ? [b.x - sx * fb.w / 2, b.z] : [b.x, b.z - sz * fb.d / 2]
  const others = all.filter((i) => i.id !== a.id && i.id !== b.id)

  // lane = the coordinate (x for horizontal runs, z for vertical) where the cable crosses over
  const i0 = horizontal ? 0 : 1, i1 = 1 - i0
  const lo = Math.min(S[i0], E[i0]), hi = Math.max(S[i0], E[i0])
  const mk = (lane: number): P2[] => {
    const p1: P2 = [0, 0], p2: P2 = [0, 0]
    p1[i0] = lane; p1[i1] = S[i1]
    p2[i0] = lane; p2[i1] = E[i1]
    return [S, p1, p2, E]
  }
  let pts: P2[]
  if (Math.abs(S[i1] - E[i1]) < 0.01) pts = [S, E]       // already in line: one straight run
  else {
    const mid = (lo + hi) / 2, span = hi - lo
    const lanes = [mid]
    for (let k = 1; k <= 24; k++) {
      const d = k * GRID.cell * 0.5
      if (d <= span / 2 - 0.05) lanes.push(mid + d, mid - d)
    }
    pts = mk(lanes.find((l) => pathClear(mk(l), others)) ?? mid)
  }

  // drop duplicate / collinear points
  const clean: P2[] = []
  for (const q of pts) {
    const prev = clean[clean.length - 1]
    if (prev && Math.hypot(q[0] - prev[0], q[1] - prev[1]) < 1e-4) continue
    clean.push(q)
  }
  const V = clean.map(([x, z]) => new THREE.Vector3(x, WIRE_Y, z))

  // straight legs + a quadratic fillet at every corner
  const path = new THREE.CurvePath<THREE.Vector3>()
  let cur = V[0]
  for (let i = 1; i < V.length - 1; i++) {
    const c = V[i], d1 = c.clone().sub(V[i - 1]), d2 = V[i + 1].clone().sub(c)
    const r = Math.min(0.3, d1.length() / 2 - 0.001, d2.length() / 2 - 0.001)
    if (r <= 0.02) continue
    const p = c.clone().sub(d1.normalize().multiplyScalar(r)), q = c.clone().add(d2.normalize().multiplyScalar(r))
    if (cur.distanceTo(p) > 1e-4) path.add(new THREE.LineCurve3(cur, p))
    path.add(new THREE.QuadraticBezierCurve3(p, c, q))
    cur = q
  }
  const last = V[V.length - 1]
  if (cur.distanceTo(last) > 1e-4) path.add(new THREE.LineCurve3(cur, last))

  const length = path.getLength()
  const mid = path.getPointAt(0.5); mid.y = WIRE_Y + 0.18
  return { path, length, mid, start: V[0], end: last }
}

// ─── WireRun ──────────────────────────────────────────────────────────────────

function WireRun({ a, b, all, wireId, color, isSelected, bad, selectedId, onSelectWire }: {
  a: Item; b: Item; all: Item[]; wireId: string; color: string
  isSelected: boolean; bad: boolean; selectedId: string | null
  onSelectWire: (id: string) => void
}) {
  const route = useMemo(
    () => buildWireRoute(a, b, all),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [a.x, a.z, a.kind, a.rot, b.x, b.z, b.kind, b.rot, all],
  )

  // One tube along the whole route (one draw call), and a fatter invisible one to click on
  const { merged, hit } = useMemo(() => {
    const segs = Math.max(8, Math.ceil(route.length * 12))
    return {
      merged: new THREE.TubeGeometry(route.path, segs, WIRE_RADIUS, 8, false),
      hit:    new THREE.TubeGeometry(route.path, Math.max(4, Math.ceil(route.length * 3)), 0.16, 6, false),
    }
  }, [route])

  useEffect(() => () => { merged.dispose(); hit.dispose() }, [merged, hit])

  const showLabel = isSelected || selectedId === a.id || selectedId === b.id

  return (
    <group>
      {/* Main tube */}
      <mesh geometry={merged}>
        <meshStandardMaterial
          color={color} roughness={0.35} metalness={0.2}
          emissive={color} emissiveIntensity={isSelected ? 0.6 : 0.18}
        />
      </mesh>

      {/* End caps */}
      {([route.start, route.end] as THREE.Vector3[]).map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[WIRE_RADIUS * 1.5, 10, 10]} />
          <meshStandardMaterial
            color={color} roughness={0.35} metalness={0.2}
            emissive={color} emissiveIntensity={isSelected ? 0.6 : 0.18}
          />
        </mesh>
      ))}

      {/* Invisible hit area */}
      <mesh geometry={hit}
        onPointerDown={(e) => { e.stopPropagation(); onSelectWire(wireId) }}>
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Distance label */}
      {showLabel && (
        <Html position={[route.mid.x, route.mid.y, route.mid.z]} center
          style={{ pointerEvents: 'none' }}>
          <div style={{
            background: bad ? 'rgba(214,51,108,0.9)' : 'rgba(20,30,50,0.85)',
            color: '#fff', fontSize: '11px', fontWeight: 600,
            padding: '2px 8px', borderRadius: '8px', whiteSpace: 'nowrap',
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
            border: bad ? '1px solid #d6336c' : '1px solid rgba(255,255,255,0.18)',
          }}>
            {route.length.toFixed(1)} m
          </div>
        </Html>
      )}
    </group>
  )
}

// ─── Wires ────────────────────────────────────────────────────────────────────

function Wires({ items, wires, badIds, selectedWireId, selectedId, onSelectWire }: {
  items: Item[]; wires: Wire[]; badIds: Set<string>
  selectedWireId: string | null; selectedId: string | null
  onSelectWire: (id: string) => void
}) {
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  return (
    <>
      {wires.map((wire) => {
        const a = itemMap.get(wire.fromId), b = itemMap.get(wire.toId)
        if (!a || !b) return null
        const bad = badIds.has(wire.fromId) || badIds.has(wire.toId)
        const color = bad ? '#d6336c' : (wire.color ?? WIRE_COLORS[0].hex)
        return (
          <WireRun
            key={wire.id}
            a={a} b={b} all={items}
            wireId={wire.id}
            color={color}
            isSelected={wire.id === selectedWireId}
            bad={bad}
            selectedId={selectedId}
            onSelectWire={onSelectWire}
          />
        )
      })}
    </>
  )
}

// ─── Room (generated from the size in the store) ─────────────────────────────
// Epoxy floor drawn by a shader grid (0.5 m cells, heavier every 2.5 m and 5 m, crisp at any zoom),
// a yellow safety border, a two-tone back/side wall with skirting and a trunking rail, pilasters
// every 5 m and a row of light strips. The front is open for the camera.

const WALL_H = 3.4, WALL_T = 0.2

const GRID_VERT = /* glsl */`
  varying vec2 vXZ;
  void main() { vXZ = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const GRID_FRAG = /* glsl */`
  varying vec2 vXZ;
  uniform vec2  uSize;
  uniform float uCell;
  float gridLine(float c, float spacing, float px) {
    float u = c / spacing;
    float d = abs(fract(u - 0.5) - 0.5) / max(fwidth(u), 1e-5);
    return 1.0 - clamp(d - (px - 1.0) * 0.5, 0.0, 1.0);
  }
  void main() {
    vec2 p = vXZ;                                     // metres from the room centre
    vec3 col = vec3(0.80, 0.82, 0.84);                // epoxy base
    vec2 tile = floor((p + uSize * 0.5) / 2.5);        // 2.5 m panels, very subtle checker
    col -= 0.018 * mod(tile.x + tile.y, 2.0);
    // fade to a soft vignette towards the walls
    vec2 e = (uSize * 0.5 - abs(p)) / 2.0;
    col *= 0.93 + 0.07 * clamp(min(e.x, e.y), 0.0, 1.0);

    float minor = max(gridLine(p.x, uCell, 1.0), gridLine(p.y, uCell, 1.0));
    float mid   = max(gridLine(p.x, 2.5, 1.3),  gridLine(p.y, 2.5, 1.3));
    float major = max(gridLine(p.x, 5.0, 1.8),  gridLine(p.y, 5.0, 1.8));
    col = mix(col, vec3(0.55, 0.62, 0.68), minor * 0.38);
    col = mix(col, vec3(0.36, 0.48, 0.58), mid * 0.55);
    col = mix(col, vec3(0.16, 0.36, 0.52), major * 0.85);
    gl_FragColor = vec4(col, 1.0);
  }
`

function GridFloor({ W, D }: { W: number; D: number }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: GRID_VERT, fragmentShader: GRID_FRAG,
    uniforms: { uSize: { value: new THREE.Vector2(W, D) }, uCell: { value: GRID.cell } },
  }), [])   // eslint-disable-line react-hooks/exhaustive-deps
  mat.uniforms.uSize.value.set(W, D)
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, 0]} material={mat}>
      <planeGeometry args={[W, D]} />
    </mesh>
  )
}

function Box({ pos, size, color, rough = 0.9, metal = 0, emissive }: {
  pos: [number, number, number]; size: [number, number, number]; color: string
  rough?: number; metal?: number; emissive?: string
}) {
  return (
    <mesh position={pos} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={rough} metalness={metal}
        emissive={emissive ?? '#000000'} emissiveIntensity={emissive ? 1.4 : 0} />
    </mesh>
  )
}

// A wall that hides itself while the camera is on its outer side, so orbiting round the back or the
// sides never leaves you looking at a blank wall instead of the room.
function Wall({ outside, children }: { outside: (cam: THREE.Vector3) => boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null!)
  useFrame(({ camera }) => { if (ref.current) ref.current.visible = !outside(camera.position) })
  return <group ref={ref}>{children}</group>
}

const C_DADO = '#56626d', C_WALL = '#d3dae0', C_TRIM = '#3f4850', C_RAIL = '#aab4bc'

// One wall design, used for all three walls. Built in local space: it runs along local x, its room-facing
// side is local +z and the wall is T thick behind that. `len` is the full wall length (corner posts
// included), `inner` the clear length along the room.
function WallAssembly({ len, inner }: { len: number; inner: number }) {
  const T = WALL_T, DADO = 1.1, hi = inner / 2
  const pilasters = useMemo(() => {
    const xs: number[] = []
    for (let x = -Math.floor(hi / 5) * 5; x <= hi + 1e-6; x += 5) if (Math.abs(x) < hi - 0.3) xs.push(x)
    return xs
  }, [hi])
  const lights = useMemo(() => {
    const n = Math.max(2, Math.round(inner / 4)), xs: number[] = []
    for (let i = 0; i < n; i++) xs.push(-hi + (inner / n) * (i + 0.5))
    return xs
  }, [inner, hi])
  const zc = -T / 2   // wall body centre; room face at z = 0

  return (
    <>
      <Box pos={[0, DADO / 2, zc]} size={[len, DADO, T]} color={C_DADO} />
      <Box pos={[0, DADO + (WALL_H - DADO) / 2, zc]} size={[len, WALL_H - DADO, T]} color={C_WALL} />
      <Box pos={[0, WALL_H + 0.05, zc]} size={[len, 0.1, T]} color={C_TRIM} />
      <Box pos={[0, 0.09, 0.04]} size={[inner, 0.18, 0.08]} color={C_TRIM} />                                    {/* skirting */}
      <Box pos={[0, DADO + 0.02, 0.03]} size={[inner, 0.05, 0.06]} color={C_RAIL} metal={0.4} rough={0.4} />     {/* dado rail */}
      <Box pos={[0, 2.55, 0.07]} size={[Math.max(inner - 0.4, 0.5), 0.16, 0.12]} color="#8b96a0" metal={0.5} rough={0.45} /> {/* trunking */}
      {lights.map((x) => <Box key={x} pos={[x, WALL_H - 0.3, 0.06]} size={[1.6, 0.07, 0.07]} color="#fffbe8" emissive="#fff3c4" />)}
      {pilasters.map((x) => <Box key={x} pos={[x, WALL_H / 2, 0.07]} size={[0.28, WALL_H, 0.14]} color="#c3cbd2" />)}
    </>
  )
}

function ElectricalRoom({ W, D }: { W: number; D: number }) {
  const hw = W / 2, hd = D / 2, T = WALL_T
  return (
    <>
      {/* Thick opaque slab so models never show through from below */}
      <Box pos={[0, -0.25, -T / 2]} size={[W + T * 2, 0.5, D + T]} color="#5b636a" rough={0.85} />
      <GridFloor W={W} D={D} />

      {/* yellow safety border just inside the walls */}
      <Box pos={[0, 0.006, -hd + 0.14]} size={[W - 0.2, 0.012, 0.12]} color="#f2c230" rough={0.6} />
      <Box pos={[-hw + 0.14, 0.006, 0]} size={[0.12, 0.012, D - 0.2]} color="#f2c230" rough={0.6} />
      <Box pos={[ hw - 0.14, 0.006, 0]} size={[0.12, 0.012, D - 0.2]} color="#f2c230" rough={0.6} />

      {/* back wall (z = -D/2), room face towards +z */}
      <Wall outside={(c) => c.z < -hd}>
        <group position={[0, 0, -hd]}><WallAssembly len={W + T * 2} inner={W} /></group>
      </Wall>
      {/* left and right walls: same assembly turned to face the room */}
      <Wall outside={(c) => c.x < -hw}>
        <group position={[-hw, 0, 0]} rotation={[0, Math.PI / 2, 0]}><WallAssembly len={D} inner={D} /></group>
      </Wall>
      <Wall outside={(c) => c.x > hw}>
        <group position={[hw, 0, 0]} rotation={[0, -Math.PI / 2, 0]}><WallAssembly len={D} inner={D} /></group>
      </Wall>
    </>
  )
}

// ─── FloorHit ─────────────────────────────────────────────────────────────────

function FloorHit({ W, D }: { W: number; D: number }) {
  return (
    <mesh
      rotation-x={-Math.PI / 2}
      position={[0, 0, 0]}
      onPointerMove={(e) => {
        ;(window as any).__lastFloor = e.point
        const st = useStore.getState()
        if (st.dragId) st.dragTo(e.point.x, e.point.z)
      }}
      onPointerDown={() => {
        const st = useStore.getState()
        if (st.placing) {
          const p = (window as any).__lastFloor as THREE.Vector3
          st.place(snap(p.x), snap(p.z))
        } else {
          st.select(null)
        }
      }}
      onPointerOver={(e) => { ;(window as any).__lastFloor = e.point }}
    >
      <planeGeometry args={[W + 4, D + 4]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

// ─── FpsProbe ─────────────────────────────────────────────────────────────────
// Writes into the element with id="fps" (now in the status bar under the 3D view).
// Also writes GPU memory (geometries + textures) via THREE.WebGLRenderer.info when available,
// and JS heap size via the non-standard performance.memory API where the browser exposes it.

function FpsProbe() {
  const gl = useThree((s) => s.gl)
  let n = 0, t = performance.now()
  useFrame(() => {
    n++
    const now = performance.now()
    if (now - t > 500) {
      const el = document.getElementById('fps')
      if (el) el.textContent = `${Math.round((n * 1000) / (now - t))} fps · ${gl.info.render.calls} ${T[useStore.getState().lang].drawCalls}`

      // Memory: prefer the non-standard performance.memory (Chrome/Edge desktop).
      // Fall back to THREE's geometry + texture counts as a proxy.
      const memEl = document.getElementById('mem')
      if (memEl) {
        const pm = (performance as any).memory
        if (pm) {
          const usedMB  = (pm.usedJSHeapSize  / 1048576).toFixed(0)
          const totalMB = (pm.totalJSHeapSize / 1048576).toFixed(0)
          memEl.textContent = `${usedMB} / ${totalMB} MB`
        } else {
          // Rough GPU-side proxy: sum of allocated geometries + textures reported by THREE
          const { geometries, textures } = gl.info.memory
          memEl.textContent = `${geometries} geo · ${textures} tex`
        }
      }

      n = 0; t = now
    }
  })
  return null
}

// ─── Palette item metadata ────────────────────────────────────────────────────

const PALETTE_ITEMS: Array<{ kind: Kind; label: string; dims: string; color: string; price: number; thumb: string }> = [
  { kind: 'cabinet', label: 'Control Cabinet',  dims: '1.2 × 0.77 × 2.05 m', color: '#1a6bbf', price: 4200, thumb: '/models/Cabinet.png'                 },
  { kind: 'motor',   label: 'Motor',            dims: '1.44 × 0.67 × 1.19 m', color: '#1a5faa', price: 2800, thumb: '/models/Motor.png'                   },
  { kind: 'panel',   label: 'Electrical Panel', dims: '1.0 × 0.44 × 1.79 m',  color: '#4a4a5a', price: 3500, thumb: '/models/Electric control panel.png'  },
]

// Number field that applies on Enter / blur, so typing "15" does not first clamp "1" to the minimum.
function SizeField({ label, min, max, value, onCommit }: {
  label: string; min: number; max: number; value: number; onCommit: (v: number) => void
}) {
  const t = T[useStore().lang]
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])

  const parsed     = parseFloat(text)
  const outOfRange = Number.isFinite(parsed) && (parsed < min || parsed > max)

  const commit = () => {
    const v = parseFloat(text)
    // Only apply if valid — don't silently clamp to max, just revert to last good value
    if (Number.isFinite(v) && v >= min && v <= max) onCommit(v)
    else setText(String(value))   // revert
  }

  return (
    <label className="text-[11px]" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', color: outOfRange ? '#ef4444' : 'var(--ink-soft)' }}>
        <span>{label} ({min}–{max} m)</span>
        {outOfRange && <span style={{ fontSize: 10, fontWeight: 700 }}>{parsed < min ? t.useMin(min) : t.useMax(max)}</span>}
      </span>
      <input
        type="number" className="w-full min-w-0" min={min} max={max} step={1} value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        style={{
          borderColor: outOfRange ? '#ef4444' : undefined,
          background:  outOfRange ? 'rgba(239,68,68,0.1)' : undefined,
          color:       outOfRange ? '#ef4444' : undefined,
        }}
      />
    </label>
  )
}

// Small pill used in the status bar under the 3D view
function StatChip({ icon: Icon, children, title }: {
  icon: typeof Activity; children: React.ReactNode; title?: string
}) {
  return (
    <span title={title}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] px-2.5 py-[3px] text-[11px] text-status-fg tabular-nums">
      <Icon size={12} className="shrink-0 opacity-80" />
      {children}
    </span>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const s      = useStore()
  const t      = T[s.lang]
  const bad    = useMemo(() => violations(s.items), [s.items])
  const badIds = useMemo(() => new Set(bad.flatMap((v) => [v.a.id, v.b.id])), [bad])
  const sel     = s.items.find((i) => i.id === s.selectedId)
  const selWire = s.wires.find((w) => w.id === s.selectedWireId)
  const name    = (i: Item) => `${t[i.kind]} ${i.num}`

  const [wiringMode, setWiringMode] = useState(false)
  const [wiringFrom, setWiringFrom] = useState<string | null>(null)
  const [dark, setDark] = useState(true) // default dark
  

  const [langOpen, setLangOpen] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [dark])

  const handleItemDown = useCallback((id: string) => {
    if (wiringMode) {
      // In wire mode: first click sets the source, second click creates the wire.
      // Never select or drag — just manage wiring state.
      if (wiringFrom === null) { setWiringFrom(id); return }
      if (wiringFrom === id)   { setWiringFrom(null); return }   // click same item = cancel
      useStore.getState().addWire(wiringFrom, id)
      setWiringFrom(null); setWiringMode(false)
      return
    }
    useStore.getState().beginDrag(id)
  }, [wiringMode, wiringFrom])

  useEffect(() => {
    const up  = () => useStore.getState().endDrag()
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      const st = useStore.getState(), mod = e.ctrlKey || e.metaKey, id = st.selectedId
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? st.redo() : st.undo() }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); st.redo() }
      else if (e.key === 'Escape') {
        st.arm(null); st.select(null); setWiringFrom(null); setWiringMode(false)
      }
      else if (!id) return
      else if (e.key === 'Delete' || e.key === 'Backspace') st.remove(id)
      else if (e.key.toLowerCase() === 'r')
        st.update(id, { rot: ((st.items.find((i) => i.id === id)!.rot ?? 0) + 90) % 360 }, 'Rotated')
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault()
        const it = st.items.find((i) => i.id === id)!, c = GRID.cell
        const d = { ArrowLeft: [-c,0], ArrowRight: [c,0], ArrowUp: [0,-c], ArrowDown: [0,c] }[e.key] ?? [0,0]
        st.update(id, { x: it.x + d[0], z: it.z + d[1] }, 'Moved')
      }
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('keydown', key) }
  }, [])

  
 

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="flex items-center gap-2 px-3.5 bg-header-bg text-header-fg border-b border-header-border">
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          {/* Language dropdown */}
          <div className="relative">
            <button
              onClick={() => setLangOpen((v) => !v)}
              className="py-1 px-3 text-xs font-bold bg-black/[0.04] dark:bg-white/8 text-header-fg border border-black/10 dark:border-white/12 rounded-[5px] cursor-pointer transition-colors duration-150 hover:bg-black/[0.08] dark:hover:bg-white/15 flex items-center gap-1.5"
              aria-haspopup="listbox"
              aria-expanded={langOpen}>
              <span className="opacity-60 text-[10px]">🌐</span>
              <span>{t.langLabel}</span>
              <span className={`opacity-40 text-[10px] transition-transform duration-150 ${langOpen ? 'rotate-180' : ''}`}>▾</span>
            </button>
            {langOpen && (
              <>
                {/* backdrop to close on outside click */}
                <div className="fixed inset-0 z-20" onClick={() => setLangOpen(false)} />
                <ul
                  role="listbox"
                  className="absolute right-0 top-full mt-1 z-30 min-w-[140px] overflow-hidden rounded-lg border border-line shadow-lg bg-header-bg">
                  {([['en', '🇺🇸', 'English'], ['vi', '🇻🇳', 'Tiếng Việt']] as const).map(([code, flag, label]) => (
                    <li key={code}>
                      <button
                        role="option"
                        aria-selected={s.lang === code}
                        onClick={() => { s.setLang(code); setLangOpen(false) }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold cursor-pointer border-0 transition-colors duration-150 ${
                          s.lang === code
                            ? 'bg-accent text-white'
                            : 'bg-transparent text-header-fg hover:bg-black/[0.06] dark:hover:bg-white/10'
                        }`}>
                        <span>{flag}</span>
                        <span>{label}</span>
                        {s.lang === code && <span className="ml-auto text-[10px]">✓</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <button onClick={() => setDark((d) => !d)} className="px-2 py-0.5 text-sm bg-black/[0.04] dark:bg-white/8 text-header-fg border border-black/10 dark:border-white/12 rounded-[5px] cursor-pointer transition-colors duration-150 hover:bg-black/[0.08] dark:hover:bg-white/15" title={dark ? t.lightMode : t.darkMode}>
            {dark ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* ── Left Panel: Equipment Palette ── */}
      {/* ── Left Panel ── */}
<aside className="left overflow-y-auto overflow-x-hidden bg-panel-bg border-r border-line flex flex-col">
  <LeftPanel
    s={s} t={t} palette={PALETTE_ITEMS} name={name} badIds={badIds}
    wiringMode={wiringMode} wiringFrom={wiringFrom}
    onToggleWiring={() => { setWiringMode((v) => !v); setWiringFrom(null); s.arm(null) }}
    onArm={(k) => { s.arm(k); setWiringMode(false) }}
  />
</aside>

      {/* ── 3D Canvas ── */}
      <main className="relative overflow-hidden min-w-0">
        {/* Centered title strip above the scene */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center py-1"
          style={{ background: 'rgba(5,10,22,0.72)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-[11px] font-semibold tracking-wide" style={{ color: 'rgba(255,255,255,0.65)' }}>{t.title}</span>
        </div>

        {/* Undo / Redo — floating just below the title */}
        <div className="absolute top-[4.5rem] left-1/2 z-10 -translate-x-1/2 flex gap-1.5 rounded-full border border-white/10 bg-toolbar-bg p-1 backdrop-blur-[12px] shadow-lg">
          <button onClick={s.undo} disabled={!s.past.length} title={t.undoTip}
            className="flex items-center gap-1.5 rounded-full border-0 bg-[#f59e0b] px-3.5 py-1.5 text-xs font-semibold text-[#1c1200] cursor-pointer transition-all duration-150 hover:brightness-110 active:scale-95 disabled:cursor-default disabled:bg-white/10 disabled:text-white/35 disabled:hover:brightness-100">
            <Undo2 size={14} strokeWidth={2.4} />{t.undo}
          </button>
          <button onClick={s.redo} disabled={!s.future.length} title={t.redoTip}
            className="flex items-center gap-1.5 rounded-full border-0 bg-[#10b981] px-3.5 py-1.5 text-xs font-semibold text-[#03180f] cursor-pointer transition-all duration-150 hover:brightness-110 active:scale-95 disabled:cursor-default disabled:bg-white/10 disabled:text-white/35 disabled:hover:brightness-100">
            <Redo2 size={14} strokeWidth={2.4} />{t.redo}
          </button>
        </div>
        <Canvas
          camera={{ position: [6, 17, 22], fov: 48 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, powerPreference: 'high-performance', stencil: false }}
        >
          <color attach="background" args={['#c8d4dc']} />
          <ambientLight intensity={1.6} color="#ffffff" />
          {/* One key + one fill — enough for layout readability, cheap at 500 instances */}
          <directionalLight position={[6, 12, 10]} intensity={1.4} />
          <directionalLight position={[-8, 10, 8]} intensity={0.7} color="#e8eef4" />

          <Suspense fallback={null}>
            <ElectricalRoom W={s.roomW} D={s.roomD} />
          </Suspense>
          <FloorHit W={s.roomW} D={s.roomD} />
          <Items items={s.items} badIds={badIds} selectedId={s.selectedId}
            dragging={s.dragId !== null} onItemPointerDown={handleItemDown} />
          <Wires items={s.items} wires={s.wires} badIds={badIds}
            selectedWireId={s.selectedWireId} selectedId={s.selectedId} onSelectWire={s.selectWire} />
          <OrbitControls makeDefault enabled={!s.dragId} maxPolarAngle={Math.PI / 2.35} minPolarAngle={0.15} />
          <FpsProbe />
        </Canvas>

        {/* Toolbar */}
        <div className="absolute bottom-9 left-1/2 -translate-x-1/2 flex gap-1 bg-toolbar-bg backdrop-blur-[12px] py-1.5 px-2.5 rounded-3xl border border-white/8">
          <button className={`py-1.5 px-3.5 text-xs rounded-2xl border border-transparent cursor-pointer transition-colors duration-150 whitespace-nowrap ${!wiringMode && !s.placing ? 'bg-accent text-white' : 'bg-transparent text-toolbar-fg hover:bg-white/12'}`} title={t.select}
            aria-pressed={!wiringMode && !s.placing}
            onClick={() => { setWiringMode(false); setWiringFrom(null); useStore.getState().cancelPlacing() }}>⬛ {t.select}</button>
          <button className="py-1.5 px-3.5 text-xs rounded-2xl border border-transparent bg-transparent text-toolbar-fg cursor-pointer transition-colors duration-150 whitespace-nowrap hover:bg-white/12 disabled:opacity-30 disabled:cursor-default" title={t.rotate} disabled={!sel}
            onClick={() => sel && s.update(sel.id, { rot: ((sel.rot ?? 0) + 90) % 360 }, 'Rotated')}>
            ↻ {t.rotate}
          </button>
          <button className="py-1.5 px-3.5 text-xs rounded-2xl border border-transparent bg-transparent text-[#fca5a5] cursor-pointer transition-colors duration-150 whitespace-nowrap hover:bg-white/12 disabled:opacity-30 disabled:cursor-default danger-tool" title={t.deleteItem}
            onClick={() => sel && s.remove(sel.id)} disabled={!sel}>
            🗑 {t.deleteItem}
          </button>
          <button className={`py-1.5 px-3.5 text-xs rounded-2xl border border-transparent cursor-pointer transition-colors duration-150 whitespace-nowrap hover:bg-white/12 ${wiringMode ? 'bg-accent text-white' : 'bg-transparent text-toolbar-fg'}`}  title={t.wire}
            onClick={() => { setWiringMode((v) => !v); setWiringFrom(null); s.arm(null) }}>
            ⚡ {t.wire}
          </button>
        </div>

        {/* Status bar */}
        
<div className="absolute top-9 left-1/2 z-10 -translate-x-1/2 flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 bg-toolbar-bg px-1.5 py-1 shadow-lg backdrop-blur-[12px]">
   <StatChip icon={Grid3x3} title={t.tipGrid}>{t.grid} {GRID.cell} m</StatChip>
  <StatChip icon={Ruler}  title={t.roomSize}>{s.roomW} m × {s.roomD} m</StatChip>
  <StatChip icon={Boxes} title={t.items}>{s.items.length} {t.items.toLowerCase()}</StatChip>
  <StatChip icon={Activity} title={t.tipFps}>
    <span id="fps">– fps</span>
  </StatChip>
  <StatChip icon={Cpu} title="JS heap (used / total MB) in Chrome/Edge; geometry + texture counts elsewhere">
    <span id="mem">– MB</span>
  </StatChip>
</div>
      </main>

      {/* ── Right Panel: Clearance + Selection + Room size ── */}
      <aside className="right overflow-y-auto overflow-x-hidden bg-panel-bg border-l border-line flex flex-col">
        <RightPanel
          s={s} t={t} bad={bad} sel={sel} selWire={selWire} name={name}
          roomSize={
            <div className="grid grid-cols-2 gap-2">
              <SizeField label={t.width} min={ROOM_LIMITS.minW} max={ROOM_LIMITS.maxW} value={s.roomW} onCommit={(w) => s.setRoomSize(w, s.roomD)} />
              <SizeField label={t.depth} min={ROOM_LIMITS.minD} max={ROOM_LIMITS.maxD} value={s.roomD} onCommit={(d) => s.setRoomSize(s.roomW, d)} />
            </div>
          }
        />
      </aside>

      <div className="sr-only" role="status" aria-live="polite">{s.announce}</div>
    </div>
  )
}