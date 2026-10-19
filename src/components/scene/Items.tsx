import { useGLTF } from '@react-three/drei'
import { useLayoutEffect, useMemo, useRef, Suspense } from 'react'
import * as THREE from 'three'
import { KINDS, footprint, type Item, type Kind } from '../../lib/store'

// ─── Model registry ───────────────────────────────────────────────────────────

export const MODEL_PATHS: Record<Kind, string> = {
  cabinet: '/models/Cabinet_blue.glb',
  motor:   '/models/motor_blue_colored.glb',
  panel:   '/models/electrical_control_panel_unit.glb',
}
Object.values(MODEL_PATHS).forEach((p) => useGLTF.preload(p))

export const COLORABLE_KINDS: Kind[] = ['motor']

export const KIND_COLOR: Record<Kind, string> = {
  cabinet: '#1a6bbf',
  motor:   '#1a5faa',
  panel:   '#4a4a5a',
}

const noRay = () => null
const HIT_MAT = new THREE.MeshBasicMaterial({ visible: false })

interface SubMesh {
  geo: THREE.BufferGeometry
  mat: THREE.MeshStandardMaterial
  colorable: boolean
}

// Compressed models (meshopt / KHR_mesh_quantization) arrive with Int8/Int16 (and sometimes interleaved)
// attributes. applyMatrix4 on those ROUNDS the result to integers, which squashes and flattens the model.
// Convert to plain Float32 first (getX/Y/Z/W de-normalise correctly).
function toFloat32(geo: THREE.BufferGeometry) {
  for (const name of ['position', 'normal', 'uv'] as const) {
    const a = geo.getAttribute(name)
    if (!a) continue
    if (!(a as THREE.BufferAttribute).isBufferAttribute || !(a.array instanceof Float32Array) || (a as any).isInterleavedBufferAttribute) {
      const n = a.itemSize, out = new Float32Array(a.count * n)
      for (let i = 0; i < a.count; i++) {
        out[i * n] = a.getX(i)
        if (n > 1) out[i * n + 1] = a.getY(i)
        if (n > 2) out[i * n + 2] = a.getZ(i)
        if (n > 3) out[i * n + 3] = a.getW(i)
      }
      geo.setAttribute(name, new THREE.BufferAttribute(out, n))
    }
  }
}

function buildSubMeshes(scene: THREE.Object3D, kind: Kind): SubMesh[] {
  const wrapper = new THREE.Object3D()
  const root    = scene.clone(true)
  wrapper.add(root)
  wrapper.updateMatrixWorld(true)

  const k = KINDS[kind]

  // ── Step 1: uniform scale to fit declared bounding box ───────────────────
  const box0 = new THREE.Box3().setFromObject(root)
  const size0 = box0.getSize(new THREE.Vector3())
  const sc = (size0.x > 1e-6 && size0.y > 1e-6 && size0.z > 1e-6)
    ? Math.min(k.w / size0.x, k.h / size0.y, k.d / size0.z)
    : 1
  root.scale.setScalar(sc)
  wrapper.updateMatrixWorld(true)

  // ── Step 2: centre on XZ, bottom at y = 0 ────────────────────────────────
  const box1 = new THREE.Box3().setFromObject(root)
  const ctr  = box1.getCenter(new THREE.Vector3())
  root.position.set(-ctr.x, -box1.min.y, -ctr.z)
  wrapper.updateMatrixWorld(true)

  // ── Step 3: bake each mesh's world transform into its geometry ────────────
  const isColorableKind = COLORABLE_KINDS.includes(kind)
  const kindBaseColor   = new THREE.Color(KIND_COLOR[kind])

  const result: SubMesh[] = []
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry) return

    const geo = mesh.geometry.clone()
    toFloat32(geo)                        // <- must happen before applyMatrix4
    geo.applyMatrix4(mesh.matrixWorld)
    geo.deleteAttribute('uv2')
    geo.deleteAttribute('tangent')
    if (!geo.getAttribute('normal')) geo.computeVertexNormals()
    geo.computeBoundingBox()
    geo.computeBoundingSphere()

    const srcMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
    if (!srcMat) return
    const mat = (srcMat as THREE.MeshStandardMaterial).clone()
    mat.vertexColors = false

    let colorable = false
    if (isColorableKind && mat.color) {
      const mc = mat.color
      const dr = mc.r - kindBaseColor.r
      const dg = mc.g - kindBaseColor.g
      const db = mc.b - kindBaseColor.b
      colorable = Math.sqrt(dr * dr + dg * dg + db * db) < 0.55
      if (colorable) mat.color.set(1, 1, 1)
    }

    result.push({ geo, mat, colorable })
  })

  // ── Step 4: make sure the lowest vertex sits exactly on y = 0 ─────────────
  let minY = Infinity
  for (const sm of result) {
    const y = sm.geo.boundingBox?.min.y
    if (y != null && y < minY) minY = y
  }
  if (Number.isFinite(minY) && minY !== 0) {
    const dy = -minY
    for (const sm of result) {
      sm.geo.translate(0, dy, 0)
      sm.geo.computeBoundingBox()
      sm.geo.computeBoundingSphere()
    }
  }

  return result
}

// ─── Scratch objects ──────────────────────────────────────────────────────────
const _m4   = new THREE.Matrix4()
const _pos  = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _scl  = new THREE.Vector3(1, 1, 1)
const _col  = new THREE.Color()
const _eul  = new THREE.Euler()

const DEG2RAD    = Math.PI / 180
const BAD_COLOR  = new THREE.Color('#d6336c')
const CLEAR_COLOR = new THREE.Color(1, 1, 1)

const capacity = (n: number) => Math.max(8, 2 ** Math.ceil(Math.log2(Math.max(n, 1))))

// ─── Per-kind instanced renderer ──────────────────────────────────────────────

function KindInstances({ kind, items, badIds, dragging, onDown }: {
  kind: Kind; items: Item[]; badIds: Set<string>; dragging: boolean; onDown: (id: string) => void
}) {
  const { scene } = useGLTF(MODEL_PATHS[kind])
  const subMeshes = useMemo(() => buildSubMeshes(scene, kind), [scene]) // eslint-disable-line react-hooks/exhaustive-deps

  const k   = KINDS[kind]
  const cap = capacity(items.length)

  const meshRefs = useRef<(THREE.InstancedMesh | null)[]>([])
  const hitRef   = useRef<THREE.InstancedMesh | null>(null)
  const hitGeo   = useMemo(() => new THREE.BoxGeometry(k.w, k.h, k.d), [k])

  useLayoutEffect(() => {
    const count = items.length

    subMeshes.forEach((sm, si) => {
      const im = meshRefs.current[si]
      if (!im) return
      im.count = count
      for (let idx = 0; idx < count; idx++) {
        const it = items[idx]
        _eul.set(0, it.rot * DEG2RAD, 0)
        _quat.setFromEuler(_eul)
        _pos.set(it.x, 0, it.z)
        im.setMatrixAt(idx, _m4.compose(_pos, _quat, _scl))
        if (badIds.has(it.id)) im.setColorAt(idx, BAD_COLOR)
        else if (sm.colorable) { _col.set(it.color ?? KIND_COLOR[kind]); im.setColorAt(idx, _col) }
        else im.setColorAt(idx, CLEAR_COLOR)
      }
      im.instanceMatrix.needsUpdate = true
      if (im.instanceColor) im.instanceColor.needsUpdate = true
    })

    const hit = hitRef.current
    if (hit) {
      hit.count = count
      for (let idx = 0; idx < count; idx++) {
        const it = items[idx]
        _eul.set(0, it.rot * DEG2RAD, 0)
        _quat.setFromEuler(_eul)
        _pos.set(it.x, k.h / 2, it.z)
        hit.setMatrixAt(idx, _m4.compose(_pos, _quat, _scl))
      }
      hit.instanceMatrix.needsUpdate = true
      hit.computeBoundingSphere()
    }
  }, [items, badIds, subMeshes, k, kind, cap])

  const instanceToId = useMemo(() => items.map((it) => it.id), [items])

  return (
    <group key={`${kind}-${cap}`}>
      {subMeshes.map((sm, si) => (
        <instancedMesh key={si} ref={(el) => { meshRefs.current[si] = el }}
          args={[sm.geo, sm.mat, cap]} frustumCulled castShadow={false} receiveShadow={false} />
      ))}
      <instancedMesh ref={hitRef} args={[hitGeo, HIT_MAT, cap]} frustumCulled
        raycast={dragging ? noRay : THREE.InstancedMesh.prototype.raycast}
        onPointerDown={(e) => {
          e.stopPropagation()
          const id = instanceToId[e.instanceId ?? -1]
          if (id) onDown(id)
        }} />
    </group>
  )
}

// ─── Footprint pads ───────────────────────────────────────────────────────────

const _fm = new THREE.Matrix4()
const _fq = new THREE.Quaternion()
const _fp = new THREE.Vector3()
const _fs = new THREE.Vector3()

const PAD_GEO     = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
const PAD_MAT_NRM = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.04, depthWrite: false })

function makePadRingGeo() {
  const t = 0.04
  const geo = new THREE.BufferGeometry()
  const verts: number[] = []
  const addRect = (x: number, z: number, w: number, d: number) => {
    verts.push(x-w/2,0,z-d/2, x+w/2,0,z-d/2, x+w/2,0,z+d/2, x-w/2,0,z-d/2, x+w/2,0,z+d/2, x-w/2,0,z+d/2)
  }
  addRect(0, -0.5+t/2, 1, t); addRect(0, 0.5-t/2, 1, t)
  addRect(-0.5+t/2, 0, t, 1-t*2); addRect(0.5-t/2, 0, t, 1-t*2)
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  return geo
}
const PAD_RING_GEO = makePadRingGeo()
const PAD_RING_NRM = new THREE.MeshBasicMaterial({ color: '#8899aa', transparent: true, opacity: 0.3, depthWrite: false })

const PAD_BASE = new THREE.Color('#ffffff')
const PAD_BAD  = new THREE.Color('#ff3d7f')
const PAD_SEL  = new THREE.Color('#22d3ee')

function FootprintPads({ items, badIds, selectedId }: {
  items: Item[]; badIds: Set<string>; selectedId: string | null
}) {
  const fillRef = useRef<THREE.InstancedMesh>(null!)
  const ringRef = useRef<THREE.InstancedMesh>(null!)
  const cap     = capacity(items.length)

  useLayoutEffect(() => {
    const fill = fillRef.current, ring = ringRef.current
    if (!fill || !ring) return
    fill.count = ring.count = items.length
    for (let i = 0; i < items.length; i++) {
      const it = items[i], f = footprint(it)
      const isSel = it.id === selectedId, isBad = badIds.has(it.id)
      _fq.identity()
      const mat = _fm.compose(_fp.set(it.x, 0.008, it.z), _fq, _fs.set(f.w + 0.1, 1, f.d + 0.1))
      fill.setMatrixAt(i, mat); ring.setMatrixAt(i, mat)
      const col = isSel ? PAD_SEL : isBad ? PAD_BAD : PAD_BASE
      fill.setColorAt(i, col); ring.setColorAt(i, col)
    }
    fill.instanceMatrix.needsUpdate = true; ring.instanceMatrix.needsUpdate = true
    if (fill.instanceColor) fill.instanceColor.needsUpdate = true
    if (ring.instanceColor) ring.instanceColor.needsUpdate = true
  }, [items, badIds, selectedId, cap])

  if (!items.length) return null
  return (
    <group key={cap}>
      <instancedMesh ref={fillRef} args={[PAD_GEO, PAD_MAT_NRM, cap]} frustumCulled={false} renderOrder={1} />
      <instancedMesh ref={ringRef} args={[PAD_RING_GEO, PAD_RING_NRM, cap]} frustumCulled={false} renderOrder={2} />
    </group>
  )
}

// ─── Selection outline ────────────────────────────────────────────────────────

function SelectionBox({ item }: { item: Item }) {
  const k   = KINDS[item.kind]
  const geo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(k.w + 0.06, k.h + 0.06, k.d + 0.06)), [k])
  return (
    <lineSegments geometry={geo} position={[item.x, k.h / 2, item.z]} rotation={[0, item.rot * DEG2RAD, 0]}>
      <lineBasicMaterial color="#22d3ee" />
    </lineSegments>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────

export function Items({ items, badIds, selectedId, dragging, onItemPointerDown }: {
  items: Item[]
  badIds: Set<string>
  selectedId: string | null
  dragging: boolean
  onItemPointerDown: (id: string) => void
}) {
  const byKind = useMemo(() => {
    const m = {} as Record<Kind, Item[]>
    for (const k of Object.keys(KINDS) as Kind[]) m[k] = []
    for (const it of items) m[it.kind].push(it)
    return m
  }, [items])

  const selected = selectedId ? items.find((i) => i.id === selectedId) : undefined

  return (
    <>
      <FootprintPads items={items} badIds={badIds} selectedId={selectedId} />
      {(Object.keys(KINDS) as Kind[]).filter((k) => byKind[k].length).map((k) => (
        <Suspense key={k} fallback={null}>
          <KindInstances kind={k} items={byKind[k]} badIds={badIds}
            dragging={dragging} onDown={onItemPointerDown} />
        </Suspense>
      ))}
      {selected && <SelectionBox item={selected} />}
    </>
  )
}